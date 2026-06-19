import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { openDb, type TickInsert, type QuoteInsert, type RpcProbeInsert } from './index.js';
import { migrate } from './schema.js';

const tick: TickInsert = {
  started_at: '2026-06-16T10:00:00.000Z', finished_at: '2026-06-16T10:00:03.000Z',
  cadence_sec: 900, blnd_usd: 0.0512, xlm_usd: 0.11, eur_usd: 1.08,
  ok: true, source_errors: 'stellarbroker', note: null,
};
const quotes: QuoteInsert[] = [
  { pair: 'BLND->USDC', amount_in: 2_500_000_000n, source_id: 'xbull', net_out: 505_000_000n,
    net_confidence: 'exact', price_impact_pct: 1.2, gas_in_target: 1_000n, fee_total: null,
    route_summary: 'BLND->USDC', is_winner: true, eurc_path: null, raw_json: '{"toAmount":"505000000"}',
    duration_ms: 320 },
  { pair: 'BLND->USDC', amount_in: 2_500_000_000n, source_id: 'horizon', net_out: 459_000_000n,
    net_confidence: 'exact', price_impact_pct: 10.1, gas_in_target: 0n, fee_total: null,
    route_summary: 'BLND->XLM->USDC', is_winner: false, eurc_path: null, raw_json: null,
    duration_ms: null },
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

  it('purgeManualTicks : ne supprime que les ticks note=manual (+ cascade), garde le reste', () => {
    const db = openDb(':memory:');
    const scheduled = db.insertTickWithQuotes(tick, quotes);
    db.insertTickWithQuotes({ ...tick, started_at: '2026-06-16T10:05:00.000Z', note: 'manual' }, quotes);
    db.insertTickWithQuotes({ ...tick, started_at: '2026-06-16T10:06:00.000Z', note: 'exception: boom', ok: false }, []);

    expect(db.purgeManualTicks()).toBe(1); // 1 seul tick manuel
    const ids = db.raw().prepare('SELECT id, note FROM tick ORDER BY id').all() as any[];
    expect(ids.map((r) => r.note)).toEqual([null, 'exception: boom']); // manuel parti, programmé + exception restent
    // quotes du tick manuel partis en cascade ; ceux du programmé restent
    const qn = db.raw().prepare('SELECT COUNT(*) AS n FROM quote WHERE tick_id = ?').get(scheduled) as any;
    expect(Number(qn.n)).toBe(2);
    db.close();
  });
});

describe('insertTickWithQuotes — rpc_call_log', () => {
  const probe: RpcProbeInsert = {
    url: 'https://rpc.example.com',
    ok: true, latency_ms: 120, ledger: 55000,
    chosen: true, sim_errors: 0, rpc_calls: 42, error: null,
  };

  it('écrit une ligne rpc_call_log kind=auto quand note=null et chosen probe a rpc_calls>0', () => {
    const db = openDb(':memory:');
    const t: TickInsert = {
      started_at: '2026-06-19T10:00:00.000Z', finished_at: '2026-06-19T10:00:05.000Z',
      cadence_sec: 900, blnd_usd: 0.05, xlm_usd: 0.11, eur_usd: 1.08,
      ok: true, source_errors: null, note: null,
    };
    db.insertTickWithQuotes(t, [], [probe]);
    const rows = db.raw().prepare('SELECT * FROM rpc_call_log').all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('auto');
    expect(rows[0].url).toBe('https://rpc.example.com');
    expect(rows[0].calls).toBe(42);
    expect(rows[0].dur_ms).toBe(5000);
    db.close();
  });

  it('écrit kind=refresh quand note=manual', () => {
    const db = openDb(':memory:');
    const t: TickInsert = {
      started_at: '2026-06-19T10:00:00.000Z', finished_at: '2026-06-19T10:00:03.000Z',
      cadence_sec: 900, blnd_usd: 0.05, xlm_usd: 0.11, eur_usd: 1.08,
      ok: true, source_errors: null, note: 'manual',
    };
    db.insertTickWithQuotes(t, [], [probe]);
    const rows = db.raw().prepare('SELECT * FROM rpc_call_log').all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('refresh');
    db.close();
  });

  it('n\'écrit aucune ligne si rpc_calls=0 (sonde non-chosen ou pas d\'appels)', () => {
    const db = openDb(':memory:');
    const t: TickInsert = {
      started_at: '2026-06-19T10:00:00.000Z', finished_at: '2026-06-19T10:00:01.000Z',
      cadence_sec: 900, blnd_usd: 0.05, xlm_usd: 0.11, eur_usd: 1.08,
      ok: true, source_errors: null, note: null,
    };
    const zeroCalls: RpcProbeInsert = { ...probe, rpc_calls: 0 };
    db.insertTickWithQuotes(t, [], [zeroCalls]);
    const rows = db.raw().prepare('SELECT COUNT(*) AS n FROM rpc_call_log').get() as any;
    expect(Number(rows.n)).toBe(0);
    db.close();
  });

  it('n\'écrit pas de ligne pour une sonde non-chosen', () => {
    const db = openDb(':memory:');
    const t: TickInsert = {
      started_at: '2026-06-19T10:00:00.000Z', finished_at: '2026-06-19T10:00:01.000Z',
      cadence_sec: 900, blnd_usd: 0.05, xlm_usd: 0.11, eur_usd: 1.08,
      ok: true, source_errors: null, note: null,
    };
    const notChosen: RpcProbeInsert = { ...probe, chosen: false };
    db.insertTickWithQuotes(t, [], [notChosen]);
    const rows = db.raw().prepare('SELECT COUNT(*) AS n FROM rpc_call_log').get() as any;
    expect(Number(rows.n)).toBe(0);
    db.close();
  });
});

describe('migrate : migration additive idempotente', () => {
  it('ajoute rpc_calls à une rpc_probe pré-existante sans la colonne (régression incident 429/no-column)', () => {
    const db = new DatabaseSync(':memory:');
    // Simule une DB créée AVANT l'ajout de rpc_calls (schéma déployé en 5011b0d)
    db.exec('CREATE TABLE tick (id INTEGER PRIMARY KEY, started_at TEXT)');
    db.exec(`CREATE TABLE rpc_probe (
      id INTEGER PRIMARY KEY, tick_id INTEGER, url TEXT, ok INTEGER, latency_ms INTEGER,
      ledger INTEGER, chosen INTEGER, sim_errors INTEGER DEFAULT 0, error TEXT
    )`);
    const before = db.prepare('PRAGMA table_info(rpc_probe)').all() as Array<{ name: string }>;
    expect(before.some((c) => c.name === 'rpc_calls')).toBe(false);

    migrate(db); // doit ALTER TABLE ADD COLUMN rpc_calls

    const after = db.prepare('PRAGMA table_info(rpc_probe)').all() as Array<{ name: string }>;
    expect(after.some((c) => c.name === 'rpc_calls')).toBe(true);
    // l'INSERT nommant rpc_calls (celui qui crashait le collecteur) fonctionne désormais
    db.exec("INSERT INTO tick (started_at) VALUES ('2026-06-19T00:00:00Z')");
    db.exec('INSERT INTO rpc_probe (tick_id, url, ok, chosen, rpc_calls) VALUES (1, \'u\', 1, 1, 7)');
    const row = db.prepare('SELECT rpc_calls FROM rpc_probe').get() as { rpc_calls: number };
    expect(Number(row.rpc_calls)).toBe(7);
    db.close();
  });

  it('idempotent : re-migrer une DB déjà à jour ne change rien', () => {
    const db = openDb(':memory:'); // crée le schéma complet (rpc_calls inclus)
    expect(() => migrate(db.raw())).not.toThrow();
    const cols = db.raw().prepare('PRAGMA table_info(rpc_probe)').all() as Array<{ name: string }>;
    expect(cols.filter((c) => c.name === 'rpc_calls').length).toBe(1);
    db.close();
  });
});
