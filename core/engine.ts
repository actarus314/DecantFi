// Orchestrateur : interroge toutes les sources disponibles EN PARALLELE (tolerant aux pannes),
// finalise chaque cotation (gas converti + impact vs spot, calcule uniformement pour comparabilite),
// classe par net, et pour EURC compare direct vs via-USDC. Cœur pur reutilisable (CLI puis app).
import type { NormalizedQuote, QuoteRequest, SourceConfig, SourceAdapter, Stroops } from './sources/types.js';
import type { Asset } from './assets.js';
import { BLND, USDC, EURC } from './assets.js';
import { ADAPTERS } from './sources/index.js';
import { rankQuotes, type Ranking } from './rank.js';
import { fetchPrices, targetUsdPerUnit, priceImpactPct, type Prices } from './prices.js';
import { convertXlmToTarget } from './gas.js';
import { compareEurc, type EurcComparison } from './eurc.js';
import { analyzeSplit, type SplitAnalysis } from './split.js';
import { diag, type Diag } from './sources/diag.js';

export interface EngineConfig extends SourceConfig {
  slippageBps?: number;
  fractionsPct?: number[];
  withSplit?: boolean;
  /** Prix injectables (tests / cache). Si absent : fetch live. */
  prices?: Prices;
  /** Sources injectables (tests). Defaut : ADAPTERS. */
  adapters?: SourceAdapter[];
}

export interface QuoteResult {
  request: { sell: string; buy: string; amountIn: Stroops; slippageBps: number };
  prices: Prices;
  ranking: Ranking;
  eurc?: EurcComparison;
  split?: SplitAnalysis;
  /** Ids des sources disponibles n'ayant pas rendu de cotation (info, non bloquant). */
  errors: string[];
  /** Cause de l'échec par source id, si capturée (timeout / http / indisponible). */
  errorReasons?: Record<string, string>;
}

function clampSub(a: Stroops, b: Stroops): Stroops {
  const r = a - b;
  return r < 0n ? 0n : r;
}

/** Convertit le gas dans la cible, recalcule netOut et l'impact vs spot (uniforme entre sources). */
export function finalize(q: NormalizedQuote, prices: Prices): NormalizedQuote {
  const tUsd = targetUsdPerUnit(q.buyAsset.symbol, prices);
  const gasInTarget = convertXlmToTarget(q.gasXlm, prices.xlmUsd, tUsd);
  const netOut = clampSub(q.grossOut, gasInTarget);
  const impact = priceImpactPct(q.amountIn, netOut, prices.blndUsd, tUsd);
  const netRange = q.netRange
    ? { low: clampSub(q.netRange.low, gasInTarget), high: clampSub(q.netRange.high, gasInTarget) }
    : undefined;
  return { ...q, gasInTarget, netOut, priceImpactPct: impact ?? q.priceImpactPct, netRange };
}

export async function quoteAll(
  req: QuoteRequest,
  cfg: EngineConfig,
  prices: Prices,
): Promise<{ quotes: NormalizedQuote[]; errors: string[]; errorReasons: Record<string, string> }> {
  const adapters = (cfg.adapters ?? ADAPTERS).filter(
    (a) => a.available(cfg) && (a.supports ? a.supports(req) : true),
  );
  // ponytail: un store ALS par adaptateur — diag.run() injecte le contexte sans changer la signature.
  const stores: Diag[] = adapters.map(() => ({}));
  const settled = await Promise.allSettled(
    adapters.map((a, i) => diag.run(stores[i]!, () => a.quote(req, cfg))),
  );
  const quotes: NormalizedQuote[] = [];
  const errors: string[] = [];
  const errorReasons: Record<string, string> = {};
  settled.forEach((s, i) => {
    const id = adapters[i]!.id;
    if (s.status === 'fulfilled' && s.value) {
      quotes.push(finalize(s.value, prices));
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
  const prices = cfg.prices ?? (await fetchPrices({ timeoutMs: cfg.timeoutMs }));

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
  if (buy.symbol === 'EURC') {
    eurc = await compareEurc(amountIn, {
      blndToEurc: (amt) => quoteAllFor(BLND, EURC, amt),
      blndToUsdc: (amt) => quoteAllFor(BLND, USDC, amt),
      usdcToEurc: (amt) => quoteAllFor(USDC, EURC, amt),
    });
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
