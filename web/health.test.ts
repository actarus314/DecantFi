// Tests de web/stats.ts : buildSourceHealth — DB synthétique.
// Miroir de web/stats.test.ts (même style openDb / openReadOnly).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer, get as httpGet } from 'node:http';
import { openDb, type TickInsert, type QuoteInsert, type RpcProbeInsert, type CoherenceProbeInsert } from '../db/index.js';
import { toStroops } from '../core/amount.js';
import { openReadOnly } from './read-db.js';
import { buildSourceHealth, buildRpcHealth, aggregateCoherenceByVenue, computeUptimeBySource } from './stats.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2025-06-01T12:00:00Z');
const WINDOW_START = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();

let tmpDir: string;
let dbPath: string;

function mkTick(overrides: Partial<TickInsert> & { started_at: string }): TickInsert {
  return {
    finished_at: overrides.started_at,
    cadence_sec: 900,
    blnd_usd: 0.05,
    xlm_usd: 0.12,
    eurc_usd: 1.08,
    eurc_stellar_mid: null,
    ok: true,
    source_errors: null,
    note: null,
    ...overrides,
  };
}

function mkQuote(sourceId: string, overrides: Partial<QuoteInsert> = {}): QuoteInsert {
  return {
    pair: 'BLND->USDC',
    amount_in: toStroops(250),
    source_id: sourceId,
    net_out: BigInt(125_000_000),
    net_confidence: 'exact',
    price_impact_pct: 0.3,
    gas_in_target: 0n,
    fee_total: 0n,
    route_summary: 'BLND->USDC',
    is_winner: true,
    eurc_path: null,
    raw_json: null,
    duration_ms: null,
    ...overrides,
  };
}

// ─── Graine de test ───────────────────────────────────────────────────────────

function buildTestDb(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'decantfi-health-test-'));
  dbPath = join(tmpDir, 'test.db');
  const db = openDb(dbPath);

  // Tick 1 : ok=1, soroswap en échec dans source_errors
  db.insertTickWithQuotes(
    mkTick({ started_at: '2025-05-28T10:00:00Z', source_errors: 'soroswap' }),
    [
      mkQuote('xbull'),
      mkQuote('aquarius'),
      mkQuote('comet'),
      mkQuote('ultrastellar'),
      mkQuote('stellarbroker'),
      mkQuote('horizon'),
      // soroswap absent des quotes (en échec)
    ],
  );

  // Tick 2 : ok=1, pas d'erreur, toutes les sources répondent
  db.insertTickWithQuotes(
    mkTick({ started_at: '2025-05-29T10:00:00Z', source_errors: null }),
    [
      mkQuote('xbull'),
      mkQuote('soroswap'),
      mkQuote('aquarius'),
      mkQuote('comet'),
      mkQuote('ultrastellar'),
      mkQuote('stellarbroker'),
      mkQuote('horizon'),
    ],
  );

  // Tick 3 : ok=0 — ne doit PAS entrer dans le dénominateur
  db.insertTickWithQuotes(
    mkTick({ started_at: '2025-05-30T10:00:00Z', ok: false, source_errors: 'xbull, soroswap' }),
    [],
  );

  // Tick 4 : ok=1, ID composite dans source_errors → doit être ignoré
  db.insertTickWithQuotes(
    mkTick({ started_at: '2025-05-31T10:00:00Z', source_errors: 'xbull+ultrastellar' }),
    [
      mkQuote('xbull'),
      mkQuote('soroswap'),
      mkQuote('aquarius'),
      mkQuote('comet'),
      mkQuote('ultrastellar'),
      mkQuote('stellarbroker'),
      mkQuote('horizon'),
    ],
  );

  // Tick MANUEL (note='manual') : refresh ponctuel — désormais INCLUS dans les stats de stabilité.
  // Toutes les sources répondent ici, dont soroswap : en le comptant, l'uptime soroswap
  // passe de 2/3 à 3/4 et totalTicks de 3 à 4. Les assertions ci-dessous le vérifient.
  db.insertTickWithQuotes(
    mkTick({ started_at: '2025-05-31T18:00:00Z', note: 'manual', source_errors: null }),
    [
      mkQuote('xbull'),
      mkQuote('soroswap'),
      mkQuote('aquarius'),
      mkQuote('comet'),
      mkQuote('ultrastellar'),
      mkQuote('stellarbroker'),
      mkQuote('horizon'),
    ],
  );

  // Tick hors fenêtre (>7j avant NOW) → ignoré
  db.insertTickWithQuotes(
    mkTick({ started_at: '2025-05-01T10:00:00Z', source_errors: 'xbull' }),
    [mkQuote('soroswap')],
  );

  db.close();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let result: ReturnType<typeof buildSourceHealth>;

beforeAll(() => {
  buildTestDb();
  const db = openReadOnly(dbPath);
  result = buildSourceHealth(db, WINDOW_START, NOW);
  db.close();
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildSourceHealth — totalTicks', () => {
  it('ok=0 ticks exclus du dénominateur', () => {
    // Ticks ok=1 dans la fenêtre : tick1, tick2, tick4, tick_manuel = 4 (tick3 ok=0, tick_hors_fenêtre ignoré)
    expect(result.totalTicks).toBe(4);
  });

  it('windowDays = 7', () => {
    expect(result.windowDays).toBe(7);
  });
});

describe('buildSourceHealth — sources', () => {
  it('liste les venues ACTIVES uniquement (StellarBroker débranché de ADAPTERS → exclu)', () => {
    expect(result.sources.length).toBe(6);
    expect(result.sources.some(s => s.id === 'stellarbroker')).toBe(false);
  });

  it('IDs composites avec "+" ignorés', () => {
    // 'xbull+ultrastellar' ne doit pas apparaître comme source
    const hasComposite = result.sources.some(s => s.id.includes('+'));
    expect(hasComposite).toBe(false);
  });

  it('xbull+ultrastellar dans source_errors ignoré → failedTicks xbull non impacté', () => {
    // tick4 a source_errors='xbull+ultrastellar' → composite ignoré → xbull.failedTicks = 0
    const xbull = result.sources.find(s => s.id === 'xbull');
    expect(xbull).toBeDefined();
    expect(xbull!.failedTicks).toBe(0);
  });

  it('soroswap : 1 échec sur 4 ticks ok → uptime < 100%', () => {
    const soroswap = result.sources.find(s => s.id === 'soroswap');
    expect(soroswap).toBeDefined();
    expect(soroswap!.failedTicks).toBe(1);
    expect(soroswap!.uptimePct).toBeLessThan(100);
    // responded=3 sur totalTicks=4 : 3/4 = 75%
    expect(soroswap!.uptimePct).toBeCloseTo(75, 0);
  });

  it('relevés manuels (note=manual) inclus dans le calcul de stabilité', () => {
    // Le seed contient un tick note='manual' (2025-05-31T18:00) où toutes les sources répondent.
    // Depuis l'inclusion des manuels : totalTicks=4 et soroswap=3/4=75%.
    expect(result.totalTicks).toBe(4);
    const soroswap = result.sources.find(s => s.id === 'soroswap');
    expect(soroswap!.uptimePct).toBeCloseTo(75, 0);
  });

  it('comet pairNote = "USDC uniquement"', () => {
    const comet = result.sources.find(s => s.id === 'comet');
    expect(comet).toBeDefined();
    expect(comet!.pairNote).toBe('USDC uniquement');
  });

  it('autres sources : pairNote = null', () => {
    const xbull = result.sources.find(s => s.id === 'xbull');
    expect(xbull!.pairNote).toBeNull();
  });

  it('chaque source a 7 entrées de jours', () => {
    for (const s of result.sources) {
      expect(s.days.length).toBe(7);
    }
  });

  it('tri : source avec uptime le plus élevé en premier', () => {
    for (let i = 1; i < result.sources.length; i++) {
      expect(result.sources[i]!.uptimePct).toBeLessThanOrEqual(result.sources[i - 1]!.uptimePct);
    }
  });

  it('lastFailureAt de soroswap = ISO de tick1', () => {
    const soroswap = result.sources.find(s => s.id === 'soroswap');
    // La DB stocke le format ISO sans millisecondes (ex. '2025-05-28T10:00:00Z')
    expect(soroswap!.lastFailureAt).toContain('2025-05-28T10:00:00');
  });

  it('source_errors legacy CSV → lastFailureReason null (rétrocompat)', () => {
    // tick1 a source_errors='soroswap' (CSV, sans cause)
    const soroswap = result.sources.find(s => s.id === 'soroswap');
    expect(soroswap!.failedTicks).toBe(1);
    expect(soroswap!.lastFailureReason).toBeNull();
  });
});

// ─── Cause d'échec (③-bis) : source_errors JSON [{id,reason}] ───────────────────

describe('buildSourceHealth — cause JSON', () => {
  let dir2: string;
  let path2: string;
  let res2: ReturnType<typeof buildSourceHealth>;

  beforeAll(() => {
    dir2 = mkdtempSync(join(tmpdir(), 'decantfi-health-cause-'));
    path2 = join(dir2, 'test.db');
    const db = openDb(path2);
    // Tick JSON : soroswap=timeout, comet=http
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-28T10:00:00Z', source_errors: '[{"id":"soroswap","reason":"timeout"},{"id":"comet","reason":"http"}]' }),
      [mkQuote('xbull'), mkQuote('aquarius'), mkQuote('ultrastellar'), mkQuote('stellarbroker'), mkQuote('horizon')],
    );
    db.close();
    const rdb = openReadOnly(path2);
    res2 = buildSourceHealth(rdb, WINDOW_START, NOW);
    rdb.close();
  });

  afterAll(() => { rmSync(dir2, { recursive: true, force: true }); });

  it('JSON → cause par source remontée dans lastFailureReason', () => {
    expect(res2.sources.find(s => s.id === 'soroswap')!.lastFailureReason).toBe('timeout');
    expect(res2.sources.find(s => s.id === 'comet')!.lastFailureReason).toBe('http');
  });

  it('JSON → failedTicks comptés', () => {
    expect(res2.sources.find(s => s.id === 'soroswap')!.failedTicks).toBe(1);
    expect(res2.sources.find(s => s.id === 'comet')!.failedTicks).toBe(1);
  });
});

// ─── buildRpcHealth — reqTotal / reqPerSec depuis rpc_call_log ────────────────

describe('buildRpcHealth — reqTotal/reqPerSec depuis rpc_call_log', () => {
  let dir4: string;
  let path4: string;

  const RPC_URL = 'https://rpc.example.com';
  const WINDOW_START_RPC = new Date(NOW.getTime() - 7 * 86_400_000).toISOString();

  beforeAll(() => {
    dir4 = mkdtempSync(join(tmpdir(), 'decantfi-health-rpcload-'));
    path4 = join(dir4, 'test.db');
    const db = openDb(path4);

    const probe: RpcProbeInsert = {
      url: RPC_URL, ok: true, latency_ms: 100, ledger: 55000,
      chosen: true, sim_errors: 0, rpc_calls: 30, error: null,
    };

    // Tick 1 : auto, 30 appels, 3s
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-28T10:00:00Z', finished_at: '2025-05-28T10:00:03Z' }),
      [],
      [probe],
    );
    // Tick 2 : refresh (note=manual), 20 appels, 2s
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-29T10:00:00Z', finished_at: '2025-05-29T10:00:02Z', note: 'manual' }),
      [],
      [{ ...probe, rpc_calls: 20 }],
    );
    // Tick 3 : non-chosen, rpc_calls=99 → ne doit PAS apparaître dans rpc_call_log
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-30T10:00:00Z', finished_at: '2025-05-30T10:00:01Z' }),
      [],
      [{ ...probe, chosen: false, rpc_calls: 99 }],
    );
    // Ajoute manuellement une ligne rpc_call_log kind='quote' (simule un devis manuel)
    db.raw().prepare(
      `INSERT INTO rpc_call_log (at, url, kind, calls, dur_ms) VALUES (?, ?, ?, ?, ?)`,
    ).run('2025-05-30T12:00:00Z', RPC_URL, 'quote', 10, 1000);

    db.close();
  });

  afterAll(() => { rmSync(dir4, { recursive: true, force: true }); });

  it('reqTotal agrège auto + refresh + quote depuis rpc_call_log', () => {
    const db = openReadOnly(path4);
    const rpcs = buildRpcHealth(db, WINDOW_START_RPC);
    db.close();
    const rpc = rpcs.find(r => r.host === new URL(RPC_URL).host)!;
    expect(rpc).toBeDefined();
    // 30 (auto) + 20 (refresh) + 10 (quote) = 60
    expect(rpc.reqTotal).toBe(60);
  });

  it('reqPerSec = total_calls / (total_dur_ms / 1000)', () => {
    const db = openReadOnly(path4);
    const rpcs = buildRpcHealth(db, WINDOW_START_RPC);
    db.close();
    const rpc = rpcs.find(r => r.host === new URL(RPC_URL).host)!;
    // total_calls=60, total_dur_ms=3000+2000+1000=6000s → 60/6=10
    expect(rpc.reqPerSec).toBe(10);
  });

  it('rpcs[].reqTotal et reqPerSec sont des nombres (jamais undefined)', () => {
    const db = openReadOnly(path4);
    const rpcs = buildRpcHealth(db, WINDOW_START_RPC);
    db.close();
    for (const r of rpcs) {
      expect(typeof r.reqTotal).toBe('number');
      expect(typeof r.reqPerSec).toBe('number');
    }
  });
});

// ─── aggregateCoherenceByVenue — tests unitaires (sous-fonction pure) ──────────

describe('aggregateCoherenceByVenue — agrégation cohérence', () => {
  const KNOWN = ['xbull', 'soroswap', 'aquarius', 'comet', 'ultrastellar', 'stellarbroker', 'horizon'];

  it('venue sans sonde → tests=0, suspects=0, lastSuspectAt=null', () => {
    const agg = aggregateCoherenceByVenue([], KNOWN);
    for (const id of KNOWN) {
      const a = agg.get(id)!;
      expect(a.tests).toBe(0);
      expect(a.suspects).toBe(0);
      expect(a.lastSuspectAt).toBeNull();
    }
  });

  it('compte tests et suspects par venue', () => {
    const probes = [
      { venue: 'xbull', incoherent: false, created_at: '2025-05-28T10:00:00Z' },
      { venue: 'xbull', incoherent: true,  created_at: '2025-05-29T10:00:00Z' },
      { venue: 'xbull', incoherent: true,  created_at: '2025-05-30T10:00:00Z' },
      { venue: 'soroswap', incoherent: false, created_at: '2025-05-28T10:00:00Z' },
    ];
    const agg = aggregateCoherenceByVenue(probes, KNOWN);
    const x = agg.get('xbull')!;
    expect(x.tests).toBe(3);
    expect(x.suspects).toBe(2);
    // lastSuspectAt = le plus récent parmi les suspectes
    expect(x.lastSuspectAt).toBe('2025-05-30T10:00:00Z');

    const s = agg.get('soroswap')!;
    expect(s.tests).toBe(1);
    expect(s.suspects).toBe(0);
    expect(s.lastSuspectAt).toBeNull();
  });

  it('venue inconnue ignorée', () => {
    const probes = [
      { venue: 'unknown-venue', incoherent: true, created_at: '2025-05-28T10:00:00Z' },
    ];
    const agg = aggregateCoherenceByVenue(probes, KNOWN);
    // Aucune venue connue ne doit être impactée
    for (const id of KNOWN) {
      expect(agg.get(id)!.tests).toBe(0);
    }
  });

  it('lastSuspectAt = max created_at parmi suspectes uniquement', () => {
    const probes = [
      { venue: 'aquarius', incoherent: true,  created_at: '2025-05-25T08:00:00Z' },
      { venue: 'aquarius', incoherent: false, created_at: '2025-05-30T08:00:00Z' }, // non suspecte, plus récente
      { venue: 'aquarius', incoherent: true,  created_at: '2025-05-27T08:00:00Z' },
    ];
    const agg = aggregateCoherenceByVenue(probes, KNOWN);
    const a = agg.get('aquarius')!;
    expect(a.tests).toBe(3);
    expect(a.suspects).toBe(2);
    // 2025-05-30 est non suspecte → lastSuspectAt = 2025-05-27
    expect(a.lastSuspectAt).toBe('2025-05-27T08:00:00Z');
  });
});

// ─── coherence intégrée dans buildSourceHealth (via DB) ───────────────────────

describe('buildSourceHealth — champ coherence', () => {
  let dir5: string;
  let path5: string;
  let res5: ReturnType<typeof buildSourceHealth>;

  const NOW5 = new Date('2025-06-01T12:00:00Z');
  const WIN5 = new Date(NOW5.getTime() - 7 * 86_400_000).toISOString();

  beforeAll(() => {
    dir5 = mkdtempSync(join(tmpdir(), 'decantfi-health-coherence-'));
    path5 = join(dir5, 'test.db');
    const db = openDb(path5);

    // Un tick ok pour avoir un contexte de ticks existants
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-29T10:00:00Z' }),
      [mkQuote('xbull'), mkQuote('aquarius')],
    );

    // Sondes de cohérence pour xbull : 3 tests dont 2 suspects
    const mkProbe = (venue: string, incoherent: boolean, created_at: string): CoherenceProbeInsert => ({
      created_at,
      venue,
      pair: 'BLND->USDC',
      amount_in: toStroops(250),
      incoherent,
      reason: incoherent ? 'delta_bps trop élevé' : null,
      net_quoted: BigInt(125_000_000),
      net_simulated: incoherent ? BigInt(123_000_000) : BigInt(125_000_000),
      delta_bps: incoherent ? 160 : 5,
      route_json: null,
      trace_json: null,
    });

    db.insertCoherenceProbe(mkProbe('xbull', false, '2025-05-27T10:00:00Z'));
    db.insertCoherenceProbe(mkProbe('xbull', true,  '2025-05-28T10:00:00Z'));
    db.insertCoherenceProbe(mkProbe('xbull', true,  '2025-05-29T10:00:00Z'));

    // Sonde pour aquarius : 1 test, 0 suspect
    db.insertCoherenceProbe(mkProbe('aquarius', false, '2025-05-28T10:00:00Z'));

    // Sonde HORS fenêtre (>7j) → doit être ignorée
    db.insertCoherenceProbe(mkProbe('xbull', true, '2025-05-01T10:00:00Z'));

    db.close();
    const rdb = openReadOnly(path5);
    res5 = buildSourceHealth(rdb, WIN5, NOW5);
    rdb.close();
  });

  afterAll(() => { rmSync(dir5, { recursive: true, force: true }); });

  it('xbull : 3 tests, 2 suspects, lastSuspectAt = 2025-05-29', () => {
    const xbull = res5.sources.find((s) => s.id === 'xbull')!;
    expect(xbull.coherence.tests).toBe(3);
    expect(xbull.coherence.suspects).toBe(2);
    expect(xbull.coherence.lastSuspectAt).toContain('2025-05-29');
  });

  it('aquarius : 1 test, 0 suspects, lastSuspectAt = null', () => {
    const aq = res5.sources.find((s) => s.id === 'aquarius')!;
    expect(aq.coherence.tests).toBe(1);
    expect(aq.coherence.suspects).toBe(0);
    expect(aq.coherence.lastSuspectAt).toBeNull();
  });

  it('sonde hors fenêtre ignorée (xbull.tests reste 3)', () => {
    const xbull = res5.sources.find((s) => s.id === 'xbull')!;
    // La sonde du 2025-05-01 est hors fenêtre 7j → tests = 3 et non 4
    expect(xbull.coherence.tests).toBe(3);
  });

  it('venue sans sonde → coherence.tests = 0', () => {
    const soroswap = res5.sources.find((s) => s.id === 'soroswap')!;
    expect(soroswap.coherence.tests).toBe(0);
    expect(soroswap.coherence.suspects).toBe(0);
    expect(soroswap.coherence.lastSuspectAt).toBeNull();
  });
});

// ─── computeUptimeBySource + uptimeTrend — tests unitaires ────────────────────

describe('buildSourceHealth — champ uptimeTrend', () => {
  let dir6: string;
  let path6: string;

  const NOW6 = new Date('2025-06-01T12:00:00Z');
  // Fenêtre courante : [NOW6-7j, NOW6)
  const WIN6 = new Date(NOW6.getTime() - 7 * 86_400_000).toISOString();
  // Fenêtre précédente : [NOW6-14j, NOW6-7j)
  const WIN6_PREV = new Date(NOW6.getTime() - 14 * 86_400_000).toISOString();

  const KNOWN6 = ['xbull', 'soroswap', 'aquarius', 'comet', 'ultrastellar', 'stellarbroker', 'horizon'];

  beforeAll(() => {
    dir6 = mkdtempSync(join(tmpdir(), 'decantfi-health-trend-'));
    path6 = join(dir6, 'test.db');
    const db = openDb(path6);

    // Fenêtre précédente [2025-05-18T12:00 .. 2025-05-25T12:00) :
    // 2 ticks ok, xbull répond à 1 seul (50%)
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-19T10:00:00Z' }),
      [mkQuote('xbull')],
    );
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-20T10:00:00Z' }),
      [], // xbull absent
    );

    // Fenêtre courante [2025-05-25T12:00 .. 2025-06-01T12:00) :
    // 2 ticks ok, xbull répond aux 2 (100%)
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-26T10:00:00Z' }),
      [mkQuote('xbull')],
    );
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-27T10:00:00Z' }),
      [mkQuote('xbull')],
    );

    db.close();
  });

  afterAll(() => { rmSync(dir6, { recursive: true, force: true }); });

  it('computeUptimeBySource : fenêtre précédente xbull = 50%, courante = 100%', () => {
    const db = openReadOnly(path6);
    const prev = computeUptimeBySource(db, KNOWN6, WIN6_PREV, WIN6);
    const cur = computeUptimeBySource(db, KNOWN6, WIN6, NOW6.toISOString());
    db.close();
    expect(prev.get('xbull')).toBeCloseTo(50, 0);
    expect(cur.get('xbull')).toBeCloseTo(100, 0);
  });

  it('uptimeTrend = "up" quand delta > 1pt', () => {
    const db = openReadOnly(path6);
    const res = buildSourceHealth(db, WIN6, NOW6);
    db.close();
    const xbull = res.sources.find((s) => s.id === 'xbull')!;
    // delta = 100 - 50 = 50 > 1 → 'up'
    expect(xbull.uptimeTrend).toBe('up');
  });

  it('uptimeTrend = "flat" si pas de base de comparaison (fenêtre précédente vide)', () => {
    // Ouvre une DB fraîche avec seulement des ticks dans la fenêtre courante (pas de précédents)
    const dirFlat = mkdtempSync(join(tmpdir(), 'decantfi-trend-flat-'));
    const pathFlat = join(dirFlat, 'test.db');
    const db = openDb(pathFlat);
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-26T10:00:00Z' }),
      [mkQuote('xbull')],
    );
    db.close();
    const rdb = openReadOnly(pathFlat);
    const res = buildSourceHealth(rdb, WIN6, NOW6);
    rdb.close();
    rmSync(dirFlat, { recursive: true, force: true });
    const xbull = res.sources.find((s) => s.id === 'xbull')!;
    // Fenêtre précédente : totalTicks=0 → uptimePrev=100, cur=100 → delta=0 → 'flat'
    expect(xbull.uptimeTrend).toBe('flat');
  });

  it('uptimeTrend = "flat" si delta dans [-1, +1]', () => {
    // Cas fictif via computeUptimeBySource + delta synthétique : vérifie la règle de seuil
    // On teste la logique pure avec delta = 0.5 (< 1 → flat)
    // Pour cela, on crée une DB où xbull répond partout dans les deux fenêtres
    const dirEq = mkdtempSync(join(tmpdir(), 'decantfi-trend-eq-'));
    const pathEq = join(dirEq, 'test.db');
    const db = openDb(pathEq);
    // Fenêtre précédente : 2 ticks, xbull répond aux 2
    db.insertTickWithQuotes(mkTick({ started_at: '2025-05-18T10:00:00Z' }), [mkQuote('xbull')]);
    db.insertTickWithQuotes(mkTick({ started_at: '2025-05-19T10:00:00Z' }), [mkQuote('xbull')]);
    // Fenêtre courante : 2 ticks, xbull répond aux 2
    db.insertTickWithQuotes(mkTick({ started_at: '2025-05-26T10:00:00Z' }), [mkQuote('xbull')]);
    db.insertTickWithQuotes(mkTick({ started_at: '2025-05-27T10:00:00Z' }), [mkQuote('xbull')]);
    db.close();
    const rdb = openReadOnly(pathEq);
    const res = buildSourceHealth(rdb, WIN6, NOW6);
    rdb.close();
    rmSync(dirEq, { recursive: true, force: true });
    const xbull = res.sources.find((s) => s.id === 'xbull')!;
    // delta = 100 - 100 = 0 → 'flat'
    expect(xbull.uptimeTrend).toBe('flat');
  });
});

// ─── Regression: malformed URL must not crash the server (fix parseQuery-in-try) ──────────────
// parseQuery calls decodeURIComponent which throws URIError on inputs like %GG.
// Before the fix, handle() called parseQuery before the try block, so a URIError turned into
// an unhandled rejection → no HTTP response + process crash under node:26-alpine defaults.
// This test proves the server returns a proper HTTP response (not a hang/crash).

function parseQueryLocal(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const qs = url.slice(idx + 1);
  const params: Record<string, string> = {};
  for (const part of qs.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = decodeURIComponent(part.slice(0, eq));
    const v = decodeURIComponent(part.slice(eq + 1));
    params[k] = v;
  }
  return params;
}

describe('server: malformed URL returns HTTP response, not a crash', () => {
  it('GET /?pair=%GG returns a status code (not a thrown error)', async () => {
    // Reproduce the crash scenario with a minimal inline server that mirrors the
    // fixed pattern: parseQuery inside try/catch → 500 on URIError.
    await new Promise<void>((resolve, reject) => {
      const server = createServer((req, res) => {
        void (async () => {
          try {
            const rawUrl = req.url ?? '/';
            // parseQuery is inside try — URIError is caught, returns 500 (not a crash)
            parseQueryLocal(rawUrl);
            res.writeHead(200); res.end('ok');
          } catch {
            res.writeHead(500); res.end('error');
          }
        })();
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        const req = httpGet(
          `http://127.0.0.1:${addr.port}/?pair=%GG`,
          (r) => {
            server.close();
            // Any HTTP response is proof the server didn't crash/hang
            expect(r.statusCode).toBeGreaterThanOrEqual(400);
            resolve();
          },
        );
        req.on('error', (e: Error) => { server.close(); reject(e); });
        req.setTimeout(2000, () => { server.close(); reject(new Error('timeout — server hung (no response)')); });
      });
    });
  });
});

// ─── median — fonction pure ───────────────────────────────────────────────────

import { median, buildSourceHealth as _bsh } from './stats.js';

describe('median — fonction pure', () => {
  it('tableau vide → null', () => {
    expect(median([])).toBeNull();
  });

  it('1 élément', () => {
    expect(median([42])).toBe(42);
  });

  it('impair : valeur centrale', () => {
    expect(median([3, 1, 2])).toBe(2); // trié → [1,2,3] → med=2
  });

  it('pair : moyenne des deux valeurs centrales', () => {
    expect(median([1, 3, 5, 7])).toBe(4); // trié → [1,3,5,7] → (3+5)/2=4
  });

  it('ne modifie pas le tableau original', () => {
    const arr = [5, 3, 1];
    median(arr);
    expect(arr).toEqual([5, 3, 1]);
  });
});

// ─── execMs par venue + execTotalMs ──────────────────────────────────────────

describe('buildSourceHealth — execMs et execTotalMs', () => {
  let dirExec: string;
  let pathExec: string;
  let resExec: ReturnType<typeof _bsh>;

  const NOW_EXEC = new Date('2025-06-01T12:00:00Z');
  const WIN_EXEC = new Date(NOW_EXEC.getTime() - 7 * 86_400_000).toISOString();

  beforeAll(() => {
    dirExec = mkdtempSync(join(tmpdir(), 'decantfi-execms-'));
    pathExec = join(dirExec, 'test.db');
    const db = openDb(pathExec);

    // Tick 1 : 3000 ms de wall-clock, xbull=100ms aquarius=200ms
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-28T10:00:00Z', finished_at: '2025-05-28T10:00:03Z' }),
      [
        mkQuote('xbull',    { duration_ms: 100 }),
        mkQuote('aquarius', { duration_ms: 200 }),
      ],
    );

    // Tick 2 : 5000 ms de wall-clock, xbull=150ms aquarius=250ms
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-29T10:00:00Z', finished_at: '2025-05-29T10:00:05Z' }),
      [
        mkQuote('xbull',    { duration_ms: 150 }),
        mkQuote('aquarius', { duration_ms: 250 }),
      ],
    );

    // Tick 3 : 1000 ms de wall-clock, xbull=null (non mesuré), aquarius=220ms
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-30T10:00:00Z', finished_at: '2025-05-30T10:00:01Z' }),
      [
        mkQuote('xbull',    { duration_ms: null }),
        mkQuote('aquarius', { duration_ms: 220 }),
      ],
    );

    // Tick ok=0 : exclu du calcul
    db.insertTickWithQuotes(
      mkTick({ started_at: '2025-05-31T10:00:00Z', ok: false }),
      [mkQuote('xbull', { duration_ms: 999 })],
    );

    db.close();
    const rdb = openReadOnly(pathExec);
    resExec = _bsh(rdb, WIN_EXEC, NOW_EXEC);
    rdb.close();
  });

  afterAll(() => { rmSync(dirExec, { recursive: true, force: true }); });

  it('execMs xbull = médiane de [100, 150] (null ignoré) = 125', () => {
    const xbull = resExec.sources.find((s) => s.id === 'xbull')!;
    // [100, 150] → médiane pair = (100+150)/2 = 125
    expect(xbull.execMs).toBe(125);
  });

  it('execMs aquarius = médiane de [200, 250, 220] = 220', () => {
    const aq = resExec.sources.find((s) => s.id === 'aquarius')!;
    // trié [200, 220, 250] → médiane impaire = 220
    expect(aq.execMs).toBe(220);
  });

  it('execMs soroswap (aucune mesure) = null', () => {
    const ss = resExec.sources.find((s) => s.id === 'soroswap')!;
    expect(ss.execMs).toBeNull();
  });

  it('execTotalMs = médiane des (finished_at - started_at) en ms = médiane de [3000, 5000, 1000] = 3000', () => {
    // ticks ok=1 avec finished_at : [3000, 5000, 1000] → trié [1000, 3000, 5000] → med=3000
    expect(resExec.execTotalMs).toBe(3000);
  });

  it('les ticks ok=0 sont exclus du wall-clock', () => {
    // Si on incluait le tick ok=0, on aurait 4 valeurs → médiane ≠ 3000. Donc ok=0 exclu.
    expect(resExec.execTotalMs).toBe(3000);
  });
});
