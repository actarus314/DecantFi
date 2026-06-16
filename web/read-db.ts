// Ouvre la DB en lecture (RW + query_only pour robustesse WAL). Pas de migrate.
import { DatabaseSync, type StatementSync } from 'node:sqlite';

/** Ouvre la DB en mode lecture robuste (RW + PRAGMA query_only + busy_timeout). */
export function openReadOnly(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA query_only = ON');
  return db;
}

/** Prépare un statement et active setReadBigInts(true). */
export function prepBig(db: DatabaseSync, sql: string): StatementSync {
  const stmt = db.prepare(sql);
  stmt.setReadBigInts(true);
  return stmt;
}
