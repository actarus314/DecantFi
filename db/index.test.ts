import { describe, it, expect } from 'vitest';
import { openDb, type TickInsert, type QuoteInsert } from './index.js';

const tick: TickInsert = {
  started_at: '2026-06-16T10:00:00.000Z', finished_at: '2026-06-16T10:00:03.000Z',
  cadence_sec: 900, blnd_usd: 0.0512, xlm_usd: 0.11, eur_usd: 1.08,
  ok: true, source_errors: 'stellarbroker', note: null,
};
const quotes: QuoteInsert[] = [
  { pair: 'BLND->USDC', amount_in: 2_500_000_000n, source_id: 'xbull', net_out: 505_000_000n,
    net_confidence: 'exact', price_impact_pct: 1.2, gas_in_target: 1_000n, fee_total: null,
    route_summary: 'BLND->USDC', is_winner: true, eurc_path: null, raw_json: '{"toAmount":"505000000"}' },
  { pair: 'BLND->USDC', amount_in: 2_500_000_000n, source_id: 'horizon', net_out: 459_000_000n,
    net_confidence: 'exact', price_impact_pct: 10.1, gas_in_target: 0n, fee_total: null,
    route_summary: 'BLND->XLM->USDC', is_winner: false, eurc_path: null, raw_json: null },
];

describe('openDb + insertTickWithQuotes', () => {
  it('persiste un tick + ses quotes et préserve les stroops bigint', () => {
    const db = openDb(':memory:');
    const tickId = db.insertTickWithQuotes(tick, quotes);
    expect(tickId).toBeGreaterThan(0);

    const rows = db.raw().prepare('SELECT * FROM quote WHERE tick_id = ? ORDER BY is_winner DESC').all(tickId);
    expect(rows.length).toBe(2);
    expect((rows[0] as any).source_id).toBe('xbull');

    // bigint exact via setReadBigInts
    const stmt = db.raw().prepare('SELECT net_out FROM quote WHERE source_id = ?');
    stmt.setReadBigInts(true);
    expect((stmt.get('xbull') as any).net_out).toBe(505_000_000n);

    // raw stocké seulement quand présent
    const raws = db.raw().prepare('SELECT COUNT(*) AS n FROM quote_raw').get() as any;
    expect(Number(raws.n)).toBe(1);
    db.close();
  });

  it('ON DELETE CASCADE : supprimer un tick purge ses quotes et raw', () => {
    const db = openDb(':memory:');
    const tickId = db.insertTickWithQuotes(tick, quotes);
    db.raw().prepare('DELETE FROM tick WHERE id = ?').run(tickId);
    expect((db.raw().prepare('SELECT COUNT(*) AS n FROM quote').get() as any).n).toBe(0);
    expect((db.raw().prepare('SELECT COUNT(*) AS n FROM quote_raw').get() as any).n).toBe(0);
    db.close();
  });
});
