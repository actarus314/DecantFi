// Orchestrator: queries all available sources IN PARALLEL (tolerant of failures),
// finalizes each quote (converted gas + impact vs spot, computed uniformly for comparability),
// ranks by net, and for EURC compares direct vs via-USDC. Pure core reusable (CLI then app).
import type { NormalizedQuote, QuoteRequest, SourceConfig, SourceAdapter, Stroops } from './sources/types.js';
import type { Asset } from './assets.js';
import { BLND, USDC, EURC } from './assets.js';
import { ADAPTERS } from './sources/index.js';
import { rankQuotes, type Ranking } from './rank.js';
import { fetchPrices, targetEvmPerUnit, targetLocalPerUnit, priceImpactPct, type Prices } from './prices.js';
import { convertXlmToTarget } from './gas.js';
import { compareEurc, type EurcComparison } from './eurc.js';
import { isExecutableSource } from './executable.js';
import { analyzeSplit, type SplitAnalysis } from './split.js';
import { diag, type Diag } from './sources/diag.js';

export interface EngineConfig extends SourceConfig {
  slippageBps?: number;
  fractionsPct?: number[];
  withSplit?: boolean;
  /** Injectable prices (tests / cache). If absent: live fetch. */
  prices?: Prices;
  /** Injectable sources (tests). Default: ADAPTERS. */
  adapters?: SourceAdapter[];
  /** Honest re-simulation of the xBull/Aquarius legs for the EURC via-USDC composite.
   *  Provided by the web/collector layer. Without this callback, raw quotes are used. */
  reSimLeg?: (quotes: NormalizedQuote[], amountIn: Stroops) => Promise<NormalizedQuote[]>;
}

export interface QuoteResult {
  request: { sell: string; buy: string; amountIn: Stroops; slippageBps: number };
  prices: Prices;
  ranking: Ranking;
  eurc?: EurcComparison;
  split?: SplitAnalysis;
  /** Ids of available sources that returned no quote (informational, non-blocking). */
  errors: string[];
  /** Failure cause per source id, if captured (timeout / http / unavailable). */
  errorReasons?: Record<string, string>;
}

/** net = GROSS (target amount received). Soroban gas is paid in XLM, SEPARATELY — variable per tx,
 *  displayed separately by the wallet/explorer -> it is NO LONGER deducted from the target net (alignment
 *  with wallet/explorer). gasInTarget remains computed for INFO only (estimate, not deducted;
 *  the CLI displays it in a separate column). Impact vs spot is computed on the gross amount. */
export function finalize(q: NormalizedQuote, prices: Prices): NormalizedQuote {
  const tEvm = targetEvmPerUnit(q.buyAsset.symbol, prices);
  const tLoc = targetLocalPerUnit(q.buyAsset.symbol, prices);
  const gasInTarget = convertXlmToTarget(q.gasXlm, prices.xlmUsd, tEvm);
  const netOut = q.grossOut;
  const impact = priceImpactPct(q.amountIn, netOut, prices.blndUsd, tEvm);
  const impactLocal = priceImpactPct(q.amountIn, netOut, prices.blndUsd, tLoc);
  return {
    ...q,
    gasInTarget,
    netOut,
    priceImpactPct: impact ?? q.priceImpactPct,
    priceImpactLocalPct: impactLocal ?? q.priceImpactLocalPct,
    netRange: q.netRange,
  };
}

export async function quoteAll(
  req: QuoteRequest,
  cfg: EngineConfig,
  prices: Prices,
): Promise<{ quotes: NormalizedQuote[]; errors: string[]; errorReasons: Record<string, string> }> {
  const adapters = (cfg.adapters ?? ADAPTERS).filter(
    (a) => a.available(cfg) && (a.supports ? a.supports(req) : true),
  );
  // one ALS store per adapter — diag.run() injects context without changing the signature.
  const stores: Diag[] = adapters.map(() => ({}));
  // Independent timer per adapter (Date.now(): ms precision is enough in prod).
  const startTimes = adapters.map(() => Date.now());
  const settled = await Promise.allSettled(
    adapters.map((a, i) => diag.run(stores[i]!, () => a.quote(req, cfg))),
  );
  const quotes: NormalizedQuote[] = [];
  const errors: string[] = [];
  const errorReasons: Record<string, string> = {};
  settled.forEach((s, i) => {
    const id = adapters[i]!.id;
    if (s.status === 'fulfilled' && s.value) {
      const q = s.value;
      // Sets the API fetch duration (the re-sim will be accumulated in quote-api / tick).
      q.durationMs = Date.now() - startTimes[i]!;
      quotes.push(finalize(q, prices));
    } else {
      errors.push(id);
      const thrownReason = s.status === 'rejected' && (s.reason as Error)?.name === 'TimeoutError' ? 'timeout' : null;
      const reason = thrownReason ?? stores[i]!.reason ?? 'indisponible';
      errorReasons[id] = reason;
    }
  });
  return { quotes, errors, errorReasons };
}

export interface QuoteOptions {
  sell: Asset;
  buy: Asset;
  amountIn: Stroops;
  cfg: EngineConfig;
}

export async function quote(opts: QuoteOptions): Promise<QuoteResult> {
  const { sell, buy, amountIn, cfg } = opts;
  const slippageBps = cfg.slippageBps ?? 50;
  const prices = cfg.prices ?? (await fetchPrices({ timeoutMs: cfg.timeoutMs, horizonUrl: cfg.horizonUrl }));

  const req = (s: Asset, b: Asset, amt: Stroops): QuoteRequest => ({
    sellAsset: s,
    buyAsset: b,
    amountIn: amt,
    slippageBps,
  });
  const quoteAllFor = async (s: Asset, b: Asset, amt: Stroops): Promise<NormalizedQuote[]> =>
    (await quoteAll(req(s, b, amt), cfg, prices)).quotes;

  const main = await quoteAll(req(sell, buy, amountIn), cfg, prices);
  const ranking = rankQuotes(main.quotes);

  let eurc: EurcComparison | undefined;
  if (buy.symbol === 'EURC' && sell.symbol === 'BLND') {
    eurc = await compareEurc(amountIn, {
      blndToEurc: (amt) => quoteAllFor(BLND, EURC, amt),
      blndToUsdc: (amt) => quoteAllFor(BLND, USDC, amt),
      usdcToEurc: (amt) => quoteAllFor(USDC, EURC, amt),
    }, cfg.reSimLeg, isExecutableSource);
  }

  let split: SplitAnalysis | undefined;
  if (cfg.withSplit) {
    split = await analyzeSplit(amountIn, cfg.fractionsPct ?? [25, 50, 100], (amt) =>
      quoteAllFor(sell, buy, amt),
    );
  }

  return {
    request: { sell: sell.symbol, buy: buy.symbol, amountIn, slippageBps },
    prices,
    ranking,
    eurc,
    split,
    errors: main.errors,
    errorReasons: main.errorReasons,
  };
}
