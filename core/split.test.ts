import { describe, it, expect } from 'vitest';
import { analyzeSplit, type QuoteAllFn } from './split.js';
import { toStroops, toNumber } from './amount.js';
import { quote } from '../test/factory.js';

// Modele de cotation : sortie = price*x - k*x^2 (impact de prix quadratique), x en unites BLND.
function makeQuoter(price: number, k: number): QuoteAllFn {
  return async (amountIn) => {
    const x = toNumber(amountIn);
    const outUnits = Math.max(0, price * x - k * x * x);
    return [quote('amm', toStroops(outUnits.toFixed(7)), { amountIn })];
  };
}

describe('analyzeSplit', () => {
  it('recote a chaque fraction avec le bon montant d entree', async () => {
    const a = await analyzeSplit(toStroops('1000'), [25, 50, 100], makeQuoter(0.051, 0));
    expect(a.points.map((p) => p.fractionPct)).toEqual([25, 50, 100]);
    expect(a.points.find((p) => p.fractionPct === 25)!.amountIn).toBe(toStroops('250'));
    expect(a.points.find((p) => p.fractionPct === 100)!.amountIn).toBe(toStroops('1000'));
  });

  it('detecte que fractionner aide quand l impact est marque', async () => {
    const a = await analyzeSplit(toStroops('1000'), [25, 50, 100], makeQuoter(0.051, 0.000005));
    expect(a.splitHelps).toBe(true);
  });

  it('sans impact (lineaire), fractionner n aide pas', async () => {
    const a = await analyzeSplit(toStroops('1000'), [50, 100], makeQuoter(0.051, 0));
    expect(a.splitHelps).toBe(false);
  });

  it('prix effectif decroit avec la taille quand il y a de l impact', async () => {
    const a = await analyzeSplit(toStroops('1000'), [50, 100], makeQuoter(0.051, 0.000005));
    const p50 = a.points.find((p) => p.fractionPct === 50)!;
    const p100 = a.points.find((p) => p.fractionPct === 100)!;
    expect(p50.effectivePrice!).toBeGreaterThan(p100.effectivePrice!);
  });
});
