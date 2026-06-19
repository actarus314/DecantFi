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
  route: string;
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
  /** Sondes configurées (COLLECTOR_SIZES_BLND), en BLND entiers, triées croissant. */
  sondes: number[];
}

/** Une route distincte (chemin + outils) classée par fréquence de victoire sur la fenêtre. */
export interface RouteRank {
  path: string;   // ex. 'BLND→USDC→EURC'
  tools: string;  // ex. 'xBull + Ultra'
  wins: number;
  winPct: number;
}

export interface Overview {
  meta: Meta;
  /** Échelles du dernier tick ok, une par sonde (clé = BLND entier, ex. '250'). */
  ladders: Record<string, LadderRow[]>;
  /** Distribution des gagnants par sonde (clé = BLND entier). */
  winnerDist: Record<string, Array<{ display: string; pct: number }>>;
  /** Meilleures routes (chemins gagnants) sur 7 j, par sonde (clé = BLND entier). */
  bestRoutes: Record<string, RouteRank[]>;
  /** 7×24 efficience moyenne brute par (dow, hour) UTC — pour la moyenne/jour normalisée du prix. Clé = sonde en string (ex. '250'/'750'). */
  heatEffUtc: Record<string, (number | null)[][]>;
  /** Trace intraday 15 min par sonde. Clé = sonde. Valeur = 7×96, indexé par jour-de-semaine 0=Lun..6=Dim, chaque ligne = la trace de SA date locale. */
  intradayLocal: Record<string, (number | null)[][]>;
  /** Moyenne plate 7 j de l'efficience par sonde. */
  effWeekAvg: Record<string, number | null>;
}

// ─── Mappings display / note / chip ──────────────────────────────────────────

const SHORT_NAME: Record<string, string> = {
  xbull: 'xBull',
  soroswap: 'Soroswap',
  aquarius: 'Aquarius',
  comet: 'Comet',
  ultrastellar: 'Ultra Stellar',
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
  horizon: 'Horizon',
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

    return {
      display: displayName(sourceId),
      note: noteFor(sourceId, isWinner, eurcPath),
      route: maskedRoute(prettyRoute(r['route_summary'] != null ? String(r['route_summary']) : ''), sourceId),
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
  amountIn?: bigint,
): Array<{ display: string; pct: number }> {
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

  return rows.map((r) => {
    const wins = Number(r['wins'] as bigint);
    const sourceId = String(r['source_id'] ?? '');
    return {
      path: maskedRoute(prettyRoute(r['route_summary'] != null ? String(r['route_summary']) : ''), sourceId),
      tools: shortName(sourceId),
      wins,
      winPct: Math.round((wins / totalNum) * 1000) / 10,
    };
  });
}

// ─── Efficience horaire / heatmap ─────────────────────────────────────────────

interface WinnerEffRow {
  hour_utc: number;     // 0-23
  dow_utc: number;      // 0=Lun … 6=Dim
  eff: number;
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

    result.push({ hour_utc: hourUtc, dow_utc: dowUtc, eff, startedAtMs: d.getTime() });
  }
  return result;
}

/** 7×24 efficience moyenne brute par (dow, hour) UTC — sert la moyenne/jour normalisée du prix. */
function buildHeatEffUtc(rows: WinnerEffRow[]): (number | null)[][] {
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
    slotArr.push(row.eff);
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
    sondes,
  };
}

// ─── Santé des sources (7 j) ─────────────────────────────────────────────────

/** Disponibilité d'une source pour une taille de sonde donnée (ex. 250 / 750 BLND). */
export interface SizeHealth {
  size: number;          // BLND entiers (sonde)
  respondedTicks: number;
  uptimePct: number;     // % ticks où la source a coté À CETTE taille
}

export interface SourceHealth {
  id: string;
  display: string;
  respondedTicks: number;        // ticks avec ≥1 cotation (toutes tailles)
  failedTicks: number;           // ticks où ≥1 sonde de la source a échoué (présence dans source_errors)
  uptimePct: number;             // global : % ticks avec ≥1 cotation
  bySize: SizeHealth[];          // dispo par taille, triée croissante — la granularité demandée
  lastFailureAt: string | null;  // ISO ou null
  lastFailureReason: string | null; // rate-limit / timeout / rpc / simulation / http / null
  days: Array<'ok' | 'warn' | 'bad' | null>;  // 7 entrées, index 0 = le plus récent
  pairNote: string | null;       // ex. 'USDC uniquement' pour comet
}

export interface SourceHealthResult {
  totalTicks: number;
  windowDays: 7;
  sources: SourceHealth[];
  /** Heures écoulées dans la journée locale courante (0..24), pour le rendu du cercle partiel. */
  todayElapsedH: number;
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
  offsetH: number = 0,
): SourceHealthResult {
  // Sources connues : les clés de FULL_NAME (7 venues atomiques)
  const knownIds = Object.keys(FULL_NAME);

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

  // offsetH fourni par le client (UTC+offsetH) — remplace l'offset Paris figé.
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
    bySize: Map<number, number>; // taille → nb ticks où la source a coté à cette taille
    lastFailureAt: string | null;
    lastFailureReason: string | null;
    // dayTicks[i] = nb ticks dans le jour i (0=auj.), dayFails[i] = nb d'échecs dans le jour i
    dayTicks: number[];
    dayFails: number[];
  };
  const acc = new Map<string, SrcAcc>();
  for (const id of knownIds) {
    acc.set(id, { responded: 0, failed: 0, bySize: new Map(), lastFailureAt: null, lastFailureReason: null, dayTicks: new Array(7).fill(0), dayFails: new Array(7).fill(0) });
  }

  // Requête B : quotes (sources qui ont répondu) PAR TAILLE sur les ticks ok de la fenêtre — TOUS (auto ET manuels).
  // Cohérent avec la requête A : les relevés manuels sont désormais inclus dans les stats de stabilité.
  const quoteStmt = prepBig(db, `
    SELECT DISTINCT q.tick_id, q.source_id, q.amount_in
    FROM quote q
    JOIN tick t ON t.id = q.tick_id
    WHERE t.ok = 1 AND t.started_at >= ?
  `);
  const quoteRows = quoteStmt.all(windowStart) as Array<Record<string, unknown>>;

  // Tailles observées (sondes), en BLND entiers, triées croissant.
  const sizeSet = new Set<number>();
  // Map tickId → Set<sourceId> (toutes tailles) et Set<`sourceId|size`> (par taille).
  const respondedByTick = new Map<string, Set<string>>();
  const respondedSizeByTick = new Map<string, Set<string>>();
  for (const r of quoteRows) {
    const srcId = String(r['source_id'] ?? '');
    if (srcId.includes('+') || !knownIds.includes(srcId)) continue;
    const tickId = String(r['tick_id']);
    const size = Math.round(Number(r['amount_in'] as bigint) / 1e7);
    sizeSet.add(size);
    let s = respondedByTick.get(tickId);
    if (!s) { s = new Set(); respondedByTick.set(tickId, s); }
    s.add(srcId);
    let ss = respondedSizeByTick.get(tickId);
    if (!ss) { ss = new Set(); respondedSizeByTick.set(tickId, ss); }
    ss.add(`${srcId}|${size}`);
  }
  const sizes = [...sizeSet].sort((a, b) => a - b);

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
    const respondedSizes = respondedSizeByTick.get(tickId) ?? new Set<string>();

    for (const id of knownIds) {
      const a = acc.get(id)!;
      const responded = respondedIds.has(id);
      // failed = ≥1 sonde de cette source a échoué ce tick (présence dans source_errors). La granularité
      // par taille (bySize) montre QUELLE taille — plus besoin de masquer l'info derrière « down total ».
      const failed = failedIds.has(id);

      if (responded) a.responded++;
      for (const size of sizes) {
        if (respondedSizes.has(`${id}|${size}`)) a.bySize.set(size, (a.bySize.get(size) ?? 0) + 1);
      }
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

    // Dispo par taille (sonde) : la granularité — ex. Comet 250:100 % / 750:12 % rend visible
    // qu'une seule taille flanche, sans faire passer toute la source pour indisponible.
    const bySize: SizeHealth[] = sizes.map((size) => {
      const r = a.bySize.get(size) ?? 0;
      return { size, respondedTicks: r, uptimePct: totalTicks > 0 ? Math.round((r / totalTicks) * 1000) / 10 : 100 };
    });

    return {
      id,
      display: displayName(id),
      respondedTicks: a.responded,
      failedTicks: a.failed,
      uptimePct,
      bySize,
      lastFailureAt: a.lastFailureAt,
      lastFailureReason: a.lastFailureReason,
      days,
      pairNote: id === 'comet' ? 'USDC uniquement' : null,
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

  return { totalTicks, windowDays: 7, sources, todayElapsedH };
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
  const ladders: Record<string, LadderRow[]> = {};
  for (const size of sizes) ladders[String(toNumber(size))] = buildLadder(db, pair, size);
  const winnerDist: Record<string, Array<{ display: string; pct: number }>> = {};
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

  for (const size of sizes) {
    const key = String(toNumber(size));
    const effRows = fetchWinnerEffRows(db, pair, size, windowStart, pairUi);
    heatEffUtc[key] = buildHeatEffUtc(effRows);
    effWeekAvg[key] = effRows.length === 0
      ? null
      : effRows.reduce((a, r) => a + r.eff, 0) / effRows.length;
    intradayLocal[key] = buildIntradayLocal(effRows, offsetH, nowDate);
  }

  return { meta, ladders, winnerDist, bestRoutes, heatEffUtc, intradayLocal, effWeekAvg };
}
