// Lecture du journal (gagnants par tick). Base des futures stats. Montants formatés humain à la sortie.
import type { Db } from './index.js';
import { fromStroops } from '../core/amount.js';

export interface HistoryRow {
  started_at: string; pair: string; amount_in: string; source_id: string;
  net_out: string | null; price_impact_pct: number | null; eurc_path: string | null;
}

const WINNERS_COLS = `t.started_at, q.pair, q.amount_in, q.source_id, q.net_out, q.price_impact_pct, q.eurc_path`;
const ORDER = `ORDER BY t.started_at DESC, q.pair, q.amount_in`;

// history : borné par TICK (limit = nombre de ticks) → ne coupe jamais un tick en deux.
const WINNERS_RECENT_SQL = `
  SELECT ${WINNERS_COLS} FROM quote q JOIN tick t ON t.id = q.tick_id
  WHERE q.is_winner = 1 AND q.tick_id IN (SELECT id FROM tick ORDER BY started_at DESC LIMIT ?)
  ${ORDER}
`;
const WINNERS_ALL_SQL = `
  SELECT ${WINNERS_COLS} FROM quote q JOIN tick t ON t.id = q.tick_id
  WHERE q.is_winner = 1 ${ORDER}
`;

/** Gagnants des N derniers TICKS (limit = nombre de ticks, défaut 50), du plus récent au plus ancien. */
export function history(db: Db, opts: { limit?: number } = {}): HistoryRow[] {
  const stmt = db.raw().prepare(WINNERS_RECENT_SQL);
  stmt.setReadBigInts(true);
  const rows = stmt.all(BigInt(opts.limit ?? 50)) as Array<Record<string, unknown>>;
  return rows.map(fmt);
}

/** Export complet des gagnants en CSV ou JSON. */
export function exportRows(db: Db, format: 'csv' | 'json'): string {
  const stmt = db.raw().prepare(WINNERS_ALL_SQL);
  stmt.setReadBigInts(true);
  const rows = (stmt.all() as Array<Record<string, unknown>>).map(fmt);
  if (format === 'json') return JSON.stringify(rows, null, 2);
  const cols: (keyof HistoryRow)[] = ['started_at', 'pair', 'amount_in', 'source_id', 'net_out', 'price_impact_pct', 'eurc_path'];
  const head = cols.join(',');
  const body = rows.map((r) => cols.map((c) => csvCell(r[c])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}

function fmt(r: Record<string, unknown>): HistoryRow {
  return {
    started_at: String(r.started_at),
    pair: String(r.pair),
    amount_in: fromStroops(r.amount_in as bigint),
    source_id: String(r.source_id),
    net_out: r.net_out === null ? null : fromStroops(r.net_out as bigint),
    price_impact_pct: r.price_impact_pct === null ? null : Number(r.price_impact_pct),
    eurc_path: r.eurc_path === null ? null : String(r.eurc_path),
  };
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
