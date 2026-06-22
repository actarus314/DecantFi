// Schéma SQLite du collecteur (4 tables) + PRAGMA. Stockage UTC ; montants en stroops INTEGER.
import type { DatabaseSync } from 'node:sqlite';

export const DDL = `
CREATE TABLE IF NOT EXISTS tick (
  id            INTEGER PRIMARY KEY,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  cadence_sec   INTEGER NOT NULL,
  blnd_usd      REAL, xlm_usd REAL, eurc_usd REAL, eurc_stellar_mid REAL,
  ok            INTEGER NOT NULL,
  source_errors TEXT,
  note          TEXT
);
CREATE TABLE IF NOT EXISTS quote (
  id              INTEGER PRIMARY KEY,
  tick_id         INTEGER NOT NULL REFERENCES tick(id) ON DELETE CASCADE,
  pair            TEXT NOT NULL,
  amount_in       INTEGER NOT NULL,
  source_id       TEXT NOT NULL,
  net_out         INTEGER,
  net_confidence  TEXT,
  price_impact_pct REAL,
  gas_in_target   INTEGER,
  fee_total       INTEGER,
  route_summary   TEXT,
  is_winner       INTEGER NOT NULL,
  eurc_path       TEXT
);
CREATE TABLE IF NOT EXISTS quote_raw (
  quote_id  INTEGER PRIMARY KEY REFERENCES quote(id) ON DELETE CASCADE,
  raw_json  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rollup_hourly (
  id           INTEGER PRIMARY KEY,
  hour_utc     TEXT NOT NULL,
  pair         TEXT NOT NULL,
  amount_in    INTEGER NOT NULL,
  n_ticks      INTEGER NOT NULL,
  net_min      INTEGER, net_med INTEGER, net_max INTEGER,
  impact_avg   REAL,
  impact_avg_local REAL,
  winner_dist  TEXT,
  blnd_usd_avg REAL,
  UNIQUE(hour_utc, pair, amount_in)
);
CREATE INDEX IF NOT EXISTS idx_quote_tick        ON quote(tick_id);
CREATE INDEX IF NOT EXISTS idx_quote_pair_winner ON quote(pair, is_winner);
CREATE INDEX IF NOT EXISTS idx_quote_tick_pair_amount_net ON quote(tick_id, pair, amount_in, net_out);
CREATE INDEX IF NOT EXISTS idx_tick_started      ON tick(started_at);
CREATE INDEX IF NOT EXISTS idx_rollup_bucket     ON rollup_hourly(pair, amount_in, hour_utc);
CREATE TABLE IF NOT EXISTS rpc_probe (
  id         INTEGER PRIMARY KEY,
  tick_id    INTEGER NOT NULL REFERENCES tick(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  ok         INTEGER NOT NULL,
  latency_ms INTEGER,
  ledger     INTEGER,
  chosen     INTEGER NOT NULL,
  sim_errors INTEGER NOT NULL DEFAULT 0,
  rpc_calls  INTEGER NOT NULL DEFAULT 0,
  error      TEXT
);
CREATE INDEX IF NOT EXISTS idx_rpc_probe_tick ON rpc_probe(tick_id);
CREATE TABLE IF NOT EXISTS rpc_call_log (
  id     INTEGER PRIMARY KEY,
  at     TEXT NOT NULL,
  url    TEXT NOT NULL,
  kind   TEXT NOT NULL,
  calls  INTEGER NOT NULL,
  dur_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rpc_call_log_at ON rpc_call_log(at);
CREATE TABLE IF NOT EXISTS coherence_probe (
  id            INTEGER PRIMARY KEY,
  created_at    TEXT NOT NULL,
  venue         TEXT NOT NULL,
  pair          TEXT NOT NULL,
  amount_in     INTEGER NOT NULL,
  incoherent    INTEGER NOT NULL,
  reason        TEXT,
  net_quoted    INTEGER,
  net_simulated INTEGER,
  delta_bps     INTEGER,
  route_json    TEXT,
  trace_json    TEXT
);
CREATE INDEX IF NOT EXISTS idx_coherence_venue   ON coherence_probe(venue);
CREATE INDEX IF NOT EXISTS idx_coherence_created ON coherence_probe(created_at);
`;

/** Ajoute une colonne si elle manque (CREATE TABLE IF NOT EXISTS n'altère PAS une table existante :
 *  une colonne ajoutée au DDL après coup ne s'applique jamais à une DB déjà créée → "no column named X"). */
function ensureColumn(db: DatabaseSync, table: string, column: string, decl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

/** Renomme une colonne si oldCol existe et newCol est absent (SQLite ≥3.25). Idempotent. */
function ensureRename(db: DatabaseSync, table: string, oldCol: string, newCol: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const hasOld = cols.some((c) => c.name === oldCol);
  const hasNew = cols.some((c) => c.name === newCol);
  if (hasOld && !hasNew) {
    db.exec(`ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`);
  }
}

/** Applique PRAGMA (avant création des tables pour auto_vacuum) puis crée le schéma. Idempotent. */
export function migrate(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA auto_vacuum = INCREMENTAL'); // effectif sur DB neuve (avant toute table)
  db.exec('PRAGMA temp_store = MEMORY');       // aucun fichier temp hors volume (read_only)
  db.exec(DDL);

  // Migrations additives idempotentes (pour les DB créées avant l'ajout d'une colonne).
  // Renommage eur_usd → eurc_usd (avant ensureColumn pour éviter collision).
  ensureRename(db, 'tick', 'eur_usd', 'eurc_usd');
  ensureColumn(db, 'tick', 'eurc_stellar_mid', 'REAL');
  ensureColumn(db, 'rollup_hourly', 'impact_avg_local', 'REAL');
  ensureColumn(db, 'rpc_probe', 'rpc_calls', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'quote', 'duration_ms', 'INTEGER');
}
