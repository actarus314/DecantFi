// Tests de web/stats.ts : DB synthétique multi-ticks, plusieurs jours × heures × sondes × sources.
// Pas de réseau (stats lit la DB seule).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb, type TickInsert, type QuoteInsert } from '../db/index.js';
import { toStroops } from '../core/amount.js';
import { openReadOnly } from './read-db.js';
import { overview, displayName, chipFor, noteFor, buildIntradayLocal } from './stats.js';
import type { CollectorConfig } from '../collector/config.js';

// ─── Config synthétique ────────────────────────────────────────────────────────

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

  it('notes : vides sauf route composite EURC via-USDC', () => {
    const rows = result_usdc.ladders['750']!;
    for (const r of rows) expect(r.note).toBe('');
  });

  it('EURC note via-USDC sur le gagnant', () => {
    const rows = result_eurc.ladders['250']!;
    const winner = rows.find(r => r.winner);
    expect(winner?.note).toContain('multi-tx');
  });
});

// ─── Test 2 : winnerDist ────────────────────────────────────────────────────

describe('winnerDist', () => {
  it('somme des pourcentages ≈ 100', () => {
    const dist = result_usdc.winnerDist['250']!;
    expect(dist.length).toBeGreaterThan(0);
    const sum = dist.reduce((a, d) => a + d.pct, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('source dominante en tête (xBull = seule gagnante dans la graine)', () => {
    const dist = result_usdc.winnerDist['250']!;
    expect(dist[0]!.display).toBe('xBull');
    expect(dist[0]!.pct).toBeGreaterThan(90);
  });
});

// ─── Test bestRoutes ─────────────────────────────────────────────────────────

describe('bestRoutes', () => {
  it('classe les routes gagnantes, % somme ≈ 100, chemin + outils renseignés', () => {
    const routes = result_usdc.bestRoutes['250']!;
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0]!.path).toContain('BLND');
    expect(routes[0]!.tools.length).toBeGreaterThan(0);
    expect(routes.reduce((a, r) => a + r.winPct, 0)).toBeCloseTo(100, 0);
    // trié par victoires décroissantes
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i]!.wins).toBeLessThanOrEqual(routes[i - 1]!.wins);
    }
  });
});

// ─── Test 3 : heatEffUtc par sonde ──────────────────────────────────────────

describe('heatEffUtc', () => {
  it('présent pour les deux sondes (250 et 750)', () => {
    expect(result_usdc.heatEffUtc['250']).toBeDefined();
    expect(result_usdc.heatEffUtc['750']).toBeDefined();
  });

  it('dimensions 7×24 pour chaque sonde', () => {
    for (const key of ['250', '750'] as const) {
      const heat = result_usdc.heatEffUtc[key]!;
      expect(heat.length).toBe(7);
      for (const row of heat) {
        expect(row.length).toBe(24);
      }
    }
  });

  it('efficience brute > 0 pour les slots avec données (heure 4 UTC, sonde 750)', () => {
    const heat = result_usdc.heatEffUtc['750']!;
    // Au moins un jour doit avoir une valeur non-nulle à BEST_HOUR_UTC
    const hasData = heat.some(row => row[BEST_HOUR_UTC] !== null && (row[BEST_HOUR_UTC] as number) > 0);
    expect(hasData).toBe(true);
  });

  it('heure 10 UTC (ok=0) = null pour la sonde 750', () => {
    const heat = result_usdc.heatEffUtc['750']!;
    // h=10 → ok=0 → tous les slots de l'heure 10 UTC doivent être null
    for (const row of heat) {
      expect(row[10]).toBeNull();
    }
  });
});

// ─── Test 4 : effWeekAvg par sonde ──────────────────────────────────────────

describe('effWeekAvg', () => {
  it('présent pour les deux sondes avec valeur non-nulle', () => {
    expect(result_usdc.effWeekAvg['250']).not.toBeNull();
    expect(result_usdc.effWeekAvg['750']).not.toBeNull();
    expect(typeof result_usdc.effWeekAvg['250']).toBe('number');
    expect(typeof result_usdc.effWeekAvg['750']).toBe('number');
  });

  it('valeur plausible (proche de 1 pour USDC ≈ USD)', () => {
    const avg = result_usdc.effWeekAvg['750'] as number;
    expect(avg).toBeGreaterThan(0.9);
    expect(avg).toBeLessThan(1.1);
  });
});

// ─── Test 5 : intradayLocal par sonde ────────────────────────────────────────

describe('intradayLocal', () => {
  it('présent pour les deux sondes', () => {
    expect(result_usdc.intradayLocal['250']).toBeDefined();
    expect(result_usdc.intradayLocal['750']).toBeDefined();
  });

  it('dimensions 7×96 pour chaque sonde', () => {
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
  it('impactLocalPct présent sur chaque LadderRow USDC', () => {
    const rows = result_usdc.ladders['750']!;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect('impactLocalPct' in r).toBe(true);
    }
  });

  it('USDC : impactLocalPct non-null (blnd_usd présent, perUnitLocal=1)', () => {
    // Pour USDC perUnitLocal=1 → impactLocalPct = priceImpactPct recalculé, doit être défini
    const rows = result_usdc.ladders['750']!;
    expect(rows.some(r => r.impactLocalPct !== null)).toBe(true);
  });

  it('USDC : impactLocalPct est un nombre fini quand non-null', () => {
    const rows = result_usdc.ladders['750']!;
    for (const r of rows) {
      if (r.impactLocalPct !== null) {
        expect(Number.isFinite(r.impactLocalPct)).toBe(true);
      }
    }
  });

  it('EURC : impactLocalPct null quand eurc_stellar_mid absent du tick', () => {
    // La fixture insère eurc_stellar_mid=null sur tous les ticks → impactLocalPct doit être null
    const rows = result_eurc.ladders['750']!;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.impactLocalPct).toBeNull();
    }
  });
});

// ─── Test : impactLocalPct avec eurc_stellar_mid renseigné ────────────────────

let result_eurc_mid: ReturnType<typeof overview>;
let tmpDirEurcMid: string;

describe('impactLocalPct — EURC avec eurc_stellar_mid renseigné', () => {
  beforeAll(() => {
    tmpDirEurcMid = mkdtempSync(join(tmpdir(), 'stellarswap-eurcmid-'));
    const dbPath2 = join(tmpDirEurcMid, 'test.db');
    const db2 = openDb(dbPath2);

    const amountBlnd = toStroops(250);
    const blndUsd = 0.05;
    const eurcStellarMid = 1.05; // USDC par EURC (mid du carnet SDEX)
    // net_out : 250 BLND * 0.05 USD/BLND / 1.05 USDC/EURC * 0.99 (1% impact) en stroops
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
        price_impact_pct: 2.5, // valeur DB (EVM) arbitraire — ne correspond pas au local
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

  it('impactLocalPct non-null quand eurc_stellar_mid est posé sur le tick', () => {
    const row = result_eurc_mid.ladders['250']?.[0];
    expect(row).toBeDefined();
    expect(row!.impactLocalPct).not.toBeNull();
  });

  it('impactLocalPct distinct de impactPct DB (calcul local ≠ valeur stockée)', () => {
    const row = result_eurc_mid.ladders['250']?.[0];
    expect(row!.impactPct).toBeCloseTo(2.5, 4); // valeur DB inchangée
    // impactLocalPct recalculé ≈ 1% (net = 0.99 * spot local) → ≠ 2.5
    expect(row!.impactLocalPct).not.toBeCloseTo(2.5, 0);
    expect(row!.impactLocalPct).toBeGreaterThan(0);
  });

  it('impactLocalPct ≈ 1% (cohérence avec le net_out inséré)', () => {
    const row = result_eurc_mid.ladders['250']?.[0];
    // On a inséré net = spot_local * 0.99 → impact ≈ 1%
    expect(row!.impactLocalPct).toBeCloseTo(1.0, 0);
  });
});

// ─── Test 6 : champs supprimés absents du type ───────────────────────────────

describe('champs supprimés', () => {
  it('hourlyUtc absent de Overview', () => {
    expect((result_usdc as unknown as Record<string, unknown>)['hourlyUtc']).toBeUndefined();
  });

  it('heatUtc absent de Overview', () => {
    expect((result_usdc as unknown as Record<string, unknown>)['heatUtc']).toBeUndefined();
  });
});

// ─── Test 7 : ok=0 exclus + fenêtre 7 j ─────────────────────────────────────

describe('exclusions', () => {
  it('nTicksOk exclut les ticks ok=0', () => {
    const meta = result_usdc.meta;
    expect(meta.nTicksOk).toBeLessThan(meta.nTicks);
  });

  it('tick à -8 jours ignoré (hors fenêtre 7 j) → winnerDist ne dépasse pas la fenêtre', () => {
    const dist = result_usdc.winnerDist['250']!;
    const sum = dist.reduce((a, d) => a + d.pct, 0);
    expect(sum).toBeCloseTo(100, 0);
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
    expect(displayName('horizon')).toBe('Horizon');
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

  it('noteFor: vide sauf via-usdc', () => {
    expect(noteFor('xbull', true, null)).toBe('');
    expect(noteFor('xbull', true, 'via-usdc')).toBe('multi-tx');
    expect(noteFor('comet', false, null)).toBe('');
    expect(noteFor('ultrastellar', false, null)).toBe('');
    expect(noteFor('stellarbroker', false, null)).toBe('');
    expect(noteFor('horizon', false, null)).toBe('');
    expect(noteFor('soroswap', false, null)).toBe('');
  });
});

// ─── Test 8 : buildIntradayLocal — anti-mélange + mapping 15 min ─────────────

describe('buildIntradayLocal — anti-mélange', () => {
  /**
   * Scénario : même jour-de-semaine apparaît dans deux semaines différentes.
   * now = mercredi 2025-03-12T10:00:00Z, offsetH = 0 (pour rendre le test déterministe,
   * indépendant de la TZ machine).
   *
   * 2025-03-12 (mercredi) = dow 2 (0=Lun, 1=Mar, 2=Mer…)
   * 2025-03-05 (mercredi précédent) = même dow = 2
   *
   * On insère :
   *   - Tick A : 2025-03-12T08:00:00Z → slot 32 (8*4+0), eff=1.05
   *   - Tick B : 2025-03-05T14:30:00Z → slot 58 (14*4+2), eff=0.95  (semaine d'avant)
   *
   * Avec offsetH=0, les dates locales = dates UTC.
   * now - 0 j = 2025-03-12, dow=2 → c'est la date "actuelle" pour ce dow.
   * now - 7 j = 2025-03-05, même dow → doit être ignoré (hors des 7 dates les plus récentes).
   *
   * Résultat attendu :
   *   result[2][32] = 1.05   (slot de la date récente)
   *   result[2][58] = null   (slot de la semaine d'avant, absent)
   */
  it('ne mélange pas deux occurrences du même dow — seule la date la plus récente compte', () => {
    const now = new Date('2025-03-12T10:00:00Z');
    const offsetH = 0;

    // Tick A : mercredi 2025-03-12 à 08h00 UTC → slot 32
    const tickA: Parameters<typeof buildIntradayLocal>[0][number] = {
      hour_utc: 8,
      dow_utc: 2, // mercredi
      eff: 1.05,
      startedAtMs: new Date('2025-03-12T08:00:00Z').getTime(),
    };

    // Tick B : mercredi précédent 2025-03-05 à 14h30 UTC → slot 58
    const tickB: Parameters<typeof buildIntradayLocal>[0][number] = {
      hour_utc: 14,
      dow_utc: 2, // même dow
      eff: 0.95,
      startedAtMs: new Date('2025-03-05T14:30:00Z').getTime(),
    };

    const result = buildIntradayLocal([tickA, tickB], offsetH, now);

    expect(result.length).toBe(7);
    expect(result[0]!.length).toBe(96);

    // dow=2 (mercredi) : seuls les slots de 2025-03-12 présents
    const wedRow = result[2]!;

    // Slot 32 = 08:00 UTC → doit être 1.05 (date récente)
    expect(wedRow[32]).toBeCloseTo(1.05, 5);

    // Slot 58 = 14:30 UTC → doit être null (semaine d'avant, hors des 7 dates)
    expect(wedRow[58]).toBeNull();
  });

  it('mapping 15 min correct : HH:MM → slot = HH*4 + floor(MM/15)', () => {
    const now = new Date('2025-03-12T10:00:00Z');
    const offsetH = 0;

    // Ticks à des minutes précises pour vérifier le découpage 15-min
    const cases: Array<{ iso: string; expectedSlot: number; eff: number }> = [
      { iso: '2025-03-12T00:00:00Z', expectedSlot: 0,  eff: 1.0  }, // 00:00 → slot 0
      { iso: '2025-03-12T00:14:59Z', expectedSlot: 0,  eff: 1.01 }, // 00:14 → slot 0 (même quart)
      { iso: '2025-03-12T00:15:00Z', expectedSlot: 1,  eff: 1.02 }, // 00:15 → slot 1
      { iso: '2025-03-12T06:30:00Z', expectedSlot: 26, eff: 1.03 }, // 06:30 → slot 6*4+2=26
      { iso: '2025-03-12T23:45:00Z', expectedSlot: 95, eff: 1.04 }, // 23:45 → slot 23*4+3=95
    ];

    const rows: Parameters<typeof buildIntradayLocal>[0] = cases.map(c => ({
      hour_utc: new Date(c.iso).getUTCHours(),
      dow_utc: 2,
      eff: c.eff,
      startedAtMs: new Date(c.iso).getTime(),
    }));

    const result = buildIntradayLocal(rows, offsetH, now);
    const wedRow = result[2]!;

    // slot 0 : deux ticks → moyenne de 1.0 et 1.01
    expect(wedRow[0]).toBeCloseTo((1.0 + 1.01) / 2, 5);
    // slot 1
    expect(wedRow[1]).toBeCloseTo(1.02, 5);
    // slot 26
    expect(wedRow[26]).toBeCloseTo(1.03, 5);
    // slot 95
    expect(wedRow[95]).toBeCloseTo(1.04, 5);
  });

  it('avec offsetH non-nul : conversion locale correcte', () => {
    // offsetH = 2 (simulant UTC+2)
    // Tick UTC 22:00 le 2025-03-11 → heure locale = 00:00 le 2025-03-12
    // now = 2025-03-12T10:00:00Z, offsetH=2
    // Date locale de now = 2025-03-12 (12h UTC+2), dow=2 (mercredi)
    const now = new Date('2025-03-12T10:00:00Z');
    const offsetH = 2;

    // UTC 22:00 le 2025-03-11 → local = 00:00 le 2025-03-12 → slot 0
    const tickMs = new Date('2025-03-11T22:00:00Z').getTime();
    const rows: Parameters<typeof buildIntradayLocal>[0] = [{
      hour_utc: 22,
      dow_utc: 1, // mardi UTC
      eff: 1.07,
      startedAtMs: tickMs,
    }];

    const result = buildIntradayLocal(rows, offsetH, now);

    // En local, ce tick tombe le 2025-03-12, dow=2 (mercredi), slot 0
    const wedRow = result[2]!;
    expect(wedRow[0]).toBeCloseTo(1.07, 5);

    // Le mardi local (dow=1) ne doit pas avoir ce tick
    const tueRow = result[1]!;
    expect(tueRow[0]).toBeNull();
  });
});
