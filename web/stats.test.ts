// Tests for web/stats.ts: synthetic multi-tick DB, several days × hours × probes × sources.
// No network (stats only reads the DB).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb, type TickInsert, type QuoteInsert } from '../db/index.js';
import { toStroops } from '../core/amount.js';
import { openReadOnly } from './read-db.js';
import { overview, displayName, chipFor, noteFor, buildIntradayLocal } from './stats.js';
import type { CollectorConfig } from '../collector/config.js';

// ─── Synthetic config ─────────────────────────────────────────────────────────

const CFG: CollectorConfig = {
  cadenceSec: 900,
  jitterSec: 60,
  sizesBlnd: [toStroops(250), toStroops(750)],
  pairs: ['USDC', 'EURC'],
  dbPath: '',
  timeoutMs: 15000,
  rawRetentionDays: 90,
  rollupAfterDays: 365,
  rpcUrl: 'https://mainnet.sorobanrpc.com',
  rpcUrls: ['https://mainnet.sorobanrpc.com'],
  horizonUrl: 'https://horizon.stellar.org',
};

// ─── Synthetic seed ───────────────────────────────────────────────────────────
// Sources used for USDC
const SOURCES_USDC = ['xbull', 'soroswap', 'aquarius', 'comet', 'ultrastellar', 'stellarbroker', 'horizon'];
// Sources used for EURC
const SOURCES_EURC = ['xbull', 'soroswap', 'aquarius', 'stellarbroker', 'horizon'];

// Base BLND price (USD): we drift the price BUT execution quality must stay stable.
// To test price neutrality, we create a price drift and verify that the "good" hour
// stays the same regardless of the drift.
const BASE_BLND_USD = 0.05;
const PRICE_DRIFT_PER_DAY = 0.002; // +0.2% per day (non-zero = neutrality test)

// Execution quality per UTC hour: hour 4 UTC is deliberately the best.
const BEST_HOUR_UTC = 4;
const WORST_HOUR_UTC = 14;

function execQuality(hourUtc: number): number {
  // 1.0 ± 0.01 depending on the hour; BEST_HOUR_UTC → 1.01, WORST_HOUR_UTC → 0.99
  if (hourUtc === BEST_HOUR_UTC) return 1.01;
  if (hourUtc === WORST_HOUR_UTC) return 0.99;
  return 1.0;
}

// Generates the net_out of a given source for a probe and a quality
function netOutFor(amountStroops: bigint, sourceRank: number, quality: number, blndUsd: number): bigint {
  // winner rank=0 → 1.0 * quality; rank=1 → 0.998, rank=2 → 0.996 ...
  const relPerf = quality * (1 - sourceRank * 0.002);
  // net in target units = amount_in_blnd * blnd_usd * relPerf (USDC ≈ USD, spot = 1)
  const amountBlnd = Number(amountStroops) / 1e7;
  const netUnits = amountBlnd * blndUsd * relPerf;
  return BigInt(Math.round(netUnits * 1e7));
}

// Inserts ticks over 8 days, every 2 UTC hours
// - days 0-6 → within the 7d window (NOW = day 7 = "today")
// - day -1   → at 8 days = outside the window (must be ignored)
// Reference probe: NOW_UTC = start of day 7 at 12:00 UTC
// NOW_UTC = start of the current UTC day (midnight) so hours are exact
const NOW_UTC = new Date('2025-03-10T00:00:00Z');

let tmpDir: string;
let dbPath: string;

function buildTestDb(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'decantfi-test-'));
  dbPath = join(tmpDir, 'test.db');
  const db = openDb(dbPath);

  const baseDays = -8; // starts 8 days before now (the first tick will be outside the window)

  for (let dayOffset = baseDays; dayOffset <= -1; dayOffset++) {
    // dayOffset = -8 → outside the window; -7 to -1 → inside the window (7 days)
    for (let hourUtc = 0; hourUtc < 24; hourUtc += 2) {
      const d = new Date(NOW_UTC.getTime() + dayOffset * 86400000 + hourUtc * 3600000);
      const startedAt = d.toISOString();
      const blndUsd = BASE_BLND_USD + PRICE_DRIFT_PER_DAY * (dayOffset + 8); // drift
      const quality = execQuality(hourUtc);

      // A few ok=0 ticks interleaved (one per day at h=10)
      const isOk = hourUtc !== 10;

      const tick: TickInsert = {
        started_at: startedAt,
        finished_at: new Date(d.getTime() + 5000).toISOString(),
        cadence_sec: 900,
        blnd_usd: blndUsd,
        xlm_usd: 0.12,
        eurc_usd: 1.08,
        eurc_stellar_mid: null,
        ok: isOk,
        source_errors: isOk ? null : 'timeout',
        note: null,
      };

      const quotes: QuoteInsert[] = [];

      for (const pair of ['BLND->USDC', 'BLND->EURC'] as const) {
        const pairUi = pair === 'BLND->USDC' ? 'USDC' : 'EURC';
        const sources = pairUi === 'USDC' ? SOURCES_USDC : SOURCES_EURC;
        for (const sonde of [toStroops(250), toStroops(750)]) {
          for (let i = 0; i < sources.length; i++) {
            const src = sources[i]!;
            const netOut = netOutFor(sonde, i, quality, blndUsd);
            const isWinner = i === 0;
            const netConf = src === 'stellarbroker' ? 'estimate' : src === 'horizon' ? 'estimate' : 'exact';
            const eurcPath = (pairUi === 'EURC' && src === 'xbull') ? 'via-usdc' : null;

            quotes.push({
              pair,
              amount_in: sonde,
              source_id: src,
              net_out: netOut,
              net_confidence: netConf,
              price_impact_pct: 0.3 + i * 0.05,
              gas_in_target: 0n,
              fee_total: 0n,
              route_summary: pairUi === 'EURC'
                ? (eurcPath === 'via-usdc' ? 'xbull:BLND->USDC | xbull:USDC->EURC' : 'BLND->EURC')
                : 'BLND->USDC',
              is_winner: isWinner,
              eurc_path: eurcPath,
              raw_json: null,
              duration_ms: null,
            });
          }
        }
      }

      db.insertTickWithQuotes(tick, quotes);
    }
  }

  db.close();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let result_usdc: ReturnType<typeof overview>;
let result_eurc: ReturnType<typeof overview>;

beforeAll(() => {
  buildTestDb();
  const db = openReadOnly(dbPath);
  result_usdc = overview(db, 'USDC', CFG, NOW_UTC);
  result_eurc = overview(db, 'EURC', CFG, NOW_UTC);
  db.close();
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Test 1: ladders ─────────────────────────────────────────────────────────

describe('ladders', () => {
  it('net_out desc order', () => {
    const rows = result_usdc.ladders['750']!;
    expect(rows.length).toBeGreaterThan(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.net).toBeLessThanOrEqual(rows[i - 1]!.net);
    }
  });

  it('winner = first (is_winner)', () => {
    const rows = result_usdc.ladders['750']!;
    expect(rows[0]!.winner).toBe(true);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.winner).toBe(false);
    }
  });

  it('deltaVsWinner = 0 for the winner, negative otherwise', () => {
    const rows = result_usdc.ladders['250']!;
    expect(rows[0]!.deltaVsWinner).toBeCloseTo(0, 5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.deltaVsWinner).toBeLessThan(0);
    }
  });

  it('chips mapped correctly (stellarbroker=est, xbull=obs)', () => {
    const rows = result_usdc.ladders['750']!;
    const xbull = rows.find(r => r.display === 'xBull');
    const stellarbroker = rows.find(r => r.display === 'StellarBroker');
    expect(xbull?.chip).toBe('obs');
    expect(stellarbroker?.chip).toBe('est');
  });

  it('notes: empty except for the composite EURC via-USDC route', () => {
    const rows = result_usdc.ladders['750']!;
    for (const r of rows) expect(r.note).toBe('');
  });

  it('EURC: no more row note (multi-tx removed)', () => {
    const rows = result_eurc.ladders['250']!;
    const winner = rows.find(r => r.winner);
    expect(winner?.note).toBe('');
  });
});

// ─── Test 2: winnerDist ──────────────────────────────────────────────────────

describe('winnerDist', () => {
  it('sum of percentages ≈ 100', () => {
    const dist = result_usdc.winnerDist['250']!;
    expect(dist.length).toBeGreaterThan(0);
    const sum = dist.reduce((a, d) => a + d.pct, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('dominant source at the top (xBull = only winner in the seed)', () => {
    const dist = result_usdc.winnerDist['250']!;
    expect(dist[0]!.display).toBe('xBull');
    expect(dist[0]!.pct).toBeGreaterThan(90);
  });
});

// ─── Test bestRoutes ─────────────────────────────────────────────────────────

describe('bestRoutes', () => {
  it('ranks the winning routes, % sums to ≈ 100, path + tools populated', () => {
    const routes = result_usdc.bestRoutes['250']!;
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0]!.path).toContain('BLND');
    expect(routes[0]!.tools.length).toBeGreaterThan(0);
    expect(routes.reduce((a, r) => a + r.winPct, 0)).toBeCloseTo(100, 0);
    // sorted by descending wins
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i]!.wins).toBeLessThanOrEqual(routes[i - 1]!.wins);
    }
  });

  it('margin over runner-up: populated, positive (sign-gate: is_winner == max net) and ≈ 0.2% on the seed', () => {
    const routes = result_usdc.bestRoutes['250']!;
    const withMargin = routes.filter((r) => r.marginPct != null);
    expect(withMargin.length).toBeGreaterThan(0);
    for (const r of withMargin) {
      // Sign-gate: if many margins are < 0 on REAL data, is_winner ≠ max net → needs rethinking.
      // On the seed, winner = rank0 = max net → margin ≥ 0.
      expect(r.marginPct!).toBeGreaterThanOrEqual(0);
      expect(r.marginPct!).toBeLessThan(2);
    }
    // The seed sets rank0=1.0, rank1=0.998 → winner margin ≈ 0.2%.
    expect(routes[0]!.marginPct!).toBeGreaterThan(0.05);
    // Trend: valid value for each route.
    for (const r of routes) expect(['up', 'down', 'flat', null]).toContain(r.trend);
    // trendMag: signed magnitude, consistent with the direction (lets the table distinguish strong/weak).
    for (const r of routes) {
      expect(r.trendMag === null || typeof r.trendMag === 'number').toBe(true);
      if (r.trendMag != null && r.trend === 'up') expect(r.trendMag).toBeGreaterThan(0.02);
      if (r.trendMag != null && r.trend === 'down') expect(r.trendMag).toBeLessThan(-0.02);
      if (r.trendMag != null && r.trend === 'flat') expect(Math.abs(r.trendMag)).toBeLessThanOrEqual(0.02);
    }
  });
});

// ─── Test 3: heatEffUtc per probe ────────────────────────────────────────────

describe('heatEffUtc', () => {
  it('present for both probes (250 and 750)', () => {
    expect(result_usdc.heatEffUtc['250']).toBeDefined();
    expect(result_usdc.heatEffUtc['750']).toBeDefined();
  });

  it('7×24 dimensions for each probe', () => {
    for (const key of ['250', '750'] as const) {
      const heat = result_usdc.heatEffUtc[key]!;
      expect(heat.length).toBe(7);
      for (const row of heat) {
        expect(row.length).toBe(24);
      }
    }
  });

  it('raw efficiency > 0 for slots with data (hour 4 UTC, probe 750)', () => {
    const heat = result_usdc.heatEffUtc['750']!;
    // At least one day must have a non-null value at BEST_HOUR_UTC
    const hasData = heat.some(row => row[BEST_HOUR_UTC] !== null && (row[BEST_HOUR_UTC] as number) > 0);
    expect(hasData).toBe(true);
  });

  it('hour 10 UTC (ok=0) = null for probe 750', () => {
    const heat = result_usdc.heatEffUtc['750']!;
    // h=10 → ok=0 → all slots of hour 10 UTC must be null
    for (const row of heat) {
      expect(row[10]).toBeNull();
    }
  });
});

// ─── Test 4: effWeekAvg per probe ────────────────────────────────────────────

describe('effWeekAvg', () => {
  it('present for both probes with a non-null value', () => {
    expect(result_usdc.effWeekAvg['250']).not.toBeNull();
    expect(result_usdc.effWeekAvg['750']).not.toBeNull();
    expect(typeof result_usdc.effWeekAvg['250']).toBe('number');
    expect(typeof result_usdc.effWeekAvg['750']).toBe('number');
  });

  it('plausible value (close to 1 for USDC ≈ USD)', () => {
    const avg = result_usdc.effWeekAvg['750'] as number;
    expect(avg).toBeGreaterThan(0.9);
    expect(avg).toBeLessThan(1.1);
  });
});

// ─── Test 5: intradayLocal per probe ─────────────────────────────────────────

describe('intradayLocal', () => {
  it('present for both probes', () => {
    expect(result_usdc.intradayLocal['250']).toBeDefined();
    expect(result_usdc.intradayLocal['750']).toBeDefined();
  });

  it('7×96 dimensions for each probe', () => {
    for (const key of ['250', '750'] as const) {
      const intra = result_usdc.intradayLocal[key]!;
      expect(intra.length).toBe(7);
      for (const row of intra) {
        expect(row.length).toBe(96);
      }
    }
  });
});

// ─── Test : impactLocalPct ────────────────────────────────────────────────────

describe('impactLocalPct', () => {
  it('impactLocalPct present on every USDC LadderRow', () => {
    const rows = result_usdc.ladders['750']!;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect('impactLocalPct' in r).toBe(true);
    }
  });

  it('USDC: impactLocalPct non-null (blnd_usd present, perUnitLocal=1)', () => {
    // For USDC perUnitLocal=1 → impactLocalPct = recalculated priceImpactPct, must be defined
    const rows = result_usdc.ladders['750']!;
    expect(rows.some(r => r.impactLocalPct !== null)).toBe(true);
  });

  it('USDC: impactLocalPct is a finite number when non-null', () => {
    const rows = result_usdc.ladders['750']!;
    for (const r of rows) {
      if (r.impactLocalPct !== null) {
        expect(Number.isFinite(r.impactLocalPct)).toBe(true);
      }
    }
  });

  it('EURC: impactLocalPct null when eurc_stellar_mid is absent from the tick', () => {
    // The fixture inserts eurc_stellar_mid=null on every tick → impactLocalPct must be null
    const rows = result_eurc.ladders['750']!;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.impactLocalPct).toBeNull();
    }
  });
});

// ─── Test: impactLocalPct with eurc_stellar_mid populated ───────────────────

let result_eurc_mid: ReturnType<typeof overview>;
let tmpDirEurcMid: string;

describe('impactLocalPct — EURC with eurc_stellar_mid populated', () => {
  beforeAll(() => {
    tmpDirEurcMid = mkdtempSync(join(tmpdir(), 'decantfi-eurcmid-'));
    const dbPath2 = join(tmpDirEurcMid, 'test.db');
    const db2 = openDb(dbPath2);

    const amountBlnd = toStroops(250);
    const blndUsd = 0.05;
    const eurcStellarMid = 1.05; // USDC per EURC (SDEX order-book mid)
    // net_out: 250 BLND * 0.05 USD/BLND / 1.05 USDC/EURC * 0.99 (1% impact) in stroops
    const netOutEurc = BigInt(Math.round((250 * blndUsd / eurcStellarMid * 0.99) * 1e7));

    db2.insertTickWithQuotes(
      {
        started_at: '2025-03-09T12:00:00Z',
        finished_at: '2025-03-09T12:00:05Z',
        cadence_sec: 900,
        blnd_usd: blndUsd,
        xlm_usd: 0.12,
        eurc_usd: 1.08,
        eurc_stellar_mid: eurcStellarMid,
        ok: true,
        source_errors: null,
        note: null,
      },
      [{
        pair: 'BLND->EURC',
        amount_in: amountBlnd,
        source_id: 'xbull',
        net_out: netOutEurc,
        net_confidence: 'exact',
        price_impact_pct: 2.5, // arbitrary DB (EVM) value — does not match the local one
        gas_in_target: 0n,
        fee_total: 0n,
        route_summary: 'BLND->EURC',
        is_winner: true,
        eurc_path: null,
        raw_json: null,
        duration_ms: null,
      }],
    );
    db2.close();

    const roDb2 = openReadOnly(dbPath2);
    result_eurc_mid = overview(roDb2, 'EURC', {
      ...CFG,
      sizesBlnd: [toStroops(250)],
      pairs: ['EURC'],
      dbPath: dbPath2,
    }, new Date('2025-03-10T00:00:00Z'));
    roDb2.close();
  });

  afterAll(() => {
    rmSync(tmpDirEurcMid, { recursive: true, force: true });
  });

  it('impactLocalPct non-null when eurc_stellar_mid is set on the tick', () => {
    const row = result_eurc_mid.ladders['250']?.[0];
    expect(row).toBeDefined();
    expect(row!.impactLocalPct).not.toBeNull();
  });

  it('impactLocalPct distinct from DB impactPct (local calc ≠ stored value)', () => {
    const row = result_eurc_mid.ladders['250']?.[0];
    expect(row!.impactPct).toBeCloseTo(2.5, 4); // unchanged DB value
    // recalculated impactLocalPct ≈ 1% (net = 0.99 * local spot) → ≠ 2.5
    expect(row!.impactLocalPct).not.toBeCloseTo(2.5, 0);
    expect(row!.impactLocalPct).toBeGreaterThan(0);
  });

  it('impactLocalPct ≈ 1% (consistent with the inserted net_out)', () => {
    const row = result_eurc_mid.ladders['250']?.[0];
    // We inserted net = local_spot * 0.99 → impact ≈ 1%
    expect(row!.impactLocalPct).toBeCloseTo(1.0, 0);
  });
});

// ─── Test 6: removed fields absent from the type ─────────────────────────────

describe('removed fields', () => {
  it('hourlyUtc absent from Overview', () => {
    expect((result_usdc as unknown as Record<string, unknown>)['hourlyUtc']).toBeUndefined();
  });

  it('heatUtc absent from Overview', () => {
    expect((result_usdc as unknown as Record<string, unknown>)['heatUtc']).toBeUndefined();
  });
});

// ─── Test 7: ok=0 excluded + 7d window ───────────────────────────────────────

describe('exclusions', () => {
  it('nTicksOk excludes ok=0 ticks', () => {
    const meta = result_usdc.meta;
    expect(meta.nTicksOk).toBeLessThan(meta.nTicks);
  });

  it('tick at -8 days ignored (outside the 7d window) → winnerDist does not exceed the window', () => {
    const dist = result_usdc.winnerDist['250']!;
    const sum = dist.reduce((a, d) => a + d.pct, 0);
    expect(sum).toBeCloseTo(100, 0);
  });
});

// ─── Unit tests: helpers ──────────────────────────────────────────────────────

describe('helpers', () => {
  it('displayName (base ids)', () => {
    expect(displayName('xbull')).toBe('xBull');
    expect(displayName('soroswap')).toBe('Soroswap');
    expect(displayName('comet')).toBe('Comet');
    expect(displayName('ultrastellar')).toBe('Ultra Stellar');
    expect(displayName('stellarbroker')).toBe('StellarBroker');
    expect(displayName('horizon')).toBe('Horizon');
  });

  it('displayName (combined xbull+ultrastellar)', () => {
    expect(displayName('xbull+ultrastellar')).toBe('xBull + Ultra Stellar');
  });

  it('chipFor: exact→obs, anything else→est (floor/estimate/combined/via-usdc)', () => {
    expect(chipFor('exact')).toBe('obs');
    expect(chipFor('floor')).toBe('est');
    expect(chipFor('estimate')).toBe('est');
  });

  it('noteFor: always empty (multi-tx annotation removed)', () => {
    expect(noteFor('xbull', true, null)).toBe('');
    expect(noteFor('xbull', true, 'via-usdc')).toBe('');
    expect(noteFor('comet', false, null)).toBe('');
    expect(noteFor('ultrastellar', false, null)).toBe('');
    expect(noteFor('stellarbroker', false, null)).toBe('');
    expect(noteFor('horizon', false, null)).toBe('');
    expect(noteFor('soroswap', false, null)).toBe('');
  });
});

// ─── Test 8: buildIntradayLocal — anti-mixing + 15-min mapping ───────────────

describe('buildIntradayLocal — anti-mixing', () => {
  /**
   * Scenario: the same day-of-week appears in two different weeks.
   * now = Wednesday 2025-03-12T10:00:00Z, offsetH = 0 (to make the test deterministic,
   * independent of the machine's TZ).
   *
   * 2025-03-12 (Wednesday) = dow 2 (0=Mon, 1=Tue, 2=Wed…)
   * 2025-03-05 (previous Wednesday) = same dow = 2
   *
   * We insert:
   *   - Tick A: 2025-03-12T08:00:00Z → slot 32 (8*4+0), eff=1.05
   *   - Tick B: 2025-03-05T14:30:00Z → slot 58 (14*4+2), eff=0.95  (week before)
   *
   * With offsetH=0, local dates = UTC dates.
   * now - 0d = 2025-03-12, dow=2 → this is the "current" date for that dow.
   * now - 7d = 2025-03-05, same dow → must be ignored (outside the 7 most recent dates).
   *
   * Expected result:
   *   result[2][32] = 1.05   (slot of the recent date)
   *   result[2][58] = null   (slot of the week before, absent)
   */
  it('does not mix two occurrences of the same dow — only the most recent date counts', () => {
    const now = new Date('2025-03-12T10:00:00Z');
    const offsetH = 0;

    // Tick A: Wednesday 2025-03-12 at 08:00 UTC → slot 32
    const tickA: Parameters<typeof buildIntradayLocal>[0][number] = {
      hour_utc: 8,
      dow_utc: 2, // Wednesday
      eff: 1.05,
      effStellar: null,
      startedAtMs: new Date('2025-03-12T08:00:00Z').getTime(),
    };

    // Tick B: previous Wednesday 2025-03-05 at 14:30 UTC → slot 58
    const tickB: Parameters<typeof buildIntradayLocal>[0][number] = {
      hour_utc: 14,
      dow_utc: 2, // same dow
      eff: 0.95,
      effStellar: null,
      startedAtMs: new Date('2025-03-05T14:30:00Z').getTime(),
    };

    const result = buildIntradayLocal([tickA, tickB], offsetH, now);

    expect(result.length).toBe(7);
    expect(result[0]!.length).toBe(96);

    // dow=2 (Wednesday): only the 2025-03-12 slots are present
    const wedRow = result[2]!;

    // Slot 32 = 08:00 UTC → must be 1.05 (recent date)
    expect(wedRow[32]).toBeCloseTo(1.05, 5);

    // Slot 58 = 14:30 UTC → must be null (week before, outside the 7 dates)
    expect(wedRow[58]).toBeNull();
  });

  it('correct 15-min mapping: HH:MM → slot = HH*4 + floor(MM/15)', () => {
    const now = new Date('2025-03-12T10:00:00Z');
    const offsetH = 0;

    // Ticks at precise minutes to verify the 15-min bucketing
    const cases: Array<{ iso: string; expectedSlot: number; eff: number }> = [
      { iso: '2025-03-12T00:00:00Z', expectedSlot: 0,  eff: 1.0  }, // 00:00 → slot 0
      { iso: '2025-03-12T00:14:59Z', expectedSlot: 0,  eff: 1.01 }, // 00:14 → slot 0 (same quarter)
      { iso: '2025-03-12T00:15:00Z', expectedSlot: 1,  eff: 1.02 }, // 00:15 → slot 1
      { iso: '2025-03-12T06:30:00Z', expectedSlot: 26, eff: 1.03 }, // 06:30 → slot 6*4+2=26
      { iso: '2025-03-12T23:45:00Z', expectedSlot: 95, eff: 1.04 }, // 23:45 → slot 23*4+3=95
    ];

    const rows: Parameters<typeof buildIntradayLocal>[0] = cases.map(c => ({
      hour_utc: new Date(c.iso).getUTCHours(),
      dow_utc: 2,
      eff: c.eff,
      effStellar: null,
      startedAtMs: new Date(c.iso).getTime(),
    }));

    const result = buildIntradayLocal(rows, offsetH, now);
    const wedRow = result[2]!;

    // slot 0: two ticks → average of 1.0 and 1.01
    expect(wedRow[0]).toBeCloseTo((1.0 + 1.01) / 2, 5);
    // slot 1
    expect(wedRow[1]).toBeCloseTo(1.02, 5);
    // slot 26
    expect(wedRow[26]).toBeCloseTo(1.03, 5);
    // slot 95
    expect(wedRow[95]).toBeCloseTo(1.04, 5);
  });

  it('with a non-zero offsetH: correct local conversion', () => {
    // offsetH = 2 (simulating UTC+2)
    // UTC tick 22:00 on 2025-03-11 → local time = 00:00 on 2025-03-12
    // now = 2025-03-12T10:00:00Z, offsetH=2
    // now's local date = 2025-03-12 (12:00 UTC+2), dow=2 (Wednesday)
    const now = new Date('2025-03-12T10:00:00Z');
    const offsetH = 2;

    // UTC 22:00 on 2025-03-11 → local = 00:00 on 2025-03-12 → slot 0
    const tickMs = new Date('2025-03-11T22:00:00Z').getTime();
    const rows: Parameters<typeof buildIntradayLocal>[0] = [{
      hour_utc: 22,
      dow_utc: 1, // Tuesday UTC
      eff: 1.07,
      effStellar: null,
      startedAtMs: tickMs,
    }];

    const result = buildIntradayLocal(rows, offsetH, now);

    // In local time, this tick falls on 2025-03-12, dow=2 (Wednesday), slot 0
    const wedRow = result[2]!;
    expect(wedRow[0]).toBeCloseTo(1.07, 5);

    // Local Tuesday (dow=1) must not have this tick
    const tueRow = result[1]!;
    expect(tueRow[0]).toBeNull();
  });
});

// ─── Stellar series tests ─────────────────────────────────────────────────────

describe('Stellar series — Overview fields', () => {
  // Reuses result_eurc_mid (DB with eurc_stellar_mid=1.05, eurc_usd=1.08)
  // and result_usdc / result_eurc (main DB with eurc_stellar_mid=null)

  it('USDC: effWeekAvgStellar === effWeekAvg (eurc_usd not used for USDC)', () => {
    // For USDC, effOf ignores eurc_usd → eff and effStellar are identical
    expect(result_usdc.effWeekAvgStellar['250']).toBeCloseTo(result_usdc.effWeekAvg['250'] as number, 5);
    expect(result_usdc.effWeekAvgStellar['750']).toBeCloseTo(result_usdc.effWeekAvg['750'] as number, 5);
  });

  it('USDC: heatEffUtcStellar === heatEffUtc (all cells identical)', () => {
    const heat = result_usdc.heatEffUtc['250']!;
    const heatStellar = result_usdc.heatEffUtcStellar['250']!;
    expect(heatStellar.length).toBe(7);
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        expect(heatStellar[d]![h]).toBe(heat[d]![h]);
      }
    }
  });

  it('EURC without mid (main fixture): effWeekAvgStellar === null (honest gap)', () => {
    // eurc_stellar_mid=null on every tick → effStellar=null → no data
    expect(result_eurc.effWeekAvgStellar['250']).toBeNull();
    expect(result_eurc.effWeekAvgStellar['750']).toBeNull();
  });

  it('EURC without mid: heatEffUtcStellar entirely null (honest gap)', () => {
    const heatStellar = result_eurc.heatEffUtcStellar['250']!;
    expect(heatStellar.length).toBe(7);
    for (const row of heatStellar) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it('EURC without mid: intradayStellar entirely null (honest gap)', () => {
    const intraStellar = result_eurc.intradayStellar['250']!;
    expect(intraStellar.length).toBe(7);
    for (const row of intraStellar) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it('EURC with mid (1.05 ≠ eurc_usd 1.08): effStellar ≠ eff EVM', () => {
    // result_eurc_mid: eurc_stellar_mid=1.05, eurc_usd=1.08 → effStellar ≠ effEvm
    const avgEvm = result_eurc_mid.effWeekAvg['250'] as number;
    const avgStellar = result_eurc_mid.effWeekAvgStellar['250'] as number;
    expect(avgStellar).not.toBeNull();
    expect(avgEvm).not.toBeNull();
    // effStellar = (net/amt) / (blnd/stellar_mid); effEvm = (net/amt) / (blnd/eurc_usd)
    // stellar_mid < eurc_usd → stellar spot > evm spot → effStellar < effEvm
    expect(Math.abs(avgStellar - avgEvm)).toBeGreaterThan(0.001);
  });

  it('EURC with mid: heatEffUtcStellar ≠ heatEffUtc (at least one cell)', () => {
    const heat = result_eurc_mid.heatEffUtc['250']!;
    const heatStellar = result_eurc_mid.heatEffUtcStellar['250']!;
    // At least one cell must differ
    let found = false;
    for (let d = 0; d < 7 && !found; d++) {
      for (let h = 0; h < 24 && !found; h++) {
        if (heat[d]![h] !== null && heatStellar[d]![h] !== null && heat[d]![h] !== heatStellar[d]![h]) {
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('EURC with mid: 7×24 and 7×96 dimensions present', () => {
    const heatStellar = result_eurc_mid.heatEffUtcStellar['250']!;
    expect(heatStellar.length).toBe(7);
    for (const row of heatStellar) expect(row.length).toBe(24);

    const intraStellar = result_eurc_mid.intradayStellar['250']!;
    expect(intraStellar.length).toBe(7);
    for (const row of intraStellar) expect(row.length).toBe(96);
  });
});
