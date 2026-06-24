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
  rpcUrl: 'r', rpcUrls: ['r'], horizonUrl: 'h', ...over,
});
// Fake selectRpc : évite toute connexion réseau dans les tests.
const fakeSelectRpc = async (urls: string[]) => ({ chosen: urls[0] ?? 'r', probes: [] });
const prices = { blndUsd: 0.05, xlmUsd: 0.11, eurcUsd: 1.08, eurcStellarMid: null };
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
      cfg: cfg(), now, fetchPrices: async () => prices, quote: fakeQuote, selectRpc: fakeSelectRpc,
    });
    expect(tick.ok).toBe(true);
    expect(tick.blnd_usd).toBe(0.05);
    expect(JSON.parse(tick.source_errors!)).toEqual([{ id: 'stellarbroker', reason: 'http' }]);
    expect(quotes.length).toBe(2);
    expect(quotes.filter((q) => q.is_winner).map((q) => q.source_id)).toEqual(['xbull']);
    expect(quotes[0]!.eurc_path).toBeNull();
  });

  it('prix KO (blndUsd null) → tick enregistré avec prix null, ok=true si quotes présentes', async () => {
    const noPrices = { blndUsd: null, xlmUsd: null, eurcUsd: null, eurcStellarMid: null };
    const { tick } = await runTick({
      probes: [{ pair: 'BLND->USDC', buy: USDC, amountIn: toStroops('250') }],
      cfg: cfg(), now, fetchPrices: async () => noPrices, quote: async (o: any) => usdcResult(o.amountIn), selectRpc: fakeSelectRpc,
    });
    expect(tick.blnd_usd).toBeNull();
    expect(tick.ok).toBe(true);
  });

  it('forwards stellarBrokerApiKey to the engine cfg (collector/web parity)', async () => {
    let seenCfg: any = null;
    const captureQuote = async (o: any) => { seenCfg = o.cfg; return usdcResult(o.amountIn); };
    await runTick({
      probes: [{ pair: 'BLND->USDC', buy: USDC, amountIn: toStroops('250') }],
      cfg: cfg({ stellarBrokerApiKey: 'sb-test-key' }), now, fetchPrices: async () => prices, quote: captureQuote, selectRpc: fakeSelectRpc,
    });
    expect(seenCfg?.stellarBrokerApiKey).toBe('sb-test-key');
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
      cfg: cfg({ pairs: ['EURC'] }), now, fetchPrices: async () => prices, quote: async () => result, selectRpc: fakeSelectRpc,
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
      cfg: cfg({ pairs: ['EURC'] }), now, fetchPrices: async () => prices, quote: async () => result, selectRpc: fakeSelectRpc,
    });
    const winners = quotes.filter((q) => q.is_winner);
    expect(winners.length).toBe(1);
    expect(winners[0]!.source_id).toBe('xbull'); // ranked[0], malgré bestNetEurc ≠ d1.netOut
  });
});

describe('runTick (EURC resim leg exclusion)', () => {
  it('leg1=Aquarius avec simulateAquariusNet→null : pas de composite via-usdc dans les quotes', async () => {
    // When makeReSimLeg/compareEurc excludes the Aquarius leg (sim → null = non-executable route),
    // the engine returns eurc.viaUsdc = undefined. rowsForProbe must not emit a via-usdc row.
    // We simulate this by injecting a result where viaUsdc is absent (engine already ran reSimLeg).
    const directBest = mk('xbull', toStroops('11.0'), { sellAsset: BLND, buyAsset: EURC });

    const result: QuoteResult = {
      request: { sell: 'BLND', buy: 'EURC', amountIn: toStroops('250'), slippageBps: 50 }, prices,
      ranking: { ranked: [{ ...directBest, rank: 1, deltaVsBestPct: 0 }], best: { ...directBest, rank: 1, deltaVsBestPct: 0 } },
      // viaUsdc absent: makeReSimLeg returned null for the Aquarius leg → compareEurc found no leg1
      eurc: {
        direct: directBest,
        viaUsdc: undefined,
        winner: 'direct',
        bestNetEurc: toStroops('11.0'),
        note: 'x',
      },
      errors: [],
    };

    const { quotes } = await runTick({
      probes: [{ pair: 'BLND->EURC', buy: EURC, amountIn: toStroops('250') }],
      cfg: cfg({ pairs: ['EURC'] }), now, fetchPrices: async () => prices, quote: async () => result,
      selectRpc: fakeSelectRpc,
    });

    // The via-usdc composite must not appear in collected rows
    const paths = quotes.map((q) => q.eurc_path);
    expect(paths).not.toContain('via-usdc');
    // Direct quotes should still be present
    expect(paths).toContain('direct');
    // The winner is the direct xbull quote
    const winner = quotes.find((q) => q.is_winner)!;
    expect(winner.eurc_path).toBe('direct');
    expect(winner.source_id).toBe('xbull');
  });
});

describe('runTick (resim Aquarius + xBull)', () => {
  it('stocke le net re-simulé d\'Aquarius quand la sim retourne une valeur différente', async () => {
    // Aquarius sur-cote 12.6 → sim retourne 12.4 → la row DB doit stocker 12.4
    const aqQ = mk('aquarius', toStroops('12.6'), {
      sellAsset: BLND, buyAsset: USDC, amountIn: toStroops('250'),
      raw: { swap_chain_xdr: 'FAKE_XDR' },
    });
    const result: QuoteResult = {
      request: { sell: 'BLND', buy: 'USDC', amountIn: toStroops('250'), slippageBps: 50 }, prices,
      ranking: { ranked: [{ ...aqQ, rank: 1, deltaVsBestPct: 0 }], best: { ...aqQ, rank: 1, deltaVsBestPct: 0 } },
      errors: [],
    };

    const fakeSimAq = async (_xdr: string, _amt: bigint, _sac: string, _opts: { rpcUrl: string }) => toStroops('12.4');

    const { quotes } = await runTick({
      probes: [{ pair: 'BLND->USDC', buy: USDC, amountIn: toStroops('250') }],
      cfg: cfg(), now, fetchPrices: async () => prices, quote: async () => result,
      resimDeps: { simulateAquariusNet: fakeSimAq }, selectRpc: fakeSelectRpc,
    });

    expect(quotes.length).toBe(1);
    expect(quotes[0]!.source_id).toBe('aquarius');
    expect(quotes[0]!.net_out).toBe(toStroops('12.4'));
    expect(quotes[0]!.is_winner).toBe(true);
  });

  it('stocke le net re-simulé de xBull et est_winner si meilleur après re-rank', async () => {
    // xBull sur-cote 12.6 → sim retourne 11.8 < Aquarius 12.0 → Aquarius doit être winner
    const xbQ = mk('xbull', toStroops('12.6'), {
      sellAsset: BLND, buyAsset: USDC, amountIn: toStroops('250'),
      raw: { route: 'BLND:GBLD,XLM:native,USDC:GUSDC' },
    });
    const aqQ = mk('aquarius', toStroops('12.0'), { sellAsset: BLND, buyAsset: USDC, amountIn: toStroops('250') });
    const result: QuoteResult = {
      request: { sell: 'BLND', buy: 'USDC', amountIn: toStroops('250'), slippageBps: 50 }, prices,
      ranking: {
        ranked: [{ ...xbQ, rank: 1, deltaVsBestPct: 0 }, { ...aqQ, rank: 2, deltaVsBestPct: -5 }],
        best: { ...xbQ, rank: 1, deltaVsBestPct: 0 },
      },
      errors: [],
    };

    const fakeSimXb = async (_route: string, _amt: bigint, _opts: { rpcUrl: string }) =>
      ({ net: toStroops('11.8'), route: ['BLND', 'XLM', 'USDC'], transfers: [] });

    const { quotes } = await runTick({
      probes: [{ pair: 'BLND->USDC', buy: USDC, amountIn: toStroops('250') }],
      cfg: cfg(), now, fetchPrices: async () => prices, quote: async () => result,
      resimDeps: { simulateXbullNet: fakeSimXb }, selectRpc: fakeSelectRpc,
    });

    expect(quotes.length).toBe(2);
    const xbRow = quotes.find((q) => q.source_id === 'xbull')!;
    const aqRow = quotes.find((q) => q.source_id === 'aquarius')!;
    // net re-simulé stocké
    expect(xbRow.net_out).toBe(toStroops('11.8'));
    // après re-rank, Aquarius (12.0) > xBull (11.8) → Aquarius est winner
    expect(aqRow.is_winner).toBe(true);
    expect(xbRow.is_winner).toBe(false);
  });

  it('repli silencieux : une exception dans resim ne casse pas le tick (cote API conservée)', async () => {
    const xbQ = mk('xbull', toStroops('12.6'), {
      sellAsset: BLND, buyAsset: USDC, amountIn: toStroops('250'),
      raw: { route: 'FAKE' },
    });
    const result: QuoteResult = {
      request: { sell: 'BLND', buy: 'USDC', amountIn: toStroops('250'), slippageBps: 50 }, prices,
      ranking: { ranked: [{ ...xbQ, rank: 1, deltaVsBestPct: 0 }], best: { ...xbQ, rank: 1, deltaVsBestPct: 0 } },
      errors: [],
    };

    const throwingSim = async () => { throw new Error('RPC 429'); };

    const { tick, quotes } = await runTick({
      probes: [{ pair: 'BLND->USDC', buy: USDC, amountIn: toStroops('250') }],
      cfg: cfg(), now, fetchPrices: async () => prices, quote: async () => result,
      resimDeps: { simulateXbullNet: throwingSim as any }, selectRpc: fakeSelectRpc,
    });

    // tick ne doit pas exploser, cote API conservée
    expect(tick.ok).toBe(true);
    expect(quotes.length).toBe(1);
    expect(quotes[0]!.net_out).toBe(toStroops('12.6'));
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
      cfg: cfg(), now, fetchPrices: async () => prices, quote: async () => empty, selectRpc: fakeSelectRpc,
    });
    expect(tick.ok).toBe(false);
    expect(quotes.length).toBe(0);
    expect(JSON.parse(tick.source_errors!)).toEqual([{ id: 'xbull', reason: 'timeout' }, { id: 'horizon', reason: 'indisponible' }]);
  });
});
