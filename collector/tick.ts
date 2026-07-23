// Runs ONE tick: prices fetched once (injected into probes for comparability), quote() per probe, assembles the rows.
// No DB I/O. Returns a TickInsert + its QuoteInsert rows (ready for db.insertTickWithQuotes).
import { BLND, EURC } from '../core/assets.js';
import { priceImpactPct, targetEvmPerUnit, type Prices } from '../core/prices.js';
import type { QuoteResult, QuoteOptions, EngineConfig } from '../core/engine.js';
import type { NormalizedQuote } from '../core/sources/types.js';
import type { TickInsert, QuoteInsert, RpcProbeInsert } from '../db/index.js';
import type { CollectorConfig } from './config.js';
import type { Probe } from './probes.js';
import { resimAquariusXbull, makeReSimLeg } from '../web/quote-api.js';
import type { simulateAquariusNet, simulateXbullNet } from '../web/execute.js';
import { selectRpc, type RpcSelection } from '../core/rpc-select.js';
import { resetRpc, readRpc } from '../core/rpc-meter.js';

export interface TickDeps {
  probes: Probe[];
  cfg: CollectorConfig;
  now: () => Date;
  fetchPrices: (opts: { timeoutMs?: number; horizonUrl?: string }) => Promise<Prices>;
  quote: (opts: QuoteOptions) => Promise<QuoteResult>;
  /** Fake injection for Aquarius/xBull sims (tests only). */
  resimDeps?: { simulateAquariusNet?: typeof simulateAquariusNet; simulateXbullNet?: typeof simulateXbullNet };
  /** Fake injection for RPC selection (tests only). */
  selectRpc?: (urls: string[], timeoutMs: number) => Promise<RpcSelection>;
}

export interface TickAssembled { tick: TickInsert; quotes: QuoteInsert[]; rpcProbes: RpcProbeInsert[]; }

export function bigIntJson(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v;
}

/** Compact route summary: "BLND->XLM->USDC" (or "BLND->USDC" if no hops). */
function routeSummary(q: NormalizedQuote): string {
  if (q.route.length === 0) return `${q.sellAsset.symbol}->${q.buyAsset.symbol}`;
  return [q.route[0]!.sell, ...q.route.map((h) => h.buy)].join('->');
}

/** Sum of fees expressed in the target asset, or null otherwise. */
function feeTotal(q: NormalizedQuote): bigint | null {
  let sum = 0n; let any = false;
  for (const f of q.feeBreakdown) if (f.amount !== undefined && f.asset === q.buyAsset.symbol) { sum += f.amount; any = true; }
  return any ? sum : null;
}

function rowFromQuote(pair: string, amountIn: bigint, q: NormalizedQuote, isWinner: boolean, eurcPath: string | null): QuoteInsert {
  return {
    pair, amount_in: amountIn, source_id: q.source,
    net_out: q.netOut, net_confidence: q.netConfidence, price_impact_pct: q.priceImpactPct ?? null,
    gas_in_target: q.gasInTarget, fee_total: feeTotal(q), route_summary: routeSummary(q),
    is_winner: isWinner, eurc_path: eurcPath, raw_json: JSON.stringify(q.raw, bigIntJson),
    duration_ms: q.durationMs ?? null,
  };
}

/** Builds the QuoteInsert rows for a probe from the engine's QuoteResult. */
function rowsForProbe(probe: Probe, result: QuoteResult, prices: Prices): QuoteInsert[] {
  const rows: QuoteInsert[] = [];
  const isEurc = probe.buy.symbol === 'EURC';

  if (!isEurc) {
    result.ranking.ranked.forEach((q, i) => rows.push(rowFromQuote(probe.pair, probe.amountIn, q, i === 0, null)));
    return rows;
  }

  // EURC: no native pair → "direct" rows (atomic, internal multi-hop) + 1 via-usdc composite.
  // is_winner set POSITIONALLY: ranked[0] = best direct (rankQuotes sorts netOut desc).
  // NEVER compare q.netOut === eurc.bestNetEurc: ranking (main fetch) and eurc (compareEurc)
  // come from TWO separate network calls → the bigint equality would fail almost every time.
  const eurc = result.eurc;
  result.ranking.ranked.forEach((q, i) => {
    const win = eurc?.winner === 'direct' && i === 0;
    rows.push(rowFromQuote(probe.pair, probe.amountIn, q, win, 'direct'));
  });
  if (eurc?.viaUsdc) {
    const v = eurc.viaUsdc;
    const impact = priceImpactPct(probe.amountIn, v.netEurc, prices.blndUsd, targetEvmPerUnit('EURC', prices));
    const win = eurc.winner === 'via-usdc';
    rows.push({
      pair: probe.pair, amount_in: probe.amountIn, source_id: `${v.leg1.source}+${v.leg2.source}`,
      net_out: v.netEurc, net_confidence: 'exact', price_impact_pct: impact ?? null,
      gas_in_target: v.leg1.gasInTarget + v.leg2.gasInTarget, fee_total: null, // composite: gas of both legs
      route_summary: `${v.leg1.source}:BLND->USDC | ${v.leg2.source}:USDC->EURC`,
      is_winner: win, eurc_path: 'via-usdc', raw_json: JSON.stringify(eurc, bigIntJson),
      duration_ms: null, // composite 2-tx: no measurable atomic duration
    });
  }
  return rows;
}

export async function runTick(deps: TickDeps): Promise<TickAssembled> {
  const startedAt = deps.now();

  // Best RPC selection: best-effort, a failure never breaks the tick.
  let sel: RpcSelection = { chosen: deps.cfg.rpcUrl, probes: [] };
  resetRpc();
  try {
    sel = await (deps.selectRpc ?? selectRpc)(deps.cfg.rpcUrls, deps.cfg.timeoutMs);
  } catch { /* silent fallback: default rpcUrl */ }
  const rpcUrl = sel.chosen || deps.cfg.rpcUrl;

  const prices = await deps.fetchPrices({ timeoutMs: deps.cfg.timeoutMs, horizonUrl: deps.cfg.horizonUrl });

  const sourceCfg: EngineConfig = {
    rpcUrl, horizonUrl: deps.cfg.horizonUrl,
    soroswapApiKey: deps.cfg.soroswapApiKey, stellarBrokerApiKey: deps.cfg.stellarBrokerApiKey,
    walletAddress: deps.cfg.walletAddress,
    timeoutMs: deps.cfg.timeoutMs, prices, // <- injected prices: single fetch, comparability preserved
    // RPC cache shared across the tick's 4 probes: coalesces reads of identical pools
    // (EURC probes × 3 sub-quotes re-read the same pools) → ~180 → ~30 RPC calls/tick,
    // eliminates 429s from the public RPC. Fresh on every tick (up-to-date reserves).
    rpcCache: new Map(),
    // Honest re-simulation of the EURC via-USDC legs: same as liveQuote, best-effort.
    reSimLeg: makeReSimLeg({ rpcUrl }, deps.resimDeps),
  };

  // Parallelization: all probes fire at the same time (Promise.all).
  // Each task returns its rows + errors; the merge happens afterward (deterministic order = deps.probes order).
  type ProbeResult = { rows: QuoteInsert[]; errors: Array<[string, string]>; resimErrors: number };

  const probeResults = await Promise.all(deps.probes.map(async (probe): Promise<ProbeResult> => {
    const result = await deps.quote({ sell: BLND, buy: probe.buy, amountIn: probe.amountIn, cfg: sourceCfg });
    const localErrors: Array<[string, string]> = [];
    for (const e of result.errors) {
      localErrors.push([e, result.errorReasons?.[e] ?? 'indisponible']);
    }

    // Aquarius + xBull re-simulation: replaces over-quoted nets and decodes the xBull route,
    // so the DB stores the real simulated fills (not the over-quoted API prices).
    // Best-effort: an RPC failure (429, timeout) never breaks the tick.
    const pairUi = probe.buy.symbol === EURC.symbol ? 'EURC' : 'USDC';
    let resimErrors = 0;
    try {
      await resimAquariusXbull(result, pairUi, probe.amountIn, { rpcUrl }, deps.resimDeps);
    } catch (e) {
      // Count RPC pressure errors from re-sim (429, rate-limit, timeout, connection reset).
      const msg = e instanceof Error ? e.message : String(e);
      if (/429|rate.?limit|too many|timeout|ETIMEDOUT|ECONNRESET/i.test(msg)) resimErrors++;
      /* silent fallback: API quote kept as-is */
    }

    return { rows: rowsForProbe(probe, result, prices), errors: localErrors, resimErrors };
  }));

  // Merge in deps.probes order (deterministic).
  const quotes: QuoteInsert[] = [];
  const reasons = new Map<string, string>(); // id → cause (timeout/http/unavailable)
  let totalResimErrors = 0;
  for (const pr of probeResults) {
    quotes.push(...pr.rows);
    for (const [id, reason] of pr.errors) {
      if (!reasons.has(id)) reasons.set(id, reason);
    }
    totalResimErrors += pr.resimErrors;
  }

  const rpcCalls = readRpc();
  const finishedAt = deps.now();
  const tick: TickInsert = {
    started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), cadence_sec: deps.cfg.cadenceSec,
    blnd_usd: prices.blndUsd, xlm_usd: prices.xlmUsd, eurc_usd: prices.eurcUsd, eurc_stellar_mid: prices.eurcStellarMid,
    ok: quotes.some((q) => q.net_out !== null && q.net_out > 0n),
    source_errors: reasons.size > 0
      ? JSON.stringify([...reasons].map(([id, reason]) => ({ id, reason })))
      : null,
    note: null,
  };

  // sim_errors count per RPC URL (429, rate-limit, timeout, ECONNRESET).
  // Includes both source adapter errors AND re-sim RPC errors (resimAquariusXbull catch).
  const simErrorRe = /429|rate.?limit|too many|timeout|ETIMEDOUT|ECONNRESET/i;
  const simErrorCount = [...reasons.values()].filter((r) => simErrorRe.test(r)).length + totalResimErrors;
  const rpcProbes: RpcProbeInsert[] = sel.probes.map((p) => ({
    url: p.url, ok: p.ok, latency_ms: p.latencyMs, ledger: p.ledger,
    chosen: p.url === rpcUrl,
    sim_errors: p.url === rpcUrl ? simErrorCount : 0,
    rpc_calls: p.url === rpcUrl ? rpcCalls : 0,
    error: p.error,
  }));

  return { tick, quotes, rpcProbes };
}

/** Failure tick (unexpected exception): ok=false row with a note, zero quotes. Spec §7 — the gap stays visible. */
export function failedTick(cfg: { cadenceSec: number }, startedAt: Date, finishedAt: Date, message: string): TickInsert {
  return {
    started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), cadence_sec: cfg.cadenceSec,
    blnd_usd: null, xlm_usd: null, eurc_usd: null, eurc_stellar_mid: null, ok: false, source_errors: null, note: `exception: ${message}`,
  };
}
