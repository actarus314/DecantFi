import { describe, it, expect } from 'vitest';
import { openDb, type TickInsert, type QuoteInsert } from '../db/index.js';
import { runMaintenance } from './maintenance.js';
import { toStroops } from '../core/amount.js';

const now = new Date('2026-06-16T12:00:00.000Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

function insertAt(db: ReturnType<typeof openDb>, startedAt: string, net: string): number {
  const tick: TickInsert = {
    started_at: startedAt, finished_at: startedAt, cadence_sec: 900,
    blnd_usd: 0.05, xlm_usd: 0.11, eur_usd: 1.08, ok: true, source_errors: null, note: null,
  };
  const quotes: QuoteInsert[] = [
    { pair: 'BLND->USDC', amount_in: toStroops('250'), source_id: 'xbull', net_out: toStroops(net),
      net_confidence: 'exact', price_impact_pct: 1.0, gas_in_target: 0n, fee_total: null,
      route_summary: 'BLND->USDC', is_winner: true, eurc_path: null, raw_json: '{"k":1}' },
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
