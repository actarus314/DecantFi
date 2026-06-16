// Statistiques lues depuis la DB pour l'UI web. Fonctions pures (db en param).
// Fenêtre = 7 jours. Timezone : agrégation serveur UTC, conversion côté client.
// ponytail: Number = affichage, jamais règlement.
import { type DatabaseSync } from 'node:sqlite';
import { prepBig } from './read-db.js';
import { toNumber } from '../core/amount.js';
import type { CollectorConfig } from '../collector/config.js';

// ─── Types publics ───────────────────────────────────────────────────────────

export type Chip = 'obs' | 'calc' | 'est';

export interface LadderRow {
  display: string;
  note: string;
  net: number;
  deltaVsWinner: number;
  chip: Chip;
  impactPct: number | null;
  winner: boolean;
}

export interface Meta {
  lastTickAt: string | null;
  cadenceSec: number;
  nTicks: number;
  nTicksOk: number;
  blndUsd: number | null;
  eurUsd: number | null;
  xlmUsd: number | null;
  windowDays: 7;
  bigSonde: 750;
}

export interface Overview {
  meta: Meta;
  ladders: { '250': LadderRow[]; '750': LadderRow[] };
  winnerDist: Array<{ display: string; pct: number }>;
  hourlyUtc: (number | null)[];
  heatUtc: (number | null)[][];
}

// ─── Mappings display / note / chip ──────────────────────────────────────────

const SHORT_NAME: Record<string, string> = {
  xbull: 'xBull',
  soroswap: 'Soroswap',
  aquarius: 'Aquarius',
  comet: 'Comet',
  ultrastellar: 'Ultra',
  stellarbroker: 'StellarBroker',
  horizon: 'Horizon',
};

const FULL_NAME: Record<string, string> = {
  xbull: 'xBull',
  soroswap: 'Soroswap',
  aquarius: 'Aquarius',
  comet: 'Comet (pool)',
  ultrastellar: 'Ultra Stellar',
  stellarbroker: 'StellarBroker',
  horizon: 'Horizon (strict)',
};

export function shortName(sourceId: string): string {
  if (sourceId.includes('+')) {
    return sourceId
      .split('+')
      .map((s) => SHORT_NAME[s.trim()] ?? s.trim())
      .join(' + ');
  }
  return SHORT_NAME[sourceId] ?? sourceId;
}

export function displayName(sourceId: string): string {
  if (sourceId.includes('+')) {
    return sourceId
      .split('+')
      .map((s) => FULL_NAME[s.trim()] ?? s.trim())
      .join(' + ');
  }
  return FULL_NAME[sourceId] ?? sourceId;
}

export function noteFor(sourceId: string, winner: boolean, eurcPath: string | null): string {
  const parts: string[] = [];
  if (winner) {
    const base = 'gagnant';
    const via = eurcPath === 'via-usdc' ? 'via-USDC' : null;
    parts.push(via ? `${base} · ${via}` : base);
  }
  if (sourceId === 'comet') parts.push('cross-check backstop');
  else if (sourceId === 'ultrastellar') parts.push('fee = 0');
  else if (sourceId === 'stellarbroker') parts.push('plancher (fee opaque)');
  else if (sourceId === 'horizon') parts.push('plancher DEX');
  return parts.join(' · ');
}

export function chipFor(netConfidence: string, sourceId: string, eurcPath: string | null): Chip {
  if (netConfidence === 'exact') return 'obs';
  if (netConfidence === 'floor') return 'est';
  // estimate
  if (sourceId.includes('+') || eurcPath === 'via-usdc') return 'calc';
  return 'est';
}

// ─── Mapping DB pair ─────────────────────────────────────────────────────────

function dbPair(pairUi: string): string {
  return pairUi === 'EURC' ? 'BLND->EURC' : 'BLND->USDC';
}

// ─── Efficience d'un tick ─────────────────────────────────────────────────────

interface TickRow {
  blnd_usd: number | null;
  eur_usd: number | null;
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
    ? (tick.eur_usd && tick.eur_usd > 0 ? blndUsd / tick.eur_usd : null)
    : blndUsd;
  if (!spot || spot <= 0) return null;
  return (net / amt) / spot;
}

// ─── Sonde mapping ───────────────────────────────────────────────────────────

function bigSondeStroops(cfg: CollectorConfig): bigint {
  // La plus grande sonde (= 750 BLND = 7_500_000_000 stroops)
  const sorted = [...cfg.sizesBlnd].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[sorted.length - 1] ?? 7_500_000_000n;
}

function smallSondeStroops(cfg: CollectorConfig): bigint {
  const sorted = [...cfg.sizesBlnd].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[0] ?? 2_500_000_000n;
}

// ─── Dernière tick ok — échelle ──────────────────────────────────────────────

function buildLadder(db: DatabaseSync, pair: string, amountIn: bigint): LadderRow[] {
  // Trouve le dernier tick ok
  const lastTickStmt = prepBig(db, `
    SELECT id FROM tick WHERE ok = 1 ORDER BY started_at DESC LIMIT 1
  `);
  const lastTickRows = lastTickStmt.all() as Array<Record<string, unknown>>;
  const lastTickRow = lastTickRows[0];
  if (!lastTickRow) return [];
  const tickId = lastTickRow['id'] as bigint;

  const stmt = prepBig(db, `
    SELECT q.source_id, q.net_out, q.net_confidence, q.price_impact_pct, q.is_winner, q.eurc_path
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

    return {
      display: displayName(sourceId),
      note: noteFor(sourceId, isWinner, eurcPath),
      net,
      deltaVsWinner,
      chip: chipFor(netConf, sourceId, eurcPath),
      impactPct,
      winner: isWinner,
    };
  });
}

// ─── Distribution gagnants (7 j) ─────────────────────────────────────────────

function buildWinnerDist(
  db: DatabaseSync,
  pair: string,
  windowStart: string,
): Array<{ display: string; pct: number }> {
  const stmt = prepBig(db, `
    SELECT q.source_id, COUNT(*) as cnt
    FROM quote q JOIN tick t ON t.id = q.tick_id
    WHERE q.is_winner = 1 AND q.pair = ? AND t.ok = 1 AND t.started_at >= ?
    GROUP BY q.source_id
    ORDER BY cnt DESC
  `);
  const rows = stmt.all(pair, windowStart) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  let total = 0n;
  for (const r of rows) total += r['cnt'] as bigint;
  if (total === 0n) return [];

  return rows.map((r) => ({
    display: displayName(String(r['source_id'] ?? '')),
    pct: Math.round((Number(r['cnt'] as bigint) / Number(total)) * 1000) / 10,
  }));
}

// ─── Efficience horaire / heatmap ─────────────────────────────────────────────

interface WinnerEffRow {
  hour_utc: number;    // 0-23
  dow_utc: number;     // 0=Lun … 6=Dim
  eff: number;
}

/** Agrège l'efficience du gagnant (sonde 750) par bucket (dow+hour UTC) sur 7 j. */
function fetchWinnerEffRows(
  db: DatabaseSync,
  pair: string,
  amountIn: bigint,
  windowStart: string,
  pairUi: string,
): WinnerEffRow[] {
  // Lit tous les ticks ok avec les quotes gagnantes (sonde big)
  const stmt = prepBig(db, `
    SELECT t.started_at, t.blnd_usd, t.eur_usd, q.net_out, q.amount_in as q_amount_in
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
    const eurUsd = r['eur_usd'] != null ? Number(r['eur_usd']) : null;

    if (!netOut || netOut <= 0n || qAmountIn <= 0n) continue;
    const eff = effOf(netOut, qAmountIn, pairUi, { blnd_usd: blndUsd, eur_usd: eurUsd });
    if (eff === null) continue;

    result.push({ hour_utc: hourUtc, dow_utc: dowUtc, eff });
  }
  return result;
}

function buildHourlyUtc(rows: WinnerEffRow[]): (number | null)[] {
  if (rows.length === 0) return new Array<null>(24).fill(null);

  // Moyenne d'efficience par heure UTC
  const buckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const r of rows) {
    const bucket = buckets[r.hour_utc];
    if (bucket) bucket.push(r.eff);
  }

  const avgs: (number | null)[] = buckets.map((b) =>
    b.length === 0 ? null : b.reduce((a, x) => a + x, 0) / b.length,
  );

  // Moyenne globale (sur les buckets non-null)
  const nonNull = avgs.filter((v): v is number => v !== null);
  if (nonNull.length === 0) return new Array<null>(24).fill(null);
  const globalAvg = nonNull.reduce((a, x) => a + x, 0) / nonNull.length;
  if (globalAvg <= 0) return new Array<null>(24).fill(null);

  // % d'écart à la moyenne
  return avgs.map((v) => v === null ? null : (v / globalAvg - 1) * 100);
}

function buildHeatUtc(rows: WinnerEffRow[]): (number | null)[][] {
  if (rows.length === 0) {
    return Array.from({ length: 7 }, () => new Array<null>(24).fill(null));
  }

  // Moyenne d'efficience par (dow, hour)
  const buckets: number[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => []),
  );
  for (const r of rows) {
    const dayBucket = buckets[r.dow_utc];
    if (dayBucket) {
      const hourBucket = dayBucket[r.hour_utc];
      if (hourBucket) hourBucket.push(r.eff);
    }
  }

  const avgs: (number | null)[][] = buckets.map((day) =>
    day.map((b) => (b.length === 0 ? null : b.reduce((a, x) => a + x, 0) / b.length)),
  );

  // Moyenne globale sur tous les buckets non-null
  const allVals: number[] = [];
  for (const day of avgs) for (const v of day) if (v !== null) allVals.push(v);
  if (allVals.length === 0) return Array.from({ length: 7 }, () => new Array<null>(24).fill(null));

  const globalAvg = allVals.reduce((a, x) => a + x, 0) / allVals.length;
  if (globalAvg <= 0) return Array.from({ length: 7 }, () => new Array<null>(24).fill(null));

  return avgs.map((day) =>
    day.map((v) => v === null ? null : (v / globalAvg - 1) * 100),
  );
}

// ─── Meta ──────────────────────────────────────────────────────────────────────

function buildMeta(db: DatabaseSync, cadenceSec: number): Meta {
  const cntStmt = prepBig(db, `SELECT COUNT(*) as n FROM tick`);
  const cntOkStmt = prepBig(db, `SELECT COUNT(*) as n FROM tick WHERE ok = 1`);
  const lastStmt = prepBig(db,
    `SELECT started_at, blnd_usd, xlm_usd, eur_usd FROM tick WHERE ok = 1 ORDER BY started_at DESC LIMIT 1`);

  const cntRow = (cntStmt.all() as Array<Record<string, unknown>>)[0];
  const cntOkRow = (cntOkStmt.all() as Array<Record<string, unknown>>)[0];
  const lastRow = (lastStmt.all() as Array<Record<string, unknown>>)[0];

  return {
    lastTickAt: lastRow ? String(lastRow['started_at'] ?? '') : null,
    cadenceSec,
    nTicks: cntRow ? Number(cntRow['n'] as bigint) : 0,
    nTicksOk: cntOkRow ? Number(cntOkRow['n'] as bigint) : 0,
    blndUsd: lastRow?.['blnd_usd'] != null ? Number(lastRow['blnd_usd']) : null,
    eurUsd: lastRow?.['eur_usd'] != null ? Number(lastRow['eur_usd']) : null,
    xlmUsd: lastRow?.['xlm_usd'] != null ? Number(lastRow['xlm_usd']) : null,
    windowDays: 7,
    bigSonde: 750,
  };
}

// ─── Point d'entrée public ────────────────────────────────────────────────────

export function overview(
  db: DatabaseSync,
  pairUi: string,
  cfg: CollectorConfig,
  now?: Date,
): Overview {
  const pair = dbPair(pairUi);
  const nowDate = now ?? new Date();
  const windowStart = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const big = bigSondeStroops(cfg);
  const small = smallSondeStroops(cfg);

  const meta = buildMeta(db, cfg.cadenceSec);
  const ladders = {
    '250': buildLadder(db, pair, small),
    '750': buildLadder(db, pair, big),
  };
  const winnerDist = buildWinnerDist(db, pair, windowStart);
  const effRows = fetchWinnerEffRows(db, pair, big, windowStart, pairUi);
  const hourlyUtc = buildHourlyUtc(effRows);
  const heatUtc = buildHeatUtc(effRows);

  return { meta, ladders, winnerDist, hourlyUtc, heatUtc };
}
