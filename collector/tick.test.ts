import { describe, it, expect } from 'vitest';
import { runTick, failedTick } from './tick.js';
import type { QuoteResult } from '../core/engine.js';
import type { CollectorConfig } from './config.js';
import { BLND, USDC, EURC } from '../core/assets.js';
import { toStroops } from '../core/amount.js';
import { quote as mk } from '../test/factory.js';

const cfg = (over: Partial<CollectorConfig> = {}): CollectorConfig => ({
  cadenceSec: 900, jitterSec: 60, sizesBlnd: [toStroops('250')], pairs: ['USDC'],
  dbPath: ':memory:', timeoutMs: 1000, rawRetentionDays: 90, rollupAfterDays: 365,
  rpcUrl: 'r', horizonUrl: 'h', ...over,
});
const prices = { blndUsd: 0.05, xlmUsd: 0.11, eurUsd: 1.08 };
const now = () => new Date('2026-06-16T10:00:00.000Z');

function usdcResult(amountIn: bigint): QuoteResult {
  const best = mk('xbull', toStroops('12.6'), { sellAsset: BLND, buyAsset: USDC, amountIn });
  const floor = mk('horizon', toStroops('11.4'), { sellAsset: BLND, buyAsset: USDC, amountIn });
  return {
    request: { sell: 'BLND', buy: 'USDC', amountIn, slippageBps: 50 }, prices,
    ranking: { ranked: [{ ...best, rank: 1, deltaVsBestPct: 0 }, { ...floor, rank: 2, deltaVsBestPct: -9 }], best: { ...best, rank: 1, deltaVsBestPct: 0 }, floor },
    errors: ['stellarbroker'],
    errorReasons: { stellarbroker: 'http' },
  };
}

describe('runTick (USDC)', () => {
  it('assemble 1 ligne tick + 1 quote par source, gagnant flaggé', async () => {
    const fakeQuote = async (o: any) => usdcResult(o.amountIn);
    const { tick, quotes } = await runTick({
      probes: [{ pair: 'BLND->USDC', buy: USDC, amountIn: toStroops('250') }],
      cfg: cfg(), now, fetchPrices: async () => prices, quote: fakeQuote,
    });
    expect(tick.ok).toBe(true);
    expect(tick.blnd_usd).toBe(0.05);
    expect(JSON.parse(tick.source_errors!)).toEqual([{ id: 'stellarbroker', reason: 'http' }]);
    expect(quotes.length).toBe(2);
    expect(quotes.filter((q) => q.is_winner).map((q) => q.source_id)).toEqual(['xbull']);
    expect(quotes[0]!.eurc_path).toBeNull();
  });

  it('prix KO (blndUsd null) → tick enregistré avec prix null, ok=true si quotes présentes', async () => {
    const noPrices = { blndUsd: null, xlmUsd: null, eurUsd: null };
    const { tick } = await runTick({
      probes: [{ pair: 'BLND->USDC', buy: USDC, amountIn: toStroops('250') }],
      cfg: cfg(), now, fetchPrices: async () => noPrices, quote: async (o: any) => usdcResult(o.amountIn),
    });
    expect(tick.blnd_usd).toBeNull();
    expect(tick.ok).toBe(true);
  });
});

describe('runTick (EURC)', () => {
  it('émet les lignes direct + 1 composite via-usdc, gagnant = meilleur net', async () => {
    const directBest = mk('xbull', toStroops('11.0'), { sellAsset: BLND, buyAsset: EURC });
    const leg1 = mk('xbull', toStroops('12.6'), { sellAsset: BLND, buyAsset: USDC });
    const leg2 = mk('horizon', toStroops('11.6'), { sellAsset: USDC, buyAsset: EURC });
    const result: QuoteResult = {
      request: { sell: 'BLND', buy: 'EURC', amountIn: toStroops('250'), slippageBps: 50 }, prices,
      ranking: { ranked: [{ ...directBest, rank: 1, deltaVsBestPct: 0 }], best: { ...directBest, rank: 1, deltaVsBestPct: 0 } },
      eurc: { direct: directBest, viaUsdc: { leg1, leg2, usdcMid: leg1.grossOut, netEurc: toStroops('11.6'), txCount: 2 },
              winner: 'via-usdc', bestNetEurc: toStroops('11.6'), viaUsdcAdvantage: toStroops('0.6'), note: 'x' },
      errors: [],
    };
    const { quotes } = await runTick({
      probes: [{ pair: 'BLND->EURC', buy: EURC, amountIn: toStroops('250') }],
      cfg: cfg({ pairs: ['EURC'] }), now, fetchPrices: async () => prices, quote: async () => result,
    });
    const paths = quotes.map((q) => q.eurc_path);
    expect(paths).toContain('direct');
    expect(paths).toContain('via-usdc');
    const winner = quotes.find((q) => q.is_winner)!;
    expect(winner.eurc_path).toBe('via-usdc');
    expect(winner.source_id).toBe('xbull+horizon');
  });

  it('winner=direct → flag positionnel sur ranked[0] (jamais de comparaison par valeur inter-fetch)', async () => {
    const d1 = mk('xbull', toStroops('11.4'), { sellAsset: BLND, buyAsset: EURC });
    const d2 = mk('aquarius', toStroops('11.0'), { sellAsset: BLND, buyAsset: EURC });
    // bestNetEurc d'un AUTRE fetch : valeur ≠ d1.netOut (simule les 2 fetchs distincts de l'engine).
    const directBest = mk('xbull', toStroops('11.39'), { sellAsset: BLND, buyAsset: EURC });
    const result: QuoteResult = {
      request: { sell: 'BLND', buy: 'EURC', amountIn: toStroops('250'), slippageBps: 50 }, prices,
      ranking: { ranked: [{ ...d1, rank: 1, deltaVsBestPct: 0 }, { ...d2, rank: 2, deltaVsBestPct: -3 }], best: { ...d1, rank: 1, deltaVsBestPct: 0 } },
      eurc: { direct: directBest, winner: 'direct', bestNetEurc: toStroops('11.39'), note: 'x' },
      errors: [],
    };
    const { quotes } = await runTick({
      probes: [{ pair: 'BLND->EURC', buy: EURC, amountIn: toStroops('250') }],
      cfg: cfg({ pairs: ['EURC'] }), now, fetchPrices: async () => prices, quote: async () => result,
    });
    const winners = quotes.filter((q) => q.is_winner);
    expect(winners.length).toBe(1);
    expect(winners[0]!.source_id).toBe('xbull'); // ranked[0], malgré bestNetEurc ≠ d1.netOut
  });
});

describe('failedTick', () => {
  it('produit une ligne ok=false avec note exception', () => {
    const d = new Date('2026-06-16T10:00:00.000Z');
    const t = failedTick({ cadenceSec: 900 }, d, d, 'boom');
    expect(t.ok).toBe(false);
    expect(t.note).toContain('boom');
    expect(t.blnd_usd).toBeNull();
  });
});

describe('runTick (tout-KO)', () => {
  it('aucune cotation → tick ok=false quand même retourné, 0 quote', async () => {
    const empty: QuoteResult = {
      request: { sell: 'BLND', buy: 'USDC', amountIn: toStroops('250'), slippageBps: 50 }, prices,
      ranking: { ranked: [] }, errors: ['xbull', 'horizon'],
      errorReasons: { xbull: 'timeout', horizon: 'indisponible' },
    };
    const { tick, quotes } = await runTick({
      probes: [{ pair: 'BLND->USDC', buy: USDC, amountIn: toStroops('250') }],
      cfg: cfg(), now, fetchPrices: async () => prices, quote: async () => empty,
    });
    expect(tick.ok).toBe(false);
    expect(quotes.length).toBe(0);
    expect(JSON.parse(tick.source_errors!)).toEqual([{ id: 'xbull', reason: 'timeout' }, { id: 'horizon', reason: 'indisponible' }]);
  });
});
