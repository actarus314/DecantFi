import { describe, it, expect } from 'vitest';
import { openDb, type TickInsert, type QuoteInsert } from './index.js';
import { history, exportRows } from './queries.js';

function seed() {
  const db = openDb(':memory:');
  const tick: TickInsert = {
    started_at: '2026-06-16T10:00:00.000Z', finished_at: '2026-06-16T10:00:02.000Z', cadence_sec: 900,
    blnd_usd: 0.05, xlm_usd: 0.11, eur_usd: 1.08, ok: true, source_errors: null, note: null,
  };
  const quotes: QuoteInsert[] = [
    { pair: 'BLND->USDC', amount_in: 2_500_000_000n, source_id: 'xbull', net_out: 505_000_000n,
      net_confidence: 'exact', price_impact_pct: 1.2, gas_in_target: 0n, fee_total: null,
      route_summary: 'BLND->USDC', is_winner: true, eurc_path: null, raw_json: null,
      duration_ms: null },
    { pair: 'BLND->USDC', amount_in: 2_500_000_000n, source_id: 'horizon', net_out: 459_000_000n,
      net_confidence: 'exact', price_impact_pct: 10.1, gas_in_target: 0n, fee_total: null,
      route_summary: 'BLND->XLM->USDC', is_winner: false, eurc_path: null, raw_json: null,
      duration_ms: null },
  ];
  db.insertTickWithQuotes(tick, quotes);
  return db;
}

describe('history', () => {
  it('renvoie les gagnants par tick (1 ligne par sonde)', () => {
    const db = seed();
    const rows = history(db, { limit: 10 });
    expect(rows.length).toBe(1);
    expect(rows[0]!.source_id).toBe('xbull');
    expect(rows[0]!.net_out).toBe('50.5'); // formaté humain
    db.close();
  });
});

describe('exportRows', () => {
  it('CSV : en-tête + 1 ligne par gagnant', () => {
    const db = seed();
    const csv = exportRows(db, 'csv');
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('started_at');
    expect(lines.length).toBe(2);
    db.close();
  });
  it('JSON : tableau parseable', () => {
    const db = seed();
    const arr = JSON.parse(exportRows(db, 'json'));
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[0].source_id).toBe('xbull');
    db.close();
  });
});
