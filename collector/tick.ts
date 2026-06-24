// Exécute UN tick : prix 1× (injecté aux sondes pour comparabilité), quote() par sonde, assemble les lignes.
// Aucune I/O DB. Renvoie un TickInsert + ses QuoteInsert (prêts pour db.insertTickWithQuotes).
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
  /** Injection de fakes pour les sims Aquarius/xBull (tests uniquement). */
  resimDeps?: { simulateAquariusNet?: typeof simulateAquariusNet; simulateXbullNet?: typeof simulateXbullNet };
  /** Injection de fake pour la sélection RPC (tests uniquement). */
  selectRpc?: (urls: string[], timeoutMs: number) => Promise<RpcSelection>;
}

export interface TickAssembled { tick: TickInsert; quotes: QuoteInsert[]; rpcProbes: RpcProbeInsert[]; }

export function bigIntJson(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v;
}

/** Résumé de route compact : "BLND->XLM->USDC" (ou "BLND->USDC" si pas de hops). */
function routeSummary(q: NormalizedQuote): string {
  if (q.route.length === 0) return `${q.sellAsset.symbol}->${q.buyAsset.symbol}`;
  return [q.route[0]!.sell, ...q.route.map((h) => h.buy)].join('->');
}

/** Somme des frais exprimés dans l'asset cible, sinon null. */
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

/** Construit les QuoteInsert d'une sonde à partir du QuoteResult de l'engine. */
function rowsForProbe(probe: Probe, result: QuoteResult, prices: Prices): QuoteInsert[] {
  const rows: QuoteInsert[] = [];
  const isEurc = probe.buy.symbol === 'EURC';

  if (!isEurc) {
    result.ranking.ranked.forEach((q, i) => rows.push(rowFromQuote(probe.pair, probe.amountIn, q, i === 0, null)));
    return rows;
  }

  // EURC : pas de paire native → lignes "direct" (atomiques, multi-hop interne) + 1 composite via-usdc.
  // is_winner posé POSITIONNELLEMENT : ranked[0] = meilleur direct (rankQuotes trie netOut desc).
  // NE JAMAIS comparer q.netOut === eurc.bestNetEurc : ranking (fetch principal) et eurc (compareEurc)
  // viennent de DEUX appels réseau distincts → l'égalité bigint échouerait presque toujours.
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
      gas_in_target: v.leg1.gasInTarget + v.leg2.gasInTarget, fee_total: null, // composite : gas des 2 legs
      route_summary: `${v.leg1.source}:BLND->USDC | ${v.leg2.source}:USDC->EURC`,
      is_winner: win, eurc_path: 'via-usdc', raw_json: JSON.stringify(eurc, bigIntJson),
      duration_ms: null, // composite 2-tx : pas de durée atomique mesurable
    });
  }
  return rows;
}

export async function runTick(deps: TickDeps): Promise<TickAssembled> {
  const startedAt = deps.now();

  // Sélection du meilleur RPC : best-effort, un échec ne casse jamais le tick.
  let sel: RpcSelection = { chosen: deps.cfg.rpcUrl, probes: [] };
  resetRpc();
  try {
    sel = await (deps.selectRpc ?? selectRpc)(deps.cfg.rpcUrls, deps.cfg.timeoutMs);
  } catch { /* repli silencieux : rpcUrl par défaut */ }
  const rpcUrl = sel.chosen || deps.cfg.rpcUrl;

  const prices = await deps.fetchPrices({ timeoutMs: deps.cfg.timeoutMs, horizonUrl: deps.cfg.horizonUrl });

  const sourceCfg: EngineConfig = {
    rpcUrl, horizonUrl: deps.cfg.horizonUrl,
    soroswapApiKey: deps.cfg.soroswapApiKey, stellarBrokerApiKey: deps.cfg.stellarBrokerApiKey,
    walletAddress: deps.cfg.walletAddress,
    timeoutMs: deps.cfg.timeoutMs, prices, // <- prix injecté : 1 seul fetch, comparabilité préservée
    // Cache RPC partagé par les 4 sondes du tick : coalesce les lectures de pools identiques
    // (sondes EURC × 3 sous-cotations re-lisent les mêmes pools) → ~180 → ~30 appels RPC/tick,
    // supprime les 429 du RPC public. Neuf à chaque tick (réserves fraîches).
    rpcCache: new Map(),
    // Re-simulation honnête des jambes EURC via-USDC : idem liveQuote, best-effort.
    reSimLeg: makeReSimLeg({ rpcUrl }, deps.resimDeps),
  };

  // Parallélisation : toutes les sondes partent en même temps (Promise.all).
  // Chaque tâche retourne ses rows + erreurs ; la fusion est faite après (ordre déterministe = ordre deps.probes).
  type ProbeResult = { rows: QuoteInsert[]; errors: Array<[string, string]>; resimErrors: number };

  const probeResults = await Promise.all(deps.probes.map(async (probe): Promise<ProbeResult> => {
    const result = await deps.quote({ sell: BLND, buy: probe.buy, amountIn: probe.amountIn, cfg: sourceCfg });
    const localErrors: Array<[string, string]> = [];
    for (const e of result.errors) {
      localErrors.push([e, result.errorReasons?.[e] ?? 'indisponible']);
    }

    // Re-simulation Aquarius + xBull : remplace les nets sur-cotés et décode la route xBull,
    // pour que la DB stocke les vrais fills simulés (pas les cotes API sur-cotées).
    // Best-effort : un échec RPC (429, timeout) ne casse jamais le tick.
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

  // Fusion dans l'ordre de deps.probes (déterministe).
  const quotes: QuoteInsert[] = [];
  const reasons = new Map<string, string>(); // id → cause (timeout/http/indisponible)
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

  // Comptage sim_errors par URL RPC (429, rate-limit, timeout, ECONNRESET).
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

/** Tick d'échec (exception inattendue) : ligne ok=false avec note, zéro quote. Spec §7 — le trou reste visible. */
export function failedTick(cfg: { cadenceSec: number }, startedAt: Date, finishedAt: Date, message: string): TickInsert {
  return {
    started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), cadence_sec: cfg.cadenceSec,
    blnd_usd: null, xlm_usd: null, eurc_usd: null, eurc_stellar_mid: null, ok: false, source_errors: null, note: `exception: ${message}`,
  };
}
