// Opens the DB for reading (RW + query_only for WAL robustness). No migrate.
import { DatabaseSync, type StatementSync } from 'node:sqlite';

/** Opens the DB in robust read mode (RW + PRAGMA query_only + busy_timeout). */
export function openReadOnly(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA query_only = ON');
  return db;
}

/** Prepares a statement and enables setReadBigInts(true). */
export function prepBig(db: DatabaseSync, sql: string): StatementSync {
  const stmt = db.prepare(sql);
  stmt.setReadBigInts(true);
  return stmt;
}

/** Type of a coherence_probe row as read from the DB (read-only). */
export interface CoherenceProbeRow {
  id: bigint;
  created_at: string;
  venue: string;
  pair: string;
  amount_in: bigint;
  incoherent: boolean;
  reason: string | null;
  net_quoted: bigint | null;
  net_simulated: bigint | null;
  delta_bps: bigint | null;
  route_json: string | null;
  trace_json: string | null;
}

/** Maps a raw DB row to a CoherenceProbeRow. */
function mapProbeRow(r: Record<string, unknown>): CoherenceProbeRow {
  return {
    id:            r['id'] as bigint,
    created_at:    r['created_at'] as string,
    venue:         r['venue'] as string,
    pair:          r['pair'] as string,
    amount_in:     r['amount_in'] as bigint,
    incoherent:    (r['incoherent'] as bigint) !== 0n,
    reason:        (r['reason'] as string | null) ?? null,
    net_quoted:    (r['net_quoted'] as bigint | null) ?? null,
    net_simulated: (r['net_simulated'] as bigint | null) ?? null,
    delta_bps:     (r['delta_bps'] as bigint | null) ?? null,
    route_json:    (r['route_json'] as string | null) ?? null,
    trace_json:    (r['trace_json'] as string | null) ?? null,
  };
}

/** Reads all coherence probes since sinceIso, sorted created_at DESC (web read-only). */
export function readCoherenceProbes(db: DatabaseSync, sinceIso: string): CoherenceProbeRow[] {
  const stmt = prepBig(db, `
    SELECT id, created_at, venue, pair, amount_in, incoherent, reason,
           net_quoted, net_simulated, delta_bps, route_json, trace_json
      FROM coherence_probe
     WHERE created_at >= ?
     ORDER BY created_at DESC
  `);
  return (stmt.all(sinceIso) as Array<Record<string, unknown>>).map(mapProbeRow);
}

/**
 * Reads non-null duration_ms values for quotes by source_id over the window,
 * joined to ticks with ok=1. Returns a Map<source_id, number[]>.
 * Only atomic IDs are returned ('+' composites are filtered out in SQL via NOT LIKE).
 */
export function readExecMsBySource(
  db: DatabaseSync,
  sinceIso: string,
): Map<string, number[]> {
  const stmt = prepBig(db, `
    SELECT q.source_id, q.duration_ms
      FROM quote q
      JOIN tick t ON t.id = q.tick_id
     WHERE t.ok = 1 AND t.started_at >= ?
       AND q.duration_ms IS NOT NULL
       AND q.source_id NOT LIKE '%+%'
     ORDER BY q.source_id
  `);
  const rows = stmt.all(sinceIso) as Array<Record<string, unknown>>;
  const result = new Map<string, number[]>();
  for (const r of rows) {
    const src = String(r['source_id'] ?? '');
    const ms = Number(r['duration_ms']);
    if (!isFinite(ms)) continue;
    let arr = result.get(src);
    if (!arr) { arr = []; result.set(src, arr); }
    arr.push(ms);
  }
  return result;
}

/** Reads (started_at, finished_at) for ticks with ok=1 over the window, for wall-clock computation. */
export function readTickWallClocks(
  db: DatabaseSync,
  sinceIso: string,
): Array<{ started_at: string; finished_at: string }> {
  const stmt = prepBig(db, `
    SELECT started_at, finished_at
      FROM tick
     WHERE ok = 1 AND started_at >= ? AND finished_at IS NOT NULL
  `);
  const rows = stmt.all(sinceIso) as Array<Record<string, unknown>>;
  return rows
    .map((r) => ({
      started_at: String(r['started_at'] ?? ''),
      finished_at: String(r['finished_at'] ?? ''),
    }))
    .filter((r) => r.started_at && r.finished_at);
}

/** Reads coherence probes for a given venue since sinceIso, sorted created_at DESC. */
export function readCoherenceProbesByVenue(
  db: DatabaseSync,
  venue: string,
  sinceIso: string,
): CoherenceProbeRow[] {
  const stmt = prepBig(db, `
    SELECT id, created_at, venue, pair, amount_in, incoherent, reason,
           net_quoted, net_simulated, delta_bps, route_json, trace_json
      FROM coherence_probe
     WHERE venue = ? AND created_at >= ?
     ORDER BY created_at DESC
  `);
  return (stmt.all(venue, sinceIso) as Array<Record<string, unknown>>).map(mapProbeRow);
}
