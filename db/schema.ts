// Schéma SQLite du collecteur (4 tables) + PRAGMA. Stockage UTC ; montants en stroops INTEGER.
import type { DatabaseSync } from 'node:sqlite';

export const DDL = `
CREATE TABLE IF NOT EXISTS tick (
  id            INTEGER PRIMARY KEY,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  cadence_sec   INTEGER NOT NULL,
  blnd_usd      REAL, xlm_usd REAL, eur_usd REAL,
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
  winner_dist  TEXT,
  blnd_usd_avg REAL,
  UNIQUE(hour_utc, pair, amount_in)
);
CREATE INDEX IF NOT EXISTS idx_quote_tick        ON quote(tick_id);
CREATE INDEX IF NOT EXISTS idx_quote_pair_winner ON quote(pair, is_winner);
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
`;

/** Applique PRAGMA (avant création des tables pour auto_vacuum) puis crée le schéma. Idempotent. */
export function migrate(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA auto_vacuum = INCREMENTAL'); // effectif sur DB neuve (avant toute table)
  db.exec('PRAGMA temp_store = MEMORY');       // aucun fichier temp hors volume (read_only)
  db.exec(DDL);
}
