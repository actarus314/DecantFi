// Exécute UN tick : prix 1× (injecté aux sondes pour comparabilité), quote() par sonde, assemble les lignes.
// Aucune I/O DB. Renvoie un TickInsert + ses QuoteInsert (prêts pour db.insertTickWithQuotes).
import { BLND } from '../core/assets.js';
import { priceImpactPct, targetUsdPerUnit, type Prices } from '../core/prices.js';
import type { QuoteResult, QuoteOptions, EngineConfig } from '../core/engine.js';
import type { NormalizedQuote } from '../core/sources/types.js';
import type { TickInsert, QuoteInsert } from '../db/index.js';
import type { CollectorConfig } from './config.js';
import type { Probe } from './probes.js';

export interface TickDeps {
  probes: Probe[];
  cfg: CollectorConfig;
  now: () => Date;
  fetchPrices: (opts: { timeoutMs?: number }) => Promise<Prices>;
  quote: (opts: QuoteOptions) => Promise<QuoteResult>;
}

export interface TickAssembled { tick: TickInsert; quotes: QuoteInsert[]; }

function bigIntJson(_k: string, v: unknown): unknown {
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
    const impact = priceImpactPct(probe.amountIn, v.netEurc, prices.blndUsd, targetUsdPerUnit('EURC', prices));
    const win = eurc.winner === 'via-usdc';
    rows.push({
      pair: probe.pair, amount_in: probe.amountIn, source_id: `${v.leg1.source}+${v.leg2.source}`,
      net_out: v.netEurc, net_confidence: 'estimate', price_impact_pct: impact ?? null,
      gas_in_target: v.leg1.gasInTarget + v.leg2.gasInTarget, fee_total: null, // composite : gas des 2 legs
      route_summary: `${v.leg1.source}:BLND->USDC | ${v.leg2.source}:USDC->EURC`,
      is_winner: win, eurc_path: 'via-usdc', raw_json: JSON.stringify(eurc, bigIntJson),
    });
  }
  return rows;
}

export async function runTick(deps: TickDeps): Promise<TickAssembled> {
  const startedAt = deps.now();
  const prices = await deps.fetchPrices({ timeoutMs: deps.cfg.timeoutMs });

  const sourceCfg: EngineConfig = {
    rpcUrl: deps.cfg.rpcUrl, horizonUrl: deps.cfg.horizonUrl,
    soroswapApiKey: deps.cfg.soroswapApiKey, walletAddress: deps.cfg.walletAddress,
    timeoutMs: deps.cfg.timeoutMs, prices, // <- prix injecté : 1 seul fetch, comparabilité préservée
    // Cache RPC partagé par les 4 sondes du tick : coalesce les lectures de pools identiques
    // (sondes EURC × 3 sous-cotations re-lisent les mêmes pools) → ~180 → ~30 appels RPC/tick,
    // supprime les 429 du RPC public. Neuf à chaque tick (réserves fraîches).
    rpcCache: new Map(),
  };

  const quotes: QuoteInsert[] = [];
  const reasons = new Map<string, string>(); // id → cause (timeout/http/indisponible)
  for (const probe of deps.probes) {
    const result = await deps.quote({ sell: BLND, buy: probe.buy, amountIn: probe.amountIn, cfg: sourceCfg });
    for (const e of result.errors) {
      if (!reasons.has(e)) reasons.set(e, result.errorReasons?.[e] ?? 'indisponible');
    }
    quotes.push(...rowsForProbe(probe, result, prices));
  }

  const finishedAt = deps.now();
  const tick: TickInsert = {
    started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), cadence_sec: deps.cfg.cadenceSec,
    blnd_usd: prices.blndUsd, xlm_usd: prices.xlmUsd, eur_usd: prices.eurUsd,
    ok: quotes.some((q) => q.net_out !== null && q.net_out > 0n),
    source_errors: reasons.size > 0
      ? JSON.stringify([...reasons].map(([id, reason]) => ({ id, reason })))
      : null,
    note: null,
  };
  return { tick, quotes };
}

/** Tick d'échec (exception inattendue) : ligne ok=false avec note, zéro quote. Spec §7 — le trou reste visible. */
export function failedTick(cfg: { cadenceSec: number }, startedAt: Date, finishedAt: Date, message: string): TickInsert {
  return {
    started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(), cadence_sec: cfg.cadenceSec,
    blnd_usd: null, xlm_usd: null, eur_usd: null, ok: false, source_errors: null, note: `exception: ${message}`,
  };
}
