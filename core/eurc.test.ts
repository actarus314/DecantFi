import { describe, it, expect } from 'vitest';
import { compareEurc, type EurcQuoters } from './eurc.js';
import { isExecutableSource } from './executable.js';
import { toStroops, toNumber } from './amount.js';
import { quote } from '../test/factory.js';
import { USDC, EURC } from './assets.js';

const EUR_PER_USD = 0.92;

function quoters(opts: { directEurc?: string; usdc?: string }): EurcQuoters {
  return {
    blndToEurc: async () =>
      opts.directEurc ? [quote('xbull', toStroops(opts.directEurc), { buyAsset: EURC })] : [],
    blndToUsdc: async () => (opts.usdc ? [quote('xbull', toStroops(opts.usdc))] : []),
    usdcToEurc: async (amt) => {
      const eur = toNumber(amt) * EUR_PER_USD;
      return [quote('soroswap', toStroops(eur.toFixed(7)), { sellAsset: USDC, buyAsset: EURC, amountIn: amt })];
    },
  };
}

describe('compareEurc', () => {
  it('via-USDC gagne quand il bat le direct (cas du design ~46,7 vs ~43,6)', async () => {
    const r = await compareEurc(toStroops('1000'), quoters({ directEurc: '43.6', usdc: '50.8' }));
    expect(r.winner).toBe('via-usdc');
    // 50.8 * 0.92 = 46.736
    expect(r.bestNetEurc).toBe(toStroops('46.736'));
    expect(r.viaUsdc?.txCount).toBe(2);
    expect(r.viaUsdc?.usdcMid).toBe(toStroops('50.8'));
    expect(r.viaUsdcAdvantage).toBe(toStroops('46.736') - toStroops('43.6'));
  });

  it('via-USDC = brut leg 2 (gas leg 1 NON deduit : paye en XLM, a part)', async () => {
    // leg1 BLND->USDC : 50.8 USDC recus (gas leg1 estime 0.1 USDC mais NON deduit) ; leg2 @ 0.92.
    const qs: EurcQuoters = {
      blndToEurc: async () => [quote('xbull', toStroops('43'), { buyAsset: EURC })],
      blndToUsdc: async () => [quote('xbull', toStroops('50.8'), { gasInTarget: toStroops('0.1') })],
      usdcToEurc: async (amt) => {
        const eur = toNumber(amt) * EUR_PER_USD;
        return [quote('soroswap', toStroops(eur.toFixed(7)), { sellAsset: USDC, buyAsset: EURC, amountIn: amt })];
      },
    };
    const r = await compareEurc(toStroops('1000'), qs);
    expect(r.winner).toBe('via-usdc');
    // leg2 = 50.8*0.92 = 46.736 ; le gas leg1 n'est PLUS deduit → net = brut 46.736.
    expect(r.bestNetEurc).toBe(toStroops('46.736'));
  });

  it('direct gagne quand il est meilleur', async () => {
    const r = await compareEurc(toStroops('1000'), quoters({ directEurc: '60', usdc: '50.8' }));
    expect(r.winner).toBe('direct');
    expect(r.bestNetEurc).toBe(toStroops('60'));
  });

  it('via-USDC seul si pas de route directe', async () => {
    const r = await compareEurc(toStroops('1000'), quoters({ usdc: '50.8' }));
    expect(r.winner).toBe('via-usdc');
    expect(r.direct).toBeUndefined();
  });

  it('aucune route -> winner null', async () => {
    const r = await compareEurc(toStroops('1000'), quoters({}));
    expect(r.winner).toBeNull();
    expect(r.bestNetEurc).toBeUndefined();
  });

  describe('composite-leg filter — isExecutableSource predicate (P4: SB eligible for composite legs)', () => {
    // P3: engine passed (s) => isExecutableSource(s) && s !== 'stellarbroker' to compareEurc.
    // P4: the extra SB exclusion is removed — engine now passes isExecutableSource directly.
    // StellarBroker composite leg2 is dispatched to the Mediator WS flow by buildCompositeLeg2,
    // not to /api/build, so displayed==executed invariant is preserved.
    const p3CompositeFilter = (s: string) => isExecutableSource(s) && s !== 'stellarbroker';

    function quotersWithSbLeg2(): EurcQuoters {
      return {
        blndToEurc: async () => [],
        blndToUsdc: async () => [quote('xbull', toStroops('50'))],
        usdcToEurc: async (amt) => [
          // stellarbroker quotes higher; ultrastellar is slightly lower
          quote('stellarbroker', toStroops('47'), { sellAsset: USDC, buyAsset: EURC, amountIn: amt }),
          quote('ultrastellar', toStroops('45'), { sellAsset: USDC, buyAsset: EURC, amountIn: amt }),
        ],
      };
    }

    it('without filter: stellarbroker (highest) wins leg2', async () => {
      const r = await compareEurc(toStroops('1000'), quotersWithSbLeg2());
      expect(r.viaUsdc?.leg2.source).toBe('stellarbroker');
      expect(r.viaUsdc?.netEurc).toBe(toStroops('47'));
    });

    it('P4 filter (isExecutableSource): SB wins leg2 — no longer excluded from composite', async () => {
      // P4: engine passes isExecutableSource (SB is executable since P3) → SB selected as best leg2
      const r = await compareEurc(toStroops('1000'), quotersWithSbLeg2(), undefined, isExecutableSource);
      expect(r.viaUsdc?.leg2.source).toBe('stellarbroker');
      expect(r.viaUsdc?.netEurc).toBe(toStroops('47'));
    });

    it('with P3 composite filter: ultrastellar wins leg2 (SB excluded from composite)', async () => {
      // The P3 filter is kept here to document the mechanism; engine no longer passes it.
      const r = await compareEurc(toStroops('1000'), quotersWithSbLeg2(), undefined, p3CompositeFilter);
      expect(r.viaUsdc?.leg2.source).toBe('ultrastellar');
      expect(r.viaUsdc?.netEurc).toBe(toStroops('45'));
    });

    it('P4 filter (isExecutableSource): non-executable sources are still excluded from composite legs', async () => {
      const qs: EurcQuoters = {
        blndToEurc: async () => [],
        blndToUsdc: async () => [quote('xbull', toStroops('50'))],
        usdcToEurc: async (amt) => [
          // 'customsource' is not in EXECUTABLE_SOURCES — should be excluded
          quote('customsource', toStroops('55'), { sellAsset: USDC, buyAsset: EURC, amountIn: amt }),
          quote('stellarbroker', toStroops('47'), { sellAsset: USDC, buyAsset: EURC, amountIn: amt }),
        ],
      };
      const r = await compareEurc(toStroops('1000'), qs, undefined, isExecutableSource);
      // customsource is non-executable; stellarbroker is — SB wins
      expect(r.viaUsdc?.leg2.source).toBe('stellarbroker');
      expect(r.viaUsdc?.netEurc).toBe(toStroops('47'));
    });

    it('with P3 composite filter: SB leg1 is excluded in favour of runner-up', async () => {
      const qs: EurcQuoters = {
        blndToEurc: async () => [],
        blndToUsdc: async () => [
          // stellarbroker quotes the best leg1 but is excluded from composite legs by the P3 filter
          quote('stellarbroker', toStroops('55')),
          quote('xbull', toStroops('50')),
        ],
        usdcToEurc: async (amt) => [
          quote('soroswap', toStroops(String(toNumber(amt) * EUR_PER_USD)), {
            sellAsset: USDC,
            buyAsset: EURC,
            amountIn: amt,
          }),
        ],
      };
      const r = await compareEurc(toStroops('1000'), qs, undefined, p3CompositeFilter);
      expect(r.viaUsdc?.leg1.source).toBe('xbull');
      // usdcMid must reflect the eligible leg1 grossOut (50, not 55)
      expect(r.viaUsdc?.usdcMid).toBe(toStroops('50'));
    });
  });
});
