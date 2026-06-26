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

  describe('isExecutable filter — composite legs must be executable', () => {
    // Scenario: stellarbroker offers the best leg2 netOut but is not executable.
    // The next best (ultrastellar) is executable and must win when the filter is active.
    function quotersWithNonExecLeg2(): EurcQuoters {
      return {
        blndToEurc: async () => [],
        blndToUsdc: async () => [quote('xbull', toStroops('50'))],
        usdcToEurc: async (amt) => [
          // stellarbroker quotes higher but is not executable
          quote('stellarbroker', toStroops('47'), { sellAsset: USDC, buyAsset: EURC, amountIn: amt }),
          // ultrastellar is executable and slightly lower
          quote('ultrastellar', toStroops('45'), { sellAsset: USDC, buyAsset: EURC, amountIn: amt }),
        ],
      };
    }

    it('without filter: stellarbroker (highest) wins leg2', async () => {
      const r = await compareEurc(toStroops('1000'), quotersWithNonExecLeg2());
      expect(r.viaUsdc?.leg2.source).toBe('stellarbroker');
      expect(r.viaUsdc?.netEurc).toBe(toStroops('47'));
    });

    it('with isExecutable filter: ultrastellar (executable) wins leg2, not stellarbroker', async () => {
      const r = await compareEurc(toStroops('1000'), quotersWithNonExecLeg2(), undefined, isExecutableSource);
      expect(r.viaUsdc?.leg2.source).toBe('ultrastellar');
      expect(r.viaUsdc?.netEurc).toBe(toStroops('45'));
    });

    it('with isExecutable filter: non-exec leg1 is skipped in favour of executable runner-up', async () => {
      const qs: EurcQuoters = {
        blndToEurc: async () => [],
        blndToUsdc: async () => [
          // stellarbroker quotes the best leg1 but is not executable
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
      const r = await compareEurc(toStroops('1000'), qs, undefined, isExecutableSource);
      expect(r.viaUsdc?.leg1.source).toBe('xbull');
      // usdcMid must reflect the executable leg1 grossOut (50, not 55)
      expect(r.viaUsdc?.usdcMid).toBe(toStroops('50'));
    });
  });
});
