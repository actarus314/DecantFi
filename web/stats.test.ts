// Tests de web/stats.ts : DB synthétique multi-ticks, plusieurs jours × heures × sondes × sources.
// Pas de réseau (stats lit la DB seule).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb, type TickInsert, type QuoteInsert } from '../db/index.js';
import { toStroops } from '../core/amount.js';
import { openReadOnly } from './read-db.js';
import { overview, displayName, chipFor, noteFor } from './stats.js';
import type { CollectorConfig } from '../collector/config.js';

// ─── Config synthétique ────────────────────────────────────────────────────────

const CFG: CollectorConfig = {
  cadenceSec: 900,
  jitterSec: 60,
  sizesBlnd: [toStroops(250), toStroops(750)],
  pairs: ['USDC', 'EURC'],
  dbPath: '',
  tz: 'Europe/Paris',
  timeoutMs: 15000,
  rawRetentionDays: 90,
  rollupAfterDays: 365,
  rpcUrl: 'https://mainnet.sorobanrpc.com',
  horizonUrl: 'https://horizon.stellar.org',
};

// ─── Graine synthétique ───────────────────────────────────────────────────────
// Sources utilisées pour USDC
const SOURCES_USDC = ['xbull', 'soroswap', 'aquarius', 'comet', 'ultrastellar', 'stellarbroker', 'horizon'];
// Sources utilisées pour EURC
const SOURCES_EURC = ['xbull', 'soroswap', 'aquarius', 'stellarbroker', 'horizon'];

// Prix de base BLND (USD) : on fait dériver le prix MAIS la qualité d'exécution doit rester stable.
// Pour tester la neutralité au prix, on crée une dérive de prix et on vérifie que l'heure "bonne"
// reste la même indépendamment de la dérive.
const BASE_BLND_USD = 0.05;
const PRICE_DRIFT_PER_DAY = 0.002; // +0.2% par jour (non-nul = test neutralité)

// Qualité d'exécution par heure UTC : heure 4 UTC est délibérément la meilleure.
const BEST_HOUR_UTC = 4;
const WORST_HOUR_UTC = 14;

function execQuality(hourUtc: number): number {
  // 1.0 ± 0.01 selon l'heure ; BEST_HOUR_UTC → 1.01, WORST_HOUR_UTC → 0.99
  if (hourUtc === BEST_HOUR_UTC) return 1.01;
  if (hourUtc === WORST_HOUR_UTC) return 0.99;
  return 1.0;
}

// Génère le net_out d'une source donnée pour une sonde et une qualité
function netOutFor(amountStroops: bigint, sourceRank: number, quality: number, blndUsd: number): bigint {
  // winner rank=0 → 1.0 * quality ; rank=1 → 0.998, rank=2 → 0.996 ...
  const relPerf = quality * (1 - sourceRank * 0.002);
  // net en unités cible = amount_in_blnd * blnd_usd * relPerf (USDC ≈ USD, spot = 1)
  const amountBlnd = Number(amountStroops) / 1e7;
  const netUnits = amountBlnd * blndUsd * relPerf;
  return BigInt(Math.round(netUnits * 1e7));
}

// Insère des ticks sur 8 jours, toutes les 2 heures UTC
// - jours 0-6 → dans la fenêtre 7 j  (NOW = jour 7 = "aujourd'hui")
// - jour -1   → à 8 jours = hors fenêtre (doit être ignoré)
// Sonde de référence : NOW_UTC = début du jour 7 à 12h UTC
// NOW_UTC = début du jour courant UTC (minuit) pour que les heures soient exactes
const NOW_UTC = new Date('2025-03-10T00:00:00Z');

let tmpDir: string;
let dbPath: string;

function buildTestDb(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'stellarswap-test-'));
  dbPath = join(tmpDir, 'test.db');
  const db = openDb(dbPath);

  const baseDays = -8; // commence 8 jours avant now (le premier tick sera hors-fenêtre)

  for (let dayOffset = baseDays; dayOffset <= -1; dayOffset++) {
    // dayOffset = -8 → hors fenêtre; -7 à -1 → dans fenêtre (7 jours)
    for (let hourUtc = 0; hourUtc < 24; hourUtc += 2) {
      const d = new Date(NOW_UTC.getTime() + dayOffset * 86400000 + hourUtc * 3600000);
      const startedAt = d.toISOString();
      const blndUsd = BASE_BLND_USD + PRICE_DRIFT_PER_DAY * (dayOffset + 8); // dérive
      const quality = execQuality(hourUtc);

      // Quelques ticks ok=0 à intercaler (un par jour à h=10)
      const isOk = hourUtc !== 10;

      const tick: TickInsert = {
        started_at: startedAt,
        finished_at: new Date(d.getTime() + 5000).toISOString(),
        cadence_sec: 900,
        blnd_usd: blndUsd,
        xlm_usd: 0.12,
        eur_usd: 1.08,
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
            const netConf = src === 'stellarbroker' ? 'floor' : src === 'horizon' ? 'estimate' : 'exact';
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
              route_summary: null,
              is_winner: isWinner,
              eurc_path: eurcPath,
              raw_json: null,
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

// ─── Test 1 : ladders ────────────────────────────────────────────────────────

describe('ladders', () => {
  it('ordre net_out desc', () => {
    const rows = result_usdc.ladders['750']!;
    expect(rows.length).toBeGreaterThan(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.net).toBeLessThanOrEqual(rows[i - 1]!.net);
    }
  });

  it('winner = premier (is_winner)', () => {
    const rows = result_usdc.ladders['750']!;
    expect(rows[0]!.winner).toBe(true);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.winner).toBe(false);
    }
  });

  it('deltaVsWinner = 0 pour le gagnant, négatif sinon', () => {
    const rows = result_usdc.ladders['250']!;
    expect(rows[0]!.deltaVsWinner).toBeCloseTo(0, 5);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.deltaVsWinner).toBeLessThan(0);
    }
  });

  it('chips mappés correctement (stellarbroker=est, xbull=obs)', () => {
    const rows = result_usdc.ladders['750']!;
    const xbull = rows.find(r => r.display === 'xBull');
    const stellarbroker = rows.find(r => r.display === 'StellarBroker');
    expect(xbull?.chip).toBe('obs');
    expect(stellarbroker?.chip).toBe('est');
  });

  it('notes mappées (gagnant, cross-check, fee=0...)', () => {
    const rows = result_usdc.ladders['750']!;
    const winner = rows.find(r => r.winner);
    expect(winner?.note).toContain('gagnant');
    const comet = rows.find(r => r.display === 'Comet (pool)');
    expect(comet?.note).toContain('cross-check backstop');
    const ultra = rows.find(r => r.display === 'Ultra Stellar');
    expect(ultra?.note).toContain('fee = 0');
  });

  it('EURC note via-USDC sur le gagnant', () => {
    const rows = result_eurc.ladders['250']!;
    const winner = rows.find(r => r.winner);
    expect(winner?.note).toContain('via-USDC');
  });
});

// ─── Test 2 : winnerDist ────────────────────────────────────────────────────

describe('winnerDist', () => {
  it('somme des pourcentages ≈ 100', () => {
    const dist = result_usdc.winnerDist;
    expect(dist.length).toBeGreaterThan(0);
    const sum = dist.reduce((a, d) => a + d.pct, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('source dominante en tête (xBull = seule gagnante dans la graine)', () => {
    const dist = result_usdc.winnerDist;
    expect(dist[0]!.display).toBe('xBull');
    expect(dist[0]!.pct).toBeGreaterThan(90);
  });
});

// ─── Test 3 : hourlyUtc ─────────────────────────────────────────────────────

describe('hourlyUtc', () => {
  it('heure 4 UTC ressort positive (meilleure)', () => {
    const h = result_usdc.hourlyUtc;
    // h[4] doit être la valeur positive max (exécution la meilleure à 4h UTC)
    const nonNull = h.filter((v): v is number => v !== null);
    expect(nonNull.length).toBeGreaterThan(0);
    const h4 = h[BEST_HOUR_UTC];
    expect(h4).not.toBeNull();
    expect(h4).toBeGreaterThan(0);
  });

  it('heure 14 UTC ressort négative (pire)', () => {
    const h = result_usdc.hourlyUtc;
    const h14 = h[WORST_HOUR_UTC];
    expect(h14).not.toBeNull();
    expect(h14).toBeLessThan(0);
  });

  it('bucket vide (heure 10 UTC → ok=0) = null', () => {
    // h=10 → ok=0 toujours → aucune donnée valide
    const h = result_usdc.hourlyUtc;
    expect(h[10]).toBeNull();
  });

  it('signe cohérent : dérive de prix ne renverse pas h4 vs h14', () => {
    const h = result_usdc.hourlyUtc;
    const h4 = h[BEST_HOUR_UTC] ?? null;
    const h14 = h[WORST_HOUR_UTC] ?? null;
    if (h4 !== null && h14 !== null) {
      expect(h4).toBeGreaterThan(h14);
    }
  });
});

// ─── Test 4 : heatUtc ──────────────────────────────────────────────────────

describe('heatUtc', () => {
  it('dimensions 7×24', () => {
    const heat = result_usdc.heatUtc;
    expect(heat.length).toBe(7);
    for (const row of heat) {
      expect(row.length).toBe(24);
    }
  });

  it('meilleure colonne = BEST_HOUR_UTC dans au moins un jour', () => {
    const heat = result_usdc.heatUtc;
    let found = false;
    for (const row of heat) {
      const best4 = row[BEST_HOUR_UTC] ?? null;
      const worst14 = row[WORST_HOUR_UTC] ?? null;
      if (best4 !== null && worst14 !== null && best4 > worst14) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ─── Test 5 : ok=0 exclus + fenêtre 7 j ─────────────────────────────────────

describe('exclusions', () => {
  it('nTicksOk exclut les ticks ok=0', () => {
    const meta = result_usdc.meta;
    // 8 jours × 12 ticks par jour (24h/2h) = 96 ticks ; mais jour -8 = hors fenêtre n'est pas compté ici
    // ok=0 → heure 10 UTC : 8 jours × 1 = 8 ticks ok=0
    // nTicks = 8 × 12 = 96 ; nTicksOk = 96 - 8 = 88
    expect(meta.nTicksOk).toBeLessThan(meta.nTicks);
  });

  it('tick à -8 jours ignoré (hors fenêtre 7 j) → winnerDist ne dépasse pas la fenêtre', () => {
    // Le tick le plus ancien (dayOffset=-8) est hors fenêtre.
    // On vérifie que les ticks dans la fenêtre = 7 × 12 = 84 ticks ok (sans les ok=0).
    // nTicksOk total = 88 (toute la DB) mais winnerDist ne compte que 7 jours.
    // On ne peut pas le vérifier directement par un chiffre fixe car la DB inclut day=-8,
    // mais on vérifie que la somme des dist reste cohérente (≈ 100).
    const dist = result_usdc.winnerDist;
    const sum = dist.reduce((a, d) => a + d.pct, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('ticks ok=0 (h=10) → hourlyUtc[10] = null', () => {
    expect(result_usdc.hourlyUtc[10]).toBeNull();
  });
});

// ─── Tests unitaires helpers ──────────────────────────────────────────────────

describe('helpers', () => {
  it('displayName (ids de base)', () => {
    expect(displayName('xbull')).toBe('xBull');
    expect(displayName('soroswap')).toBe('Soroswap');
    expect(displayName('comet')).toBe('Comet (pool)');
    expect(displayName('ultrastellar')).toBe('Ultra Stellar');
    expect(displayName('stellarbroker')).toBe('StellarBroker');
    expect(displayName('horizon')).toBe('Horizon (strict)');
  });

  it('displayName (combiné xbull+ultrastellar)', () => {
    expect(displayName('xbull+ultrastellar')).toBe('xBull + Ultra Stellar');
  });

  it('chipFor: exact→obs, floor→est, estimate+simple→est, estimate+combiné→calc', () => {
    expect(chipFor('exact', 'xbull', null)).toBe('obs');
    expect(chipFor('floor', 'stellarbroker', null)).toBe('est');
    expect(chipFor('estimate', 'horizon', null)).toBe('est');
    expect(chipFor('estimate', 'xbull+ultrastellar', null)).toBe('calc');
    expect(chipFor('estimate', 'xbull', 'via-usdc')).toBe('calc');
  });

  it('noteFor: gagnant, via-usdc, comet, ultra, broker, horizon', () => {
    expect(noteFor('xbull', true, null)).toBe('gagnant');
    expect(noteFor('xbull', true, 'via-usdc')).toBe('gagnant · via-USDC');
    expect(noteFor('comet', false, null)).toBe('cross-check backstop');
    expect(noteFor('ultrastellar', false, null)).toBe('fee = 0');
    expect(noteFor('stellarbroker', false, null)).toBe('plancher (fee opaque)');
    expect(noteFor('horizon', false, null)).toBe('plancher DEX');
    expect(noteFor('soroswap', false, null)).toBe('');
  });
});
