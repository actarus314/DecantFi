// Statistiques lues depuis la DB pour l'UI web. Fonctions pures (db en param).
// Fenêtre = 7 jours. Timezone : agrégation serveur UTC, conversion côté client.
// ponytail: Number = affichage, jamais règlement.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type DatabaseSync } from 'node:sqlite';
import { prepBig, readCoherenceProbes, readExecMsBySource, readTickWallClocks } from './read-db.js';
import { toNumber } from '../core/amount.js';
import { priceImpactPct } from '../core/prices.js';
import { ACTIVE_SOURCE_IDS } from '../core/sources/index.js';
import type { CollectorConfig } from '../collector/config.js';

// ─── Types publics ───────────────────────────────────────────────────────────

export type Chip = 'obs' | 'est';

export interface LadderRow {
  display: string;
  sourceId: string;
  note: string;
  route: string;
  net: number;
  deltaVsWinner: number;
  chip: Chip;
  impactPct: number | null;
  impactLocalPct: number | null;
  winner: boolean;
  /** Floor (direct route guaranteed minimum) in target asset units. StellarBroker only; absent for DB rows. */
  floor?: number;
}

export interface Meta {
  lastTickAt: string | null;
  cadenceSec: number;
  nTicks: number;
  nTicksOk: number;
  blndUsd: number | null;
  eurcUsd: number | null;
  xlmUsd: number | null;
  windowDays: 7;
  /** Sondes configurées (COLLECTOR_SIZES_BLND), en BLND entiers, triées croissant. */
  sondes: number[];
  /** Prévision daemon du prochain relevé prêt (ISO) ; null/absent si indispo (boot, collecteur ancien). */
  nextTickAt?: string | null;
}

/** Une route distincte (chemin + outils) classée par fréquence de victoire sur la fenêtre. */
export interface RouteRank {
  path: string;   // ex. 'BLND→USDC→EURC'
  tools: string;  // ex. 'xBull + Ultra'
  wins: number;
  winPct: number;
  marginPct: number | null;  // marge au 2ᵉ : médiane sur les ticks gagnés de (net_gagnant−net_2ᵉ)/net_gagnant ×100 ; null si non calculable
  trend: 'up' | 'down' | 'flat' | null;  // évolution : part de victoires sur la 2e moitié de la fenêtre vs la 1ère ; null si données insuffisantes
  trendMag: number | null;  // magnitude signée de l'évolution (Δ part-de-victoires 2e moitié − 1ère) ; sert au tableau à distinguer fort/léger ; null si données insuffisantes
}

export interface Overview {
  meta: Meta;
  /** Échelles du dernier tick ok, une par sonde (clé = BLND entier, ex. '250'). */
  ladders: Record<string, LadderRow[]>;
  /** Distribution des gagnants par sonde (clé = BLND entier). */
  winnerDist: Record<string, Array<{ display: string; pct: number; sourceId: string }>>;
  /** Meilleures routes (chemins gagnants) sur 7 j, par sonde (clé = BLND entier). */
  bestRoutes: Record<string, RouteRank[]>;
  /** 7×24 efficience moyenne brute par (dow, hour) UTC — pour la moyenne/jour normalisée du prix. Clé = sonde en string (ex. '250'/'750'). */
  heatEffUtc: Record<string, (number | null)[][]>;
  /** Trace intraday 15 min par sonde. Clé = sonde. Valeur = 7×96, indexé par jour-de-semaine 0=Lun..6=Dim, chaque ligne = la trace de SA date locale. */
  intradayLocal: Record<string, (number | null)[][]>;
  /** Moyenne plate 7 j de l'efficience par sonde. */
  effWeekAvg: Record<string, number | null>;
  /** Série Stellar (oracle = eurc_stellar_mid) — même structure que heatEffUtc ; null si mid absent. */
  heatEffUtcStellar: Record<string, (number | null)[][]>;
  /** Série Stellar intraday 15 min — même structure que intradayLocal ; trous honnêtes où mid absent. */
  intradayStellar: Record<string, (number | null)[][]>;
  /** Moyenne plate 7 j de l'efficience Stellar par sonde ; null si aucune donnée mid. */
  effWeekAvgStellar: Record<string, number | null>;
}

// ─── Mappings display / note / chip ──────────────────────────────────────────

const DISPLAY_NAME: Record<string, string> = {
  xbull: 'xBull',
  soroswap: 'Soroswap',
  aquarius: 'Aquarius',
  comet: 'Comet',
  ultrastellar: 'Ultra Stellar',
  stellarbroker: 'StellarBroker',
  horizon: 'Horizon',
};

export function displayName(sourceId: string): string {
  if (sourceId.includes('+')) {
    return sourceId
      .split('+')
      .map((s) => DISPLAY_NAME[s.trim()] ?? s.trim())
      .join(' + ');
  }
  return DISPLAY_NAME[sourceId] ?? sourceId;
}

export function noteFor(_sourceId: string, _winner: boolean, _eurcPath: string | null): string {
  // Plus aucune annotation de ligne (l'annotation « multi-tx » de la route composite a été retirée).
  return '';
}

export function chipFor(netConfidence: string): Chip {
  if (netConfidence === 'exact') return 'obs';
  return 'est';
}

// xBull route now decoded from sim (collector + live) → affichée telle quelle, plus de masque.
// ponytail: gardé comme seam pour les 3 appelants.
export function maskedRoute(path: string, _sourceId: string): string {
  return path;
}

/** route_summary DB → chaîne lisible. "BLND->XLM->USDC" → "BLND→XLM→USDC" ;
 *  composite "a:BLND->USDC | b:USDC->EURC" → "BLND→USDC→EURC" (nœud USDC fusionné). */
export function prettyRoute(summary: string): string {
  if (!summary) return '';
  if (summary.includes('|')) {
    const chain: string[] = [];
    for (const seg of summary.split('|')) {
      const path = seg.includes(':') ? seg.slice(seg.indexOf(':') + 1) : seg;
      for (const raw of path.split('->').map((x) => x.trim()).filter(Boolean)) {
        const node = raw === 'native' ? 'XLM' : raw;
        if (chain[chain.length - 1] !== node) chain.push(node);
      }
    }
    return chain.join(' → ');
  }
  return summary.split('->').map((x) => x.trim()).filter(Boolean).map((n) => (n === 'native' ? 'XLM' : n)).join(' → ');
}

// ─── Médiane ────────────────────────────────────────────────────────────────────

/**
 * Médiane d'un tableau de nombres (ne modifie pas l'original).
 * Pair : moyenne des deux valeurs centrales. Vide : null.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ─── Mapping DB pair ─────────────────────────────────────────────────────────

function dbPair(pairUi: string): string {
  return pairUi === 'EURC' ? 'BLND->EURC' : 'BLND->USDC';
}

// ─── Efficience d'un tick ─────────────────────────────────────────────────────

interface TickRow {
  blnd_usd: number | null;
  eurc_usd: number | null;
}

/** eff = (net_out_units / amount_in_BLND_units) / spot_cible_par_BLND */
export function effOf(
  netOut: bigint,
  amountIn: bigint,
  pairUi: string,
  tick: TickRow,
): number | null {
  if (netOut <= 0n || amountIn <= 0n) return null;
  const net = toNumber(netOut);
  const amt = toNumber(amountIn);
  const blndUsd = tick.blnd_usd;
  if (!blndUsd || blndUsd <= 0) return null;
  const spot = pairUi === 'EURC'
    ? (tick.eurc_usd && tick.eurc_usd > 0 ? blndUsd / tick.eurc_usd : null)
    : blndUsd;
  if (!spot || spot <= 0) return null;
  return (net / amt) / spot;
}

// ─── Dernière tick ok — échelle ──────────────────────────────────────────────

function buildLadder(db: DatabaseSync, pair: string, amountIn: bigint): LadderRow[] {
  // Trouve le dernier tick ok
  const lastTickStmt = prepBig(db, `
    SELECT id, eurc_stellar_mid, blnd_usd FROM tick WHERE ok = 1 ORDER BY started_at DESC LIMIT 1
  `);
  const lastTickRows = lastTickStmt.all() as Array<Record<string, unknown>>;
  const lastTickRow = lastTickRows[0];
  if (!lastTickRow) return [];
  const tickId = lastTickRow['id'] as bigint;
  const blndUsdTick = lastTickRow['blnd_usd'] != null ? Number(lastTickRow['blnd_usd']) : null;
  const eurcStellarMid = lastTickRow['eurc_stellar_mid'] != null ? Number(lastTickRow['eurc_stellar_mid']) : null;
  const isEurc = pair.includes('EURC');

  const stmt = prepBig(db, `
    SELECT q.source_id, q.net_out, q.net_confidence, q.price_impact_pct, q.is_winner, q.eurc_path, q.route_summary
    FROM quote q
    WHERE q.tick_id = ? AND q.pair = ? AND q.amount_in = ?
    ORDER BY q.net_out DESC
  `);
  const rows = stmt.all(tickId, pair, amountIn) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  // Gagnant = meilleur net (ou is_winner=1)
  const winnerNet = rows[0]!['net_out'] as bigint | null;
  if (!winnerNet || winnerNet <= 0n) return [];

  return rows.map((r) => {
    const netRaw = r['net_out'] as bigint | null;
    const net = netRaw ? toNumber(netRaw) : 0;
    const winNet = toNumber(winnerNet);
    const deltaVsWinner = net - winNet;
    const isWinner = r['is_winner'] === 1n || r['is_winner'] === 1;
    const sourceId = String(r['source_id'] ?? '');
    const netConf = String(r['net_confidence'] ?? 'estimate');
    const eurcPath = r['eurc_path'] != null ? String(r['eurc_path']) : null;
    const impactRaw = r['price_impact_pct'];
    const impactPct = (impactRaw != null && impactRaw !== undefined) ? Number(impactRaw) : null;
    const perUnitLocal: number | null = isEurc ? eurcStellarMid : 1;
    const impactLocalPct = netRaw && netRaw > 0n
      ? (priceImpactPct(amountIn, netRaw, blndUsdTick, perUnitLocal) ?? null)
      : null;

    return {
      display: displayName(sourceId),
      sourceId,
      note: noteFor(sourceId, isWinner, eurcPath),
      route: maskedRoute(prettyRoute(r['route_summary'] != null ? String(r['route_summary']) : ''), sourceId),
      net,
      deltaVsWinner,
      chip: chipFor(netConf),
      impactPct,
      impactLocalPct,
      winner: isWinner,
    };
  });
}

// ─── Distribution gagnants (7 j) ─────────────────────────────────────────────

function buildWinnerDist(
  db: DatabaseSync,
  pair: string,
  windowStart: string,
  amountIn?: bigint,
): Array<{ display: string; pct: number; sourceId: string }> {
  const stmt = prepBig(db, `
    SELECT q.source_id, COUNT(*) as cnt
    FROM quote q JOIN tick t ON t.id = q.tick_id
    WHERE q.is_winner = 1 AND q.pair = ? AND t.ok = 1 AND t.started_at >= ?${amountIn != null ? ' AND q.amount_in = ?' : ''}
    GROUP BY q.source_id
    ORDER BY cnt DESC
  `);
  const rows = (amountIn != null ? stmt.all(pair, windowStart, amountIn) : stmt.all(pair, windowStart)) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  let total = 0n;
  for (const r of rows) total += r['cnt'] as bigint;
  if (total === 0n) return [];

  return rows.map((r) => ({
    display: displayName(String(r['source_id'] ?? '')),
    pct: Math.round((Number(r['cnt'] as bigint) / Number(total)) * 1000) / 10,
    sourceId: String(r['source_id'] ?? ''),
  }));
}

// ─── Meilleures routes (7 j) ──────────────────────────────────────────────────

/** Classe les chemins gagnants distincts (source_id + route) par nombre de victoires sur la fenêtre. */
function buildBestRoutes(db: DatabaseSync, pair: string, windowStart: string, amountIn?: bigint): RouteRank[] {
  const stmt = prepBig(db, `
    SELECT q.source_id, q.route_summary, COUNT(*) AS wins
    FROM quote q JOIN tick t ON t.id = q.tick_id
    WHERE q.is_winner = 1 AND q.pair = ? AND t.ok = 1 AND t.started_at >= ?${amountIn != null ? ' AND q.amount_in = ?' : ''}
    GROUP BY q.source_id, q.route_summary
    ORDER BY wins DESC
  `);
  const rows = (amountIn != null ? stmt.all(pair, windowStart, amountIn) : stmt.all(pair, windowStart)) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  let total = 0n;
  for (const r of rows) total += r['wins'] as bigint;
  const totalNum = Number(total);
  if (totalNum === 0) return [];

  // ─── Marge au 2ᵉ : pour chaque tick gagné par la route, (net_gagnant − net_2ᵉ)/net_gagnant ×100 ;
  // médiane par (source_id, route_summary). net_2ᵉ = meilleur net parmi les AUTRES cotations du tick
  // (rowid != → vrai 2ᵉ ; révèle aussi un is_winner qui ne serait pas le max net = marge négative).
  const mStmt = prepBig(db, `
    SELECT q.source_id, q.route_summary, q.net_out AS win_net,
      (SELECT MAX(q2.net_out) FROM quote q2
        WHERE q2.tick_id = q.tick_id AND q2.pair = q.pair AND q2.amount_in = q.amount_in AND q2.rowid != q.rowid) AS second_net
    FROM quote q JOIN tick t ON t.id = q.tick_id
    WHERE q.is_winner = 1 AND q.pair = ? AND t.ok = 1 AND t.started_at >= ?${amountIn != null ? ' AND q.amount_in = ?' : ''}
  `);
  const mRows = (amountIn != null ? mStmt.all(pair, windowStart, amountIn) : mStmt.all(pair, windowStart)) as Array<Record<string, unknown>>;
  const marginSamples = new Map<string, number[]>();
  for (const r of mRows) {
    const winNet = r['win_net'] as bigint | null;
    const secondNet = r['second_net'] as bigint | null;
    if (winNet == null || secondNet == null || winNet <= 0n) continue;
    const wn = toNumber(winNet);
    if (wn <= 0) continue;
    const margin = ((wn - toNumber(secondNet)) / wn) * 100;
    const key = String(r['source_id'] ?? '') + ' ' + String(r['route_summary'] ?? '');
    let arr = marginSamples.get(key);
    if (!arr) { arr = []; marginSamples.set(key, arr); }
    arr.push(margin);
  }
  const marginFor = (sourceId: string, routeSummary: string): number | null => {
    const arr = marginSamples.get(sourceId + ' ' + routeSummary);
    if (!arr || arr.length === 0) return null;
    const med = median(arr);
    return med == null ? null : Math.round(med * 100) / 100;
  };

  // ─── Évolution de la Fréquence : part de victoires 2e moitié de la fenêtre vs 1ère.
  // mid = timestamp médian PRIS DANS la DB (format identique → comparaison string sûre).
  const tStmt = prepBig(db, `
    SELECT DISTINCT t.started_at AS sa
    FROM quote q JOIN tick t ON t.id = q.tick_id
    WHERE q.is_winner = 1 AND q.pair = ? AND t.ok = 1 AND t.started_at >= ?${amountIn != null ? ' AND q.amount_in = ?' : ''}
    ORDER BY t.started_at
  `);
  const times = (amountIn != null ? tStmt.all(pair, windowStart, amountIn) : tStmt.all(pair, windowStart)).map((x) => String((x as Record<string, unknown>)['sa']));
  const trendMap = new Map<string, number>();  // clé → magnitude signée d (Δ part-de-victoires) ; le sens up/down/flat ET la force en dérivent
  if (times.length >= 4) {
    const mid = times[Math.floor(times.length / 2)]!;
    const hStmt = prepBig(db, `
      SELECT q.source_id, q.route_summary,
        SUM(CASE WHEN t.started_at >= ? THEN 1 ELSE 0 END) AS rec,
        SUM(CASE WHEN t.started_at <  ? THEN 1 ELSE 0 END) AS old
      FROM quote q JOIN tick t ON t.id = q.tick_id
      WHERE q.is_winner = 1 AND q.pair = ? AND t.ok = 1 AND t.started_at >= ?${amountIn != null ? ' AND q.amount_in = ?' : ''}
      GROUP BY q.source_id, q.route_summary
    `);
    const hRows = (amountIn != null ? hStmt.all(mid, mid, pair, windowStart, amountIn) : hStmt.all(mid, mid, pair, windowStart)) as Array<Record<string, unknown>>;
    let totRec = 0, totOld = 0;
    for (const x of hRows) { totRec += Number(x['rec'] as bigint); totOld += Number(x['old'] as bigint); }
    if (totRec > 0 && totOld > 0) {
      for (const x of hRows) {
        const d = Number(x['rec'] as bigint) / totRec - Number(x['old'] as bigint) / totOld;
        trendMap.set(String(x['source_id'] ?? '') + ' ' + String(x['route_summary'] ?? ''), d);
      }
    }
  }
  const dOf = (sourceId: string, routeSummary: string): number | undefined => trendMap.get(sourceId + ' ' + routeSummary);
  const trendOf = (sourceId: string, routeSummary: string): 'up' | 'down' | 'flat' | null => {
    const d = dOf(sourceId, routeSummary);
    return d === undefined ? null : d > 0.02 ? 'up' : d < -0.02 ? 'down' : 'flat';
  };
  const trendMagOf = (sourceId: string, routeSummary: string): number | null => {
    const d = dOf(sourceId, routeSummary);
    return d === undefined ? null : Math.round(d * 1000) / 1000;
  };

  return rows.map((r) => {
    const wins = Number(r['wins'] as bigint);
    const sourceId = String(r['source_id'] ?? '');
    const routeSummary = r['route_summary'] != null ? String(r['route_summary']) : '';
    return {
      path: maskedRoute(prettyRoute(routeSummary), sourceId),
      tools: displayName(sourceId),
      wins,
      winPct: Math.round((wins / totalNum) * 1000) / 10,
      marginPct: marginFor(sourceId, routeSummary),
      trend: trendOf(sourceId, routeSummary),
      trendMag: trendMagOf(sourceId, routeSummary),
    };
  });
}

// ─── Efficience horaire / heatmap ─────────────────────────────────────────────

interface WinnerEffRow {
  hour_utc: number;     // 0-23
  dow_utc: number;      // 0=Lun … 6=Dim
  eff: number;
  effStellar: number | null;  // oracle Stellar (eurc_stellar_mid) ; null si mid absent
  startedAtMs: number;  // ms epoch UTC
}

/** Agrège l'efficience du gagnant par bucket (dow+hour UTC) sur 7 j. */
function fetchWinnerEffRows(
  db: DatabaseSync,
  pair: string,
  amountIn: bigint,
  windowStart: string,
  pairUi: string,
): WinnerEffRow[] {
  const stmt = prepBig(db, `
    SELECT t.started_at, t.blnd_usd, t.eurc_usd, t.eurc_stellar_mid, q.net_out, q.amount_in as q_amount_in
    FROM quote q JOIN tick t ON t.id = q.tick_id
    WHERE q.is_winner = 1 AND q.pair = ? AND q.amount_in = ?
      AND t.ok = 1 AND t.started_at >= ?
    ORDER BY t.started_at
  `);
  const rows = stmt.all(pair, amountIn, windowStart) as Array<Record<string, unknown>>;

  const result: WinnerEffRow[] = [];
  for (const r of rows) {
    const startedAt = String(r['started_at'] ?? '');
    const d = new Date(startedAt);
    if (isNaN(d.getTime())) continue;
    const hourUtc = d.getUTCHours();
    const dowUtc = (d.getUTCDay() + 6) % 7; // 0=Lun … 6=Dim

    const netOut = r['net_out'] as bigint | null;
    const qAmountIn = r['q_amount_in'] as bigint;
    const blndUsd = r['blnd_usd'] != null ? Number(r['blnd_usd']) : null;
    const eurcUsd = r['eurc_usd'] != null ? Number(r['eurc_usd']) : null;
    const eurcStellarMid = r['eurc_stellar_mid'] != null ? Number(r['eurc_stellar_mid']) : null;

    if (!netOut || netOut <= 0n || qAmountIn <= 0n) continue;
    const eff = effOf(netOut, qAmountIn, pairUi, { blnd_usd: blndUsd, eurc_usd: eurcUsd });
    if (eff === null) continue;

    // Série Stellar : oracle = eurc_stellar_mid (null si mid absent → trou honnête)
    const effStellar = effOf(netOut, qAmountIn, pairUi, { blnd_usd: blndUsd, eurc_usd: eurcStellarMid });

    result.push({ hour_utc: hourUtc, dow_utc: dowUtc, eff, effStellar, startedAtMs: d.getTime() });
  }
  return result;
}

/** 7×24 efficience moyenne brute par (dow, hour) UTC — sert la moyenne/jour normalisée du prix.
 *  @param pick  accesseur de la valeur à agréger ; les valeurs null/undefined sont ignorées (trou honnête).
 */
function buildHeatEffUtc(
  rows: WinnerEffRow[],
  pick: (r: WinnerEffRow) => number | null | undefined = (r) => r.eff,
): (number | null)[][] {
  const buckets: number[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => []),
  );
  for (const r of rows) {
    const val = pick(r);
    if (val == null || !Number.isFinite(val)) continue;
    const dayBucket = buckets[r.dow_utc];
    if (dayBucket) {
      const hourBucket = dayBucket[r.hour_utc];
      if (hourBucket) hourBucket.push(val);
    }
  }
  return buckets.map((day) =>
    day.map((b) => (b.length === 0 ? null : b.reduce((a, x) => a + x, 0) / b.length)),
  );
}

// ─── Offset Paris ─────────────────────────────────────────────────────────────

export function parisOffsetHours(now: Date): number {
  const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((paris.getTime() - utc.getTime()) / 3600000);
}

// ─── Intraday local 15 min ─────────────────────────────────────────────────────

/**
 * Construit une grille 7×96 (dow × slot-15min) sourcée par DATE calendaire locale.
 *
 * Chaque ligne i correspond au jour-de-semaine du i-ième jour le plus récent (i=0 = aujourd'hui).
 * On ne mélange JAMAIS deux occurrences du même jour-de-semaine : on prend uniquement la date la
 * plus récente de ce dow (donc la semaine courante, pas la semaine d'avant).
 *
 * // ponytail: décalage unique au moment `now` pour les 7 jours — le jour de bascule DST (2×/an)
 * // est légèrement décalé, acceptable.
 */
export function buildIntradayLocal(
  rows: WinnerEffRow[],
  offsetH: number,
  now: Date,
  pick: (r: WinnerEffRow) => number | null | undefined = (r) => r.eff,
): (number | null)[][] {
  // Étape 1 : déterminer les 7 dates locales les plus récentes (i=0 = aujourd'hui, i=6 = il y a 6 j)
  // Pour obtenir l'heure/date locale : localMs = utcMs + offsetH*3_600_000, puis getUTC* sur ce Date.
  const MS_PER_DAY = 86_400_000;

  // Compute "today's local date" by shifting now by offsetH hours
  const nowMs = now.getTime();

  // Map: dateKey (YYYY-MM-DD local) → dow (0=Lun..6=Dim)
  const dateToDow = new Map<string, number>();
  // Map: dateKey → row index in result (0=most recent .. 6=oldest)
  const dateToResultIdx = new Map<string, number>();

  for (let i = 0; i < 7; i++) {
    const shiftedMs = nowMs - i * MS_PER_DAY + offsetH * 3_600_000;
    const d = new Date(shiftedMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${day}`;
    const jsDay = d.getUTCDay(); // 0=Sun..6=Sat
    const dow = (jsDay + 6) % 7; // 0=Lun..6=Dim

    // Only store first occurrence (most recent) for each dow
    if (!dateToDow.has(dateKey)) {
      dateToDow.set(dateKey, dow);
      dateToResultIdx.set(dateKey, i);
    }
  }

  // Étape 2 : regrouper les eff par (dateKey, slot)
  // slot = hour*4 + floor(minutes/15), 0..95
  type SlotMap = Map<number, number[]>;
  const byDate = new Map<string, SlotMap>();

  for (const row of rows) {
    const localMs = row.startedAtMs + offsetH * 3_600_000;
    const d = new Date(localMs);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    const dateKey = `${y}-${mo}-${dy}`;

    // Only include rows whose date is among our 7 target dates
    if (!dateToDow.has(dateKey)) continue;

    const hour = d.getUTCHours();
    const min = d.getUTCMinutes();
    const slot = hour * 4 + Math.floor(min / 15);

    let slotMap = byDate.get(dateKey);
    if (!slotMap) {
      slotMap = new Map<number, number[]>();
      byDate.set(dateKey, slotMap);
    }
    let slotArr = slotMap.get(slot);
    if (!slotArr) {
      slotArr = [];
      slotMap.set(slot, slotArr);
    }
    const val = pick(row);
    if (val == null || !Number.isFinite(val)) continue;
    slotArr.push(val);
  }

  // Étape 3 : construire la grille résultat 7×96 (indexée par dow)
  const result: (number | null)[][] = Array.from({ length: 7 }, () =>
    new Array<number | null>(96).fill(null),
  );

  for (const [dateKey, dow] of dateToDow.entries()) {
    const slotMap = byDate.get(dateKey);
    if (!slotMap) continue;
    const row = result[dow];
    if (!row) continue;
    for (const [slot, effs] of slotMap.entries()) {
      if (effs.length === 0) continue;
      row[slot] = effs.reduce((a, x) => a + x, 0) / effs.length;
    }
  }

  return result;
}

// ─── Meta ──────────────────────────────────────────────────────────────────────

function buildMeta(db: DatabaseSync, cadenceSec: number, sondes: number[]): Meta {
  const cntStmt = prepBig(db, `SELECT COUNT(*) as n FROM tick`);
  const cntOkStmt = prepBig(db, `SELECT COUNT(*) as n FROM tick WHERE ok = 1`);
  const lastStmt = prepBig(db,
    `SELECT started_at, blnd_usd, xlm_usd, eurc_usd FROM tick WHERE ok = 1 ORDER BY started_at DESC LIMIT 1`);

  const cntRow = (cntStmt.all() as Array<Record<string, unknown>>)[0];
  const cntOkRow = (cntOkStmt.all() as Array<Record<string, unknown>>)[0];
  const lastRow = (lastStmt.all() as Array<Record<string, unknown>>)[0];

  return {
    lastTickAt: lastRow ? String(lastRow['started_at'] ?? '') : null,
    cadenceSec,
    nTicks: cntRow ? Number(cntRow['n'] as bigint) : 0,
    nTicksOk: cntOkRow ? Number(cntOkRow['n'] as bigint) : 0,
    blndUsd: lastRow?.['blnd_usd'] != null ? Number(lastRow['blnd_usd']) : null,
    eurcUsd: lastRow?.['eurc_usd'] != null ? Number(lastRow['eurc_usd']) : null,
    xlmUsd: lastRow?.['xlm_usd'] != null ? Number(lastRow['xlm_usd']) : null,
    windowDays: 7,
    sondes,
  };
}

function readNextTickAt(dbPath: string): string | null {
  try {
    const v = readFileSync(join(dirname(dbPath), '.next_tick'), 'utf8').trim();
    return v && !Number.isNaN(Date.parse(v)) ? v : null;
  } catch {
    return null; // fichier absent (boot, collecteur ancien) ou illisible → le front retombe sur l'estimation
  }
}

// ─── Santé des sources (7 j) ─────────────────────────────────────────────────

export interface SourceHealth {
  id: string;
  display: string;
  respondedTicks: number;        // ticks avec ≥1 cotation (toutes tailles)
  failedTicks: number;           // ticks où ≥1 sonde de la source a échoué (présence dans source_errors)
  uptimePct: number;             // global : % ticks avec ≥1 cotation
  lastFailureAt: string | null;  // ISO ou null
  lastFailureReason: string | null; // rate-limit / timeout / rpc / simulation / http / null
  days: Array<'ok' | 'warn' | 'bad' | null>;  // 7 entrées, index 0 = le plus récent
  pairNote: string | null;       // ex. 'USDC uniquement' pour comet
  /** Agrégat des sondes de cohérence (quote vs sim) sur la fenêtre. */
  coherence: {
    tests: number;                 // total sondes
    suspects: number;              // sondes incoherent=true
    lastSuspectAt: string | null;  // max(created_at) parmi les suspectes
  };
  /** Tendance de disponibilité : comparaison fenêtre courante vs précédente (7 j vs 7 j d'avant). */
  uptimeTrend: 'up' | 'down' | 'flat';
  /** Durée médiane de cotation de cette source sur la fenêtre 7 j (ms). null = aucune mesure. */
  execMs: number | null;
}

export interface RpcHealth {
  // PAS de `url` complète ici : cet objet est sérialisé tel quel par /api/health vers le client.
  // L'URL peut contenir une clé API (ex. Validation Cloud /v1/<clé>) → on n'expose QUE le host.
  host: string;     // new URL(url).host — masque la clé API (le host exclut le path)
  active: boolean;  // chosen=1 dans le dernier tick ayant des probes
  uptimePct: number;
  latencyMsP50: number | null;
  lastLedger: number | null;
  ledgerLag: number;   // maxLedger (tous RPCs) − lastLedger de cet RPC (0 = pas de retard)
  failures: number;    // sondes ok=0
  simErrors: number;   // total sim_errors sur la fenêtre
  samples: number;     // nb de sondes dans la fenêtre
  reqTotal: number;    // total requêtes RPC vers cet endpoint sur la fenêtre (toutes kinds)
  reqPerSec: number;   // req/s moyen (SUM(calls)/SUM(dur_s)), 0 si dénominateur nul
}

export interface SourceHealthResult {
  totalTicks: number;
  windowDays: 7;
  sources: SourceHealth[];
  /** Heures écoulées dans la journée locale courante (0..24), pour le rendu du cercle partiel. */
  todayElapsedH: number;
  rpcs: RpcHealth[];
  /** Médiane du wall-clock réel d'un tick (finished_at − started_at, ms) sur la fenêtre.
   *  = temps total d'obtention du classement complet. null si aucun tick avec finished_at. */
  execTotalMs: number | null;
}

/** Parse source_errors : JSON ([{id,reason}]) ou CSV legacy ("soroswap, comet"). */
export function parseSourceErrors(raw: unknown): Array<{ id: string; reason: string | null }> {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (s === '') return [];
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s);
      if (Array.isArray(a)) return a.map((x) => ({ id: String(x.id), reason: x.reason != null ? String(x.reason) : null }));
    } catch { /* fallthrough */ }
  }
  return s.split(',').map((t) => t.trim()).filter(Boolean).map((id) => ({ id, reason: null }));
}

// ─── Santé RPC (7 j) ──────────────────────────────────────────────────────────

export function buildRpcHealth(db: DatabaseSync, windowStart: string): RpcHealth[] {
  // Toutes les sondes sur la fenêtre, tous ticks confondus (pas de filtre ok=1 — le but est de mesurer le RPC lui-même).
  const stmt = prepBig(db, `
    SELECT r.url, r.ok, r.latency_ms, r.ledger, r.chosen, r.sim_errors
    FROM rpc_probe r
    JOIN tick t ON t.id = r.tick_id
    WHERE t.started_at >= ?
    ORDER BY r.url, t.started_at
  `);
  const rows = stmt.all(windowStart) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  // Regrouper par URL
  const byUrl = new Map<string, Array<Record<string, unknown>>>();
  for (const r of rows) {
    const url = String(r['url'] ?? '');
    let arr = byUrl.get(url);
    if (!arr) { arr = []; byUrl.set(url, arr); }
    arr.push(r);
  }

  // Dernier tick ayant des probes : pour définir "active"
  const lastTickStmt = prepBig(db, `
    SELECT r.url FROM rpc_probe r
    WHERE r.tick_id = (SELECT MAX(tick_id) FROM rpc_probe)
    AND r.chosen = 1
    LIMIT 1
  `);
  const lastRows = lastTickStmt.all() as Array<Record<string, unknown>>;
  const activeUrl = lastRows[0] ? String(lastRows[0]['url'] ?? '') : null;

  // maxLedger global pour le calcul du lag
  let maxLedger = 0;
  for (const r of rows) {
    const l = r['ledger'] != null ? Number(r['ledger']) : 0;
    if (l > maxLedger) maxLedger = l;
  }

  // Charge par URL depuis rpc_call_log (toutes kinds : auto, refresh, quote).
  // Table peut ne pas encore exister (DB ancienne) → try/catch.
  const loadByUrl = new Map<string, { totalCalls: number; totalDurMs: number }>();
  try {
    const loadStmt = prepBig(db, `
      SELECT url, SUM(calls) as total_calls, SUM(dur_ms) as total_dur_ms
      FROM rpc_call_log
      WHERE at >= ?
      GROUP BY url
    `);
    const loadRows = loadStmt.all(windowStart) as Array<Record<string, unknown>>;
    for (const lr of loadRows) {
      const url = String(lr['url'] ?? '');
      const totalCalls = lr['total_calls'] != null ? Number(lr['total_calls']) : 0;
      const totalDurMs = lr['total_dur_ms'] != null ? Number(lr['total_dur_ms']) : 0;
      loadByUrl.set(url, { totalCalls, totalDurMs });
    }
  } catch { /* table absente (DB ancienne) : charge = 0 pour tous */ }

  const result: RpcHealth[] = [];
  for (const [url, probes] of byUrl.entries()) {
    const failures = probes.filter((p) => p['ok'] === 0 || p['ok'] === 0n).length;
    const okProbes = probes.filter((p) => p['ok'] === 1 || p['ok'] === 1n);
    const latencies = okProbes
      .map((p) => p['latency_ms'] != null ? Number(p['latency_ms']) : null)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const latencyMsP50 = latencies.length > 0
      ? latencies[Math.floor(latencies.length / 2)]!
      : null;
    const ledgers = okProbes.map((p) => p['ledger'] != null ? Number(p['ledger']) : null).filter((v): v is number => v !== null);
    const lastLedger = ledgers.length > 0 ? ledgers[ledgers.length - 1]! : null;
    const simErrors = probes.reduce((s, p) => s + (p['sim_errors'] != null ? Number(p['sim_errors']) : 0), 0);
    const uptimePct = probes.length > 0 ? Math.round((okProbes.length / probes.length) * 1000) / 10 : 100;
    let host: string;
    try { host = new URL(url).host; } catch { host = url; }

    const load = loadByUrl.get(url);
    const reqTotal = load?.totalCalls ?? 0;
    const totalDurSec = load != null ? load.totalDurMs / 1000 : 0;
    const reqPerSec = totalDurSec > 0 ? Math.round(reqTotal / totalDurSec) : 0;

    result.push({
      host,
      active: url === activeUrl,
      uptimePct,
      latencyMsP50,
      lastLedger,
      ledgerLag: maxLedger > 0 && lastLedger !== null ? Math.max(0, maxLedger - lastLedger) : 0,
      failures,
      simErrors,
      samples: probes.length,
      reqTotal,
      reqPerSec,
    });
  }

  // Actif en premier, puis par uptimePct desc
  result.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.uptimePct - a.uptimePct;
  });
  return result;
}

/** URL du RPC choisi dans le dernier tick ayant des probes, ou null. */
export function latestChosenRpc(db: DatabaseSync): string | null {
  const stmt = prepBig(db, `
    SELECT url FROM rpc_probe
    WHERE tick_id = (SELECT MAX(tick_id) FROM rpc_probe)
    AND chosen = 1
    LIMIT 1
  `);
  const rows = stmt.all() as Array<Record<string, unknown>>;
  return rows[0] ? String(rows[0]['url'] ?? '') : null;
}

// ─── Sous-fonction : uptime par source sur un intervalle ────────────────────────

/**
 * Calcule le % uptime par sourceId sur [from, to) en s'appuyant uniquement
 * sur les ticks ok=1 (dénominateur) et les quotes présentes (numérateur).
 * Renvoie une Map<sourceId, uptimePct> pour les IDs atomiques connus.
 * Si totalTicks == 0 pour un source, renvoie 100 (pas de base → flat).
 */
export function computeUptimeBySource(
  db: DatabaseSync,
  knownIds: string[],
  from: string,
  to: string,
): Map<string, number> {
  // Nombre de ticks ok=1 dans [from, to)
  const totalStmt = prepBig(db, `
    SELECT COUNT(*) as n FROM tick WHERE ok = 1 AND started_at >= ? AND started_at < ?
  `);
  const totalRow = (totalStmt.all(from, to) as Array<Record<string, unknown>>)[0];
  const total = totalRow ? Number(totalRow['n'] as bigint) : 0;

  const result = new Map<string, number>();
  if (total === 0) {
    for (const id of knownIds) result.set(id, 100);
    return result;
  }

  // Ticks ok=1 dans [from, to) où chaque source a produit ≥1 cotation
  const quotedStmt = prepBig(db, `
    SELECT q.source_id, COUNT(DISTINCT q.tick_id) as n
      FROM quote q
      JOIN tick t ON t.id = q.tick_id
     WHERE t.ok = 1 AND t.started_at >= ? AND t.started_at < ?
     GROUP BY q.source_id
  `);
  const quotedRows = quotedStmt.all(from, to) as Array<Record<string, unknown>>;
  const respondedBySource = new Map<string, number>();
  for (const r of quotedRows) {
    const srcId = String(r['source_id'] ?? '');
    if (!srcId.includes('+') && knownIds.includes(srcId)) {
      respondedBySource.set(srcId, Number(r['n'] as bigint));
    }
  }

  for (const id of knownIds) {
    const responded = respondedBySource.get(id) ?? 0;
    result.set(id, Math.round((responded / total) * 1000) / 10);
  }
  return result;
}

// ─── Sous-fonction : agrégation cohérence par venue ─────────────────────────────

/** Résultat de l'agrégation des sondes de cohérence par venue. */
export interface CoherenceAgg {
  tests: number;
  suspects: number;
  lastSuspectAt: string | null;
}

/**
 * Agrège les sondes de cohérence par venue sur la fenêtre.
 * Renvoie une Map<venueId, CoherenceAgg>.
 * Une venue sans sonde → { tests: 0, suspects: 0, lastSuspectAt: null }.
 */
export function aggregateCoherenceByVenue(
  probes: Array<{ venue: string; incoherent: boolean; created_at: string }>,
  knownIds: string[],
): Map<string, CoherenceAgg> {
  const result = new Map<string, CoherenceAgg>();
  // Initialise toutes les venues connues
  for (const id of knownIds) {
    result.set(id, { tests: 0, suspects: 0, lastSuspectAt: null });
  }
  // Accumule les sondes
  for (const p of probes) {
    const agg = result.get(p.venue);
    if (!agg) continue; // venue inconnue ou composite → ignorée
    agg.tests++;
    if (p.incoherent) {
      agg.suspects++;
      if (!agg.lastSuspectAt || p.created_at > agg.lastSuspectAt) {
        agg.lastSuspectAt = p.created_at;
      }
    }
  }
  return result;
}

/**
 * Construit la santé par source sur la fenêtre [windowStart, now).
 * Seuls les ticks ok=1 entrent dans le dénominateur.
 * source_errors = CSV des IDs des sources en échec sur ce tick ok.
 * Les IDs composites (avec '+') sont ignorés.
 */
export function buildSourceHealth(
  db: DatabaseSync,
  windowStart: string,
  now: Date,
): SourceHealthResult {
  // Sources connues = adaptateurs ACTIFS (source de vérité unique). Une venue débranchée de ADAPTERS
  // (ex. StellarBroker en attente de clé) disparaît automatiquement de la page Stabilité.
  const knownIds = ACTIVE_SOURCE_IDS;

  // ── Calcul de la tendance (fenêtre précédente) ──────────────────────────────
  // Durée D = now - windowStart. Fenêtre précédente = [windowStart - D, windowStart].
  const windowStartMs = new Date(windowStart).getTime();
  const durationMs = now.getTime() - windowStartMs;
  const prevWindowStart = new Date(windowStartMs - durationMs).toISOString();
  // uptime courant par source (recalculé via sous-fonction pour être cohérent)
  const uptimeCurrent = computeUptimeBySource(db, knownIds, windowStart, now.toISOString());
  // uptime précédent par source
  const uptimePrev = computeUptimeBySource(db, knownIds, prevWindowStart, windowStart);

  // ── Cohérence : sondes sur la fenêtre courante ──────────────────────────────
  const coherenceProbes = readCoherenceProbes(db, windowStart);
  const coherenceAgg = aggregateCoherenceByVenue(coherenceProbes, knownIds);

  // ── Durée médiane par source (execMs) + wall-clock total (execTotalMs) ──────
  const execMsBySource = readExecMsBySource(db, windowStart);
  const tickWallClocks = readTickWallClocks(db, windowStart);
  const wallClockDiffs = tickWallClocks
    .map((r) => Date.parse(r.finished_at) - Date.parse(r.started_at))
    .filter((d) => isFinite(d) && d >= 0);
  const execTotalMs = median(wallClockDiffs);

  // Requête A : ticks ok=1 dans la fenêtre — TOUS les ticks (auto ET manuels).
  // Les relevés manuels (note='manual') sont désormais inclus dans les stats de stabilité :
  // ils alimentent la page Stabilité comme le tableau/zoom (modèle temporaire, purgés au prochain relevé auto).
  const tickStmt = prepBig(db, `
    SELECT id, started_at, source_errors
    FROM tick
    WHERE ok = 1 AND started_at >= ?
    ORDER BY started_at
  `);
  const tickRows = tickStmt.all(windowStart) as Array<Record<string, unknown>>;

  const totalTicks = tickRows.length;

  // Stabilité : toujours calé sur Paris (repère stable pour les opérateurs).
  const offsetH = parisOffsetHours(now);
  const MS_PER_DAY = 86_400_000;
  const nowMs = now.getTime();

  // Dates locales des 7 derniers jours (index 0 = aujourd'hui)
  const targetDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const shiftedMs = nowMs - i * MS_PER_DAY + offsetH * 3_600_000;
    const d = new Date(shiftedMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    targetDates.push(`${y}-${m}-${dy}`);
  }

  // Accumulateurs par source
  type SrcAcc = {
    responded: number;
    failed: number;
    lastFailureAt: string | null;
    lastFailureReason: string | null;
    // dayTicks[i] = nb ticks dans le jour i (0=auj.), dayFails[i] = nb d'échecs dans le jour i
    dayTicks: number[];
    dayFails: number[];
  };
  const acc = new Map<string, SrcAcc>();
  for (const id of knownIds) {
    acc.set(id, { responded: 0, failed: 0, lastFailureAt: null, lastFailureReason: null, dayTicks: new Array(7).fill(0), dayFails: new Array(7).fill(0) });
  }

  // Requête B : quotes (sources qui ont répondu) sur les ticks ok de la fenêtre — TOUS (auto ET manuels).
  // Cohérent avec la requête A : les relevés manuels sont désormais inclus dans les stats de stabilité.
  const quoteStmt = prepBig(db, `
    SELECT DISTINCT q.tick_id, q.source_id
    FROM quote q
    JOIN tick t ON t.id = q.tick_id
    WHERE t.ok = 1 AND t.started_at >= ?
  `);
  const quoteRows = quoteStmt.all(windowStart) as Array<Record<string, unknown>>;

  // Map tickId → Set<sourceId>
  const respondedByTick = new Map<string, Set<string>>();
  for (const r of quoteRows) {
    const srcId = String(r['source_id'] ?? '');
    if (srcId.includes('+') || !knownIds.includes(srcId)) continue;
    const tickId = String(r['tick_id']);
    let s = respondedByTick.get(tickId);
    if (!s) { s = new Set(); respondedByTick.set(tickId, s); }
    s.add(srcId);
  }

  // Parcourir les ticks pour accumuler responded/failed/days
  for (const row of tickRows) {
    const startedAt = String(row['started_at'] ?? '');
    const d = new Date(startedAt);
    if (isNaN(d.getTime())) continue;

    // Index du jour local (0 = aujourd'hui, 6 = il y a 6 j)
    const localMs = d.getTime() + offsetH * 3_600_000;
    const ld = new Date(localMs);
    const y = ld.getUTCFullYear();
    const m = String(ld.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(ld.getUTCDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${dy}`;
    const dayIdx = targetDates.indexOf(dateKey);

    // Echecs sur ce tick : source_errors = JSON ou CSV (rétrocompat)
    const errorsRaw = row['source_errors'];
    const parsedErrors = parseSourceErrors(errorsRaw).filter((e) => !e.id.includes('+') && knownIds.includes(e.id));
    const failedIds = new Set<string>(parsedErrors.map((e) => e.id));
    const failedReasonMap = new Map<string, string | null>(parsedErrors.map((e) => [e.id, e.reason]));

    const tickId = String(row['id']);
    const respondedIds = respondedByTick.get(tickId) ?? new Set<string>();

    for (const id of knownIds) {
      const a = acc.get(id)!;
      const responded = respondedIds.has(id);
      // failed = ≥1 sonde de cette source a échoué ce tick (présence dans source_errors).
      const failed = failedIds.has(id);

      if (responded) a.responded++;
      if (failed) {
        a.failed++;
        if (!a.lastFailureAt || startedAt > a.lastFailureAt) {
          a.lastFailureAt = startedAt;
          a.lastFailureReason = failedReasonMap.get(id) ?? null;
        }
      }
      if (dayIdx >= 0) {
        a.dayTicks[dayIdx]! ++;
        if (failed) a.dayFails[dayIdx]! ++;
      }
    }
  }

  // Construire SourceHealth par source
  const sources: SourceHealth[] = knownIds.map((id) => {
    const a = acc.get(id)!;
    // Disponibilité = fraction de ticks où la source a produit ≥1 cotation (pas « 1 − échecs »).
    const uptimePct = totalTicks > 0
      ? Math.round((a.responded / totalTicks) * 1000) / 10
      : 100;

    const days = a.dayTicks.map((dt, i) => {
      if (dt === 0) return null;
      const df = a.dayFails[i]!;
      if (df === 0) return 'ok' as const;
      if (df / dt < 0.25) return 'warn' as const;
      return 'bad' as const;
    }) as Array<'ok' | 'warn' | 'bad' | null>;

    // Tendance : comparaison fenêtre courante vs précédente.
    // Pas de base de comparaison (fenêtre précédente sans relevé, ex. < 14 j de données) → 'flat'
    // (évite un faux 'down' au démarrage pour une source à dispo courante basse).
    const cur = uptimeCurrent.get(id) ?? 100;
    const prevRaw = uptimePrev.get(id);
    const delta = prevRaw === undefined ? 0 : cur - prevRaw;
    const uptimeTrend: 'up' | 'down' | 'flat' =
      delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';

    // Cohérence
    const coh = coherenceAgg.get(id) ?? { tests: 0, suspects: 0, lastSuspectAt: null };

    const execMsArr = execMsBySource.get(id) ?? [];
    return {
      id,
      display: displayName(id),
      respondedTicks: a.responded,
      failedTicks: a.failed,
      uptimePct,
      lastFailureAt: a.lastFailureAt,
      lastFailureReason: a.lastFailureReason,
      days,
      pairNote: id === 'comet' ? 'USDC uniquement' : null,
      coherence: { tests: coh.tests, suspects: coh.suspects, lastSuspectAt: coh.lastSuspectAt },
      uptimeTrend,
      execMs: median(execMsArr),
    };
  });

  // Trier par uptimePct desc, tie-break failedTicks asc (nulls = 100% → en tête)
  sources.sort((a, b) =>
    b.uptimePct !== a.uptimePct
      ? b.uptimePct - a.uptimePct
      : a.failedTicks - b.failedTicks,
  );

  // Heures écoulées dans le jour courant (timezone client) pour le cercle partiel
  const localNowMs = now.getTime() + offsetH * 3_600_000;
  const localNow = new Date(localNowMs);
  const todayElapsedH = localNow.getUTCHours() + localNow.getUTCMinutes() / 60;

  const rpcs = buildRpcHealth(db, windowStart);
  return { totalTicks, windowDays: 7, sources, todayElapsedH, rpcs, execTotalMs };
}

// ─── Point d'entrée public ────────────────────────────────────────────────────

export function overview(
  db: DatabaseSync,
  pairUi: string,
  cfg: CollectorConfig,
  now?: Date,
  offsetH: number = 0,
): Overview {
  const pair = dbPair(pairUi);
  const nowDate = now ?? new Date();
  const windowStart = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Sondes configurées (COLLECTOR_SIZES_BLND), triées croissant. Une échelle par sonde.
  const sizes = [...cfg.sizesBlnd].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const sondes = sizes.map((s) => toNumber(s));

  const meta = buildMeta(db, cfg.cadenceSec, sondes);
  meta.nextTickAt = readNextTickAt(cfg.dbPath);
  const ladders: Record<string, LadderRow[]> = {};
  for (const size of sizes) ladders[String(toNumber(size))] = buildLadder(db, pair, size);
  const winnerDist: Record<string, Array<{ display: string; pct: number; sourceId: string }>> = {};
  const bestRoutes: Record<string, RouteRank[]> = {};
  for (const size of sizes) {
    const key = String(toNumber(size));
    winnerDist[key] = buildWinnerDist(db, pair, windowStart, size);
    bestRoutes[key] = buildBestRoutes(db, pair, windowStart, size);
  }

  // Offset (heures) fourni par le client (UTC+offsetH) — 0 = UTC par défaut

  const heatEffUtc: Record<string, (number | null)[][]> = {};
  const intradayLocal: Record<string, (number | null)[][]> = {};
  const effWeekAvg: Record<string, number | null> = {};
  const heatEffUtcStellar: Record<string, (number | null)[][]> = {};
  const intradayStellar: Record<string, (number | null)[][]> = {};
  const effWeekAvgStellar: Record<string, number | null> = {};

  for (const size of sizes) {
    const key = String(toNumber(size));
    const effRows = fetchWinnerEffRows(db, pair, size, windowStart, pairUi);

    heatEffUtc[key] = buildHeatEffUtc(effRows);
    effWeekAvg[key] = effRows.length === 0
      ? null
      : effRows.reduce((a, r) => a + r.eff, 0) / effRows.length;
    intradayLocal[key] = buildIntradayLocal(effRows, offsetH, nowDate);

    // Série Stellar : oracle = eurc_stellar_mid (trous honnêtes où mid absent)
    heatEffUtcStellar[key] = buildHeatEffUtc(effRows, (r) => r.effStellar);
    intradayStellar[key] = buildIntradayLocal(effRows, offsetH, nowDate, (r) => r.effStellar);
    const stellarRows = effRows.filter((r) => r.effStellar != null);
    effWeekAvgStellar[key] = stellarRows.length === 0
      ? null
      : stellarRows.reduce((a, r) => a + (r.effStellar as number), 0) / stellarRows.length;
  }

  return {
    meta, ladders, winnerDist, bestRoutes,
    heatEffUtc, intradayLocal, effWeekAvg,
    heatEffUtcStellar, intradayStellar, effWeekAvgStellar,
  };
}
