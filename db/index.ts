// SQLite access layer (node:sqlite). Writes tick + quotes + raw in one transaction.
// Stroop amounts as INTEGER (< 2^53, exact); read as bigint via setReadBigInts.
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './schema.js';

export interface TickInsert {
  started_at: string; finished_at: string | null; cadence_sec: number;
  blnd_usd: number | null; xlm_usd: number | null; eurc_usd: number | null; eurc_stellar_mid: number | null;
  ok: boolean; source_errors: string | null; note: string | null;
}
export interface QuoteInsert {
  pair: string; amount_in: bigint; source_id: string;
  net_out: bigint | null; net_confidence: string | null; price_impact_pct: number | null;
  gas_in_target: bigint | null; fee_total: bigint | null; route_summary: string | null;
  is_winner: boolean; eurc_path: string | null; raw_json: string | null;
  /** Total quoting duration for this source (fetch + re-sim), in ms. null = not measured. */
  duration_ms: number | null;
}

export interface RpcProbeInsert {
  url: string; ok: boolean; latency_ms: number | null;
  ledger: number | null; chosen: boolean; sim_errors: number; rpc_calls: number; error: string | null;
}

export interface CoherenceProbeInsert {
  created_at: string;
  venue: string;
  pair: string;
  amount_in: bigint;
  incoherent: boolean;       // converted to 0/1 on insert
  reason: string | null;
  net_quoted: bigint | null;
  net_simulated: bigint | null;
  delta_bps: number | null;
  route_json: string | null;
  trace_json: string | null;
}

export class Db {
  // Prepared statements cached for the lifetime of the connection (node:sqlite StatementSync
  // remains valid as long as its parent DatabaseSync is open).
  private readonly _insTick: ReturnType<DatabaseSync['prepare']>;
  private readonly _insQuote: ReturnType<DatabaseSync['prepare']>;
  private readonly _insRaw: ReturnType<DatabaseSync['prepare']>;
  private readonly _insRpc: ReturnType<DatabaseSync['prepare']>;
  private readonly _insLog: ReturnType<DatabaseSync['prepare']>;
  private readonly _delManual: ReturnType<DatabaseSync['prepare']>;
  private readonly _hasCoherence: ReturnType<DatabaseSync['prepare']>;
  private readonly _insCoherence: ReturnType<DatabaseSync['prepare']>;

  constructor(private db: DatabaseSync) {
    this._insTick = db.prepare(
      `INSERT INTO tick (started_at, finished_at, cadence_sec, blnd_usd, xlm_usd, eurc_usd, eurc_stellar_mid, ok, source_errors, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this._insQuote = db.prepare(
      `INSERT INTO quote (tick_id, pair, amount_in, source_id, net_out, net_confidence, price_impact_pct,
                          gas_in_target, fee_total, route_summary, is_winner, eurc_path, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this._insRaw = db.prepare(`INSERT INTO quote_raw (quote_id, raw_json) VALUES (?, ?)`);
    this._insRpc = db.prepare(
      `INSERT INTO rpc_probe (tick_id, url, ok, latency_ms, ledger, chosen, sim_errors, rpc_calls, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this._insLog = db.prepare(
      `INSERT INTO rpc_call_log (at, url, kind, calls, dur_ms) VALUES (?, ?, ?, ?, ?)`,
    );
    this._delManual = db.prepare(`DELETE FROM tick WHERE note = 'manual'`);
    this._hasCoherence = db.prepare(
      `SELECT 1 FROM coherence_probe WHERE venue = ? AND created_at >= ? LIMIT 1`,
    );
    this._insCoherence = db.prepare(
      `INSERT INTO coherence_probe
         (created_at, venue, pair, amount_in, incoherent, reason,
          net_quoted, net_simulated, delta_bps, route_json, trace_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  /** Inserts a tick and its quotes (+ raw) and the RPC probes atomically. Returns the tick id. */
  insertTickWithQuotes(tick: TickInsert, quotes: QuoteInsert[], rpcProbes: RpcProbeInsert[] = []): number {
    this.db.exec('BEGIN');
    try {
      const tickId = Number(
        this._insTick.run(tick.started_at, tick.finished_at, tick.cadence_sec, tick.blnd_usd, tick.xlm_usd,
          tick.eurc_usd, tick.eurc_stellar_mid, tick.ok ? 1 : 0, tick.source_errors, tick.note).lastInsertRowid,
      );
      for (const q of quotes) {
        const quoteId = Number(
          this._insQuote.run(tickId, q.pair, q.amount_in, q.source_id, q.net_out, q.net_confidence,
            q.price_impact_pct, q.gas_in_target, q.fee_total, q.route_summary, q.is_winner ? 1 : 0,
            q.eurc_path, q.duration_ms ?? null).lastInsertRowid,
        );
        if (q.raw_json !== null) this._insRaw.run(quoteId, q.raw_json);
      }
      for (const p of rpcProbes) {
        this._insRpc.run(tickId, p.url, p.ok ? 1 : 0, p.latency_ms, p.ledger, p.chosen ? 1 : 0, p.sim_errors, p.rpc_calls, p.error);
        // Logs the load into rpc_call_log if this is the chosen probe.
        if (p.chosen && p.rpc_calls > 0) {
          const kind = tick.note === 'manual' ? 'refresh' : 'auto';
          const durMs = (tick.finished_at != null)
            ? Math.max(0, new Date(tick.finished_at).getTime() - new Date(tick.started_at).getTime())
            : 0;
          this._insLog.run(tick.started_at, p.url, kind, p.rpc_calls, durMs);
        }
      }
      this.db.exec('COMMIT');
      return tickId;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  /** Deletes manual ticks (note='manual'). Called by the scheduled poll: the canonical
   *  data stays the regular cadence; manual refreshes are only provisional.
   *  Quotes/raw cascade (FK ON DELETE CASCADE). Returns the number of ticks deleted. */
  purgeManualTicks(): number {
    const r = this._delManual.run();
    return Number(r.changes);
  }

  /** Checks that at least one coherence probe exists for `venue` since `sinceIso`. */
  hasCoherenceProbeSince(venue: string, sinceIso: string): boolean {
    const row = this._hasCoherence.get(venue, sinceIso);
    return row !== undefined;
  }

  /** Inserts a coherence probe (quote vs sim). Outside the transaction — best-effort. */
  insertCoherenceProbe(row: CoherenceProbeInsert): void {
    this._insCoherence.run(
      row.created_at, row.venue, row.pair, row.amount_in,
      row.incoherent ? 1 : 0, row.reason,
      row.net_quoted, row.net_simulated, row.delta_bps,
      row.route_json, row.trace_json,
    );
  }

  /** Raw access (queries, maintenance, tests). */
  raw(): DatabaseSync {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

/** Opens (or creates) the database at the given path, applies PRAGMA + migration. */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  migrate(db);
  return new Db(db);
}

/** Interface for an RPC load-log row (manual quote). */
export interface RpcCallLogRow {
  at: string;
  url: string;
  kind: 'auto' | 'refresh' | 'quote';
  calls: number;
  dur_ms: number;
}

// Singleton write connection for appendRpcCallLog (avoids open/close on every call).
// Keyed by path: if the path changes (multi-DB tests) a new connection is opened.
let _rpcLogDb: DatabaseSync | null = null;
let _rpcLogDbPath = '';
let _rpcLogStmt: ReturnType<DatabaseSync['prepare']> | null = null;

function rpcLogConn(dbPath: string): { db: DatabaseSync; stmt: ReturnType<DatabaseSync['prepare']> } {
  if (!_rpcLogDb || _rpcLogDbPath !== dbPath) {
    // Close the previous connection before opening a new one (path change or first call).
    _rpcLogDb?.close();
    _rpcLogDb = null;
    _rpcLogStmt = null;
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 5000');
    const stmt = db.prepare(
      `INSERT INTO rpc_call_log (at, url, kind, calls, dur_ms) VALUES (?, ?, ?, ?, ?)`,
    );
    // Only commit state after prepare() succeeds — avoids partial/corrupt singleton on error.
    _rpcLogDb = db;
    _rpcLogStmt = stmt;
    _rpcLogDbPath = dbPath;
  }
  return { db: _rpcLogDb, stmt: _rpcLogStmt! };
}

/**
 * Inserts a row into rpc_call_log best-effort (fire-and-forget).
 * Reuses a singleton connection to avoid open/close WAL overhead on every call.
 * A failure is harmless (losing a log row is acceptable).
 */
export function appendRpcCallLog(dbPath: string, row: RpcCallLogRow): void {
  try {
    const { stmt } = rpcLogConn(dbPath);
    stmt.run(row.at, row.url, row.kind, row.calls, row.dur_ms);
  } catch { /* best-effort: losing a log row is harmless */ }
}
