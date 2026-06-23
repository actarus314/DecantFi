// Couche d'accès SQLite (node:sqlite). Écrit tick + quotes + raw en une transaction.
// Montants stroops en INTEGER (< 2^53, exacts) ; lecture bigint via setReadBigInts.
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
  /** Durée totale de cotation pour cette source (fetch + re-sim), en ms. null = non mesuré. */
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
  incoherent: boolean;       // converti en 0/1 à l'insert
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

  /** Insère un tick et ses quotes (+ raw) et les sondes RPC atomiquement. Renvoie l'id du tick. */
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
        // Logge la charge dans rpc_call_log si c'est la sonde choisie.
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

  /** Supprime les ticks manuels (note='manual'). Appelé par le poll programmé : la donnée
   *  canonique reste la cadence régulière ; les refresh manuels ne sont que provisoires.
   *  Les quotes/raw partent en cascade (FK ON DELETE CASCADE). Renvoie le nb de ticks supprimés. */
  purgeManualTicks(): number {
    const r = this._delManual.run();
    return Number(r.changes);
  }

  /** Vérifie qu'au moins une sonde de cohérence existe pour `venue` depuis `sinceIso`. */
  hasCoherenceProbeSince(venue: string, sinceIso: string): boolean {
    const row = this._hasCoherence.get(venue, sinceIso);
    return row !== undefined;
  }

  /** Insère une sonde de cohérence (quote vs sim). Hors transaction — best-effort. */
  insertCoherenceProbe(row: CoherenceProbeInsert): void {
    this._insCoherence.run(
      row.created_at, row.venue, row.pair, row.amount_in,
      row.incoherent ? 1 : 0, row.reason,
      row.net_quoted, row.net_simulated, row.delta_bps,
      row.route_json, row.trace_json,
    );
  }

  /** Accès brut (queries, maintenance, tests). */
  raw(): DatabaseSync {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

/** Ouvre (ou crée) la base au chemin donné, applique PRAGMA + migration. */
export function openDb(path: string): Db {
  const db = new DatabaseSync(path);
  migrate(db);
  return new Db(db);
}

/** Interface d'une ligne de charge RPC (devis manuel). */
export interface RpcCallLogRow {
  at: string;
  url: string;
  kind: 'auto' | 'refresh' | 'quote';
  calls: number;
  dur_ms: number;
}

// Connexion d'écriture singleton pour appendRpcCallLog (évite open/close à chaque appel).
// Keyée par chemin : si le chemin change (tests multi-DB) une nouvelle connexion est ouverte.
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
 * Insère une ligne dans rpc_call_log en best-effort (fire-and-forget).
 * Réutilise une connexion singleton pour éviter l'overhead open/close WAL à chaque appel.
 * Un échec est sans gravité (perdre une ligne de log acceptable).
 */
export function appendRpcCallLog(dbPath: string, row: RpcCallLogRow): void {
  try {
    const { stmt } = rpcLogConn(dbPath);
    stmt.run(row.at, row.url, row.kind, row.calls, row.dur_ms);
  } catch { /* best-effort : perdre une ligne de log est sans gravité */ }
}
