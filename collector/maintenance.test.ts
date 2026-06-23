import { describe, it, expect } from 'vitest';
import { openDb, type TickInsert, type QuoteInsert } from '../db/index.js';
import { runMaintenance } from './maintenance.js';
import { toStroops } from '../core/amount.js';

const now = new Date('2026-06-16T12:00:00.000Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

function insertAt(db: ReturnType<typeof openDb>, startedAt: string, net: string): number {
  const tick: TickInsert = {
    started_at: startedAt, finished_at: startedAt, cadence_sec: 900,
    blnd_usd: 0.05, xlm_usd: 0.11, eurc_usd: 1.08, eurc_stellar_mid: null, ok: true, source_errors: null, note: null,
  };
  const quotes: QuoteInsert[] = [
    { pair: 'BLND->USDC', amount_in: toStroops('250'), source_id: 'xbull', net_out: toStroops(net),
      net_confidence: 'exact', price_impact_pct: 1.0, gas_in_target: 0n, fee_total: null,
      route_summary: 'BLND->USDC', is_winner: true, eurc_path: null, raw_json: '{"k":1}',
      duration_ms: null },
  ];
  return db.insertTickWithQuotes(tick, quotes);
}

describe('runMaintenance', () => {
  it('purge le raw au-delà de 90 j, garde le structuré', () => {
    const db = openDb(':memory:');
    insertAt(db, daysAgo(120), '12.0'); // raw doit partir
    insertAt(db, daysAgo(10), '12.6');  // raw doit rester
    runMaintenance(db, { rawRetentionDays: 90, rollupAfterDays: 0 }, now);
    const rawCount = (db.raw().prepare('SELECT COUNT(*) AS n FROM quote_raw').get() as any).n;
    expect(Number(rawCount)).toBe(1);
    const tickCount = (db.raw().prepare('SELECT COUNT(*) AS n FROM tick').get() as any).n;
    expect(Number(tickCount)).toBe(2); // structuré intact
    db.close();
  });

  it('rollup horaire au-delà de 365 j puis supprime les lignes par-tick', () => {
    const db = openDb(':memory:');
    insertAt(db, '2025-01-01T14:05:00.000Z', '12.0');
    insertAt(db, '2025-01-01T14:35:00.000Z', '12.4'); // même bucket horaire
    insertAt(db, daysAgo(5), '12.6');                  // récent : conservé tel quel
    runMaintenance(db, { rawRetentionDays: 90, rollupAfterDays: 365 }, now);

    const ticks = (db.raw().prepare('SELECT COUNT(*) AS n FROM tick').get() as any).n;
    expect(Number(ticks)).toBe(1); // seul le récent reste en par-tick

    const roll = db.raw().prepare('SELECT * FROM rollup_hourly');
    roll.setReadBigInts(true);
    const rows = roll.all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].hour_utc).toBe('2025-01-01T14:00:00Z');
    expect(Number(rows[0].n_ticks)).toBe(2);
    expect(rows[0].net_min).toBe(toStroops('12.0'));
    expect(rows[0].net_max).toBe(toStroops('12.4'));
    expect(JSON.parse(rows[0].winner_dist).xbull).toBe(2);
    db.close();
  });

  it('rawRetentionDays=0 skips raw purge entirely (0 = off, symmetric with rollup)', () => {
    const db = openDb(':memory:');
    insertAt(db, daysAgo(120), '12.0'); // old row — must NOT be purged when rawRetentionDays=0
    insertAt(db, daysAgo(10), '12.6');
    runMaintenance(db, { rawRetentionDays: 0, rollupAfterDays: 0 }, now);
    const rawCount = (db.raw().prepare('SELECT COUNT(*) AS n FROM quote_raw').get() as any).n;
    expect(Number(rawCount)).toBe(2); // both rows kept: purge skipped
    db.close();
  });

  it('rollupAfterDays=0 skips rpc_call_log purge (0 = off)', () => {
    const db = openDb(':memory:');
    // Insert a rpc_call_log row dated far in the past
    db.raw().prepare(
      `INSERT INTO rpc_call_log (at, url, kind, calls, dur_ms) VALUES (?, ?, ?, ?, ?)`,
    ).run(daysAgo(500), 'https://rpc.example.com', 'auto', 5, 100);
    const before = (db.raw().prepare('SELECT COUNT(*) AS n FROM rpc_call_log').get() as any).n;
    expect(Number(before)).toBe(1);
    // rollupAfterDays=0 must NOT purge rpc_call_log
    runMaintenance(db, { rawRetentionDays: 90, rollupAfterDays: 0 }, now);
    const after = (db.raw().prepare('SELECT COUNT(*) AS n FROM rpc_call_log').get() as any).n;
    expect(Number(after)).toBe(1); // row must still be there
    // Rollup table must also be empty (rollup skipped)
    const rollup = (db.raw().prepare('SELECT COUNT(*) AS n FROM rollup_hourly').get() as any).n;
    expect(Number(rollup)).toBe(0);
    db.close();
  });

  it('idempotent : deux passages ne doublent pas le rollup', () => {
    const db = openDb(':memory:');
    insertAt(db, '2025-01-01T14:05:00.000Z', '12.0');
    runMaintenance(db, { rawRetentionDays: 90, rollupAfterDays: 365 }, now);
    insertAt(db, '2025-01-01T14:35:00.000Z', '12.4');
    runMaintenance(db, { rawRetentionDays: 90, rollupAfterDays: 365 }, now);
    const rows = db.raw().prepare('SELECT n_ticks FROM rollup_hourly WHERE hour_utc = ?').all('2025-01-01T14:00:00Z') as any[];
    expect(rows.length).toBe(1);
    expect(Number(rows[0].n_ticks)).toBe(2); // cumulé, pas dupliqué
    db.close();
  });
});
