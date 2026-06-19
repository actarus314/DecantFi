// Couche d'accès SQLite (node:sqlite). Écrit tick + quotes + raw en une transaction.
// Montants stroops en INTEGER (< 2^53, exacts) ; lecture bigint via setReadBigInts.
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './schema.js';

export interface TickInsert {
  started_at: string; finished_at: string | null; cadence_sec: number;
  blnd_usd: number | null; xlm_usd: number | null; eur_usd: number | null;
  ok: boolean; source_errors: string | null; note: string | null;
}
export interface QuoteInsert {
  pair: string; amount_in: bigint; source_id: string;
  net_out: bigint | null; net_confidence: string | null; price_impact_pct: number | null;
  gas_in_target: bigint | null; fee_total: bigint | null; route_summary: string | null;
  is_winner: boolean; eurc_path: string | null; raw_json: string | null;
}

export interface RpcProbeInsert {
  url: string; ok: boolean; latency_ms: number | null;
  ledger: number | null; chosen: boolean; sim_errors: number; rpc_calls: number; error: string | null;
}

export class Db {
  constructor(private db: DatabaseSync) {}

  /** Insère un tick et ses quotes (+ raw) et les sondes RPC atomiquement. Renvoie l'id du tick. */
  insertTickWithQuotes(tick: TickInsert, quotes: QuoteInsert[], rpcProbes: RpcProbeInsert[] = []): number {
    const insTick = this.db.prepare(
      `INSERT INTO tick (started_at, finished_at, cadence_sec, blnd_usd, xlm_usd, eur_usd, ok, source_errors, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insQuote = this.db.prepare(
      `INSERT INTO quote (tick_id, pair, amount_in, source_id, net_out, net_confidence, price_impact_pct,
                          gas_in_target, fee_total, route_summary, is_winner, eurc_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insRaw = this.db.prepare(`INSERT INTO quote_raw (quote_id, raw_json) VALUES (?, ?)`);
    const insRpc = this.db.prepare(
      `INSERT INTO rpc_probe (tick_id, url, ok, latency_ms, ledger, chosen, sim_errors, rpc_calls, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.db.exec('BEGIN');
    try {
      const tickId = Number(
        insTick.run(tick.started_at, tick.finished_at, tick.cadence_sec, tick.blnd_usd, tick.xlm_usd,
          tick.eur_usd, tick.ok ? 1 : 0, tick.source_errors, tick.note).lastInsertRowid,
      );
      for (const q of quotes) {
        const quoteId = Number(
          insQuote.run(tickId, q.pair, q.amount_in, q.source_id, q.net_out, q.net_confidence,
            q.price_impact_pct, q.gas_in_target, q.fee_total, q.route_summary, q.is_winner ? 1 : 0,
            q.eurc_path).lastInsertRowid,
        );
        if (q.raw_json !== null) insRaw.run(quoteId, q.raw_json);
      }
      for (const p of rpcProbes) {
        insRpc.run(tickId, p.url, p.ok ? 1 : 0, p.latency_ms, p.ledger, p.chosen ? 1 : 0, p.sim_errors, p.rpc_calls, p.error);
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
    const r = this.db.prepare(`DELETE FROM tick WHERE note = 'manual'`).run();
    return Number(r.changes);
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
