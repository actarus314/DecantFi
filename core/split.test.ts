import { describe, it, expect } from 'vitest';
import { analyzeSplit, type QuoteAllFn } from './split.js';
import { toStroops, toNumber } from './amount.js';
import { quote } from '../test/factory.js';

// Quote model: output = price*x - k*x^2 (quadratic price impact), x in BLND units.
function makeQuoter(price: number, k: number): QuoteAllFn {
  return async (amountIn) => {
    const x = toNumber(amountIn);
    const outUnits = Math.max(0, price * x - k * x * x);
    return [quote('amm', toStroops(outUnits.toFixed(7)), { amountIn })];
  };
}

describe('analyzeSplit', () => {
  it('requotes at each fraction with the right input amount', async () => {
    const a = await analyzeSplit(toStroops('1000'), [25, 50, 100], makeQuoter(0.051, 0));
    expect(a.points.map((p) => p.fractionPct)).toEqual([25, 50, 100]);
    expect(a.points.find((p) => p.fractionPct === 25)!.amountIn).toBe(toStroops('250'));
    expect(a.points.find((p) => p.fractionPct === 100)!.amountIn).toBe(toStroops('1000'));
  });

  it('detects that splitting helps when impact is significant', async () => {
    const a = await analyzeSplit(toStroops('1000'), [25, 50, 100], makeQuoter(0.051, 0.000005));
    expect(a.splitHelps).toBe(true);
  });

  it('without impact (linear), splitting does not help', async () => {
    const a = await analyzeSplit(toStroops('1000'), [50, 100], makeQuoter(0.051, 0));
    expect(a.splitHelps).toBe(false);
  });

  it('effective price decreases with size when there is impact', async () => {
    const a = await analyzeSplit(toStroops('1000'), [50, 100], makeQuoter(0.051, 0.000005));
    const p50 = a.points.find((p) => p.fractionPct === 50)!;
    const p100 = a.points.find((p) => p.fractionPct === 100)!;
    expect(p50.effectivePrice!).toBeGreaterThan(p100.effectivePrice!);
  });
});
