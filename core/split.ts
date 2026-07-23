// Split analysis: requotes the amount at several sizes (default 25/50/100%) to
// show the marginal impact and whether splitting the swap helps. v1 = INFORMATIONAL (user executes).
import type { NormalizedQuote, Stroops } from './sources/types.js';
import { rankQuotes } from './rank.js';
import { toNumber } from './amount.js';

/** Returns all available quotes for a given input amount. */
export type QuoteAllFn = (amountIn: Stroops) => Promise<NormalizedQuote[]>;

export interface SplitPoint {
  fractionPct: number;
  amountIn: Stroops;
  best?: NormalizedQuote;
  netOut?: Stroops;
  /** Effective net price per unit sold (target / BLND) at this size. */
  effectivePrice?: number;
}

export interface SplitAnalysis {
  points: SplitPoint[];
  /** true if 2 half-swaps yield (approximately) more than a single 100% swap. */
  splitHelps: boolean;
  note: string;
}

export async function analyzeSplit(
  totalIn: Stroops,
  fractionsPct: number[],
  quoteAll: QuoteAllFn,
): Promise<SplitAnalysis> {
  const points: SplitPoint[] = [];
  for (const f of fractionsPct) {
    const amountIn = (totalIn * BigInt(Math.round(f))) / 100n;
    const best = amountIn > 0n ? rankQuotes(await quoteAll(amountIn)).best : undefined;
    points.push({
      fractionPct: f,
      amountIn,
      best,
      netOut: best?.netOut,
      effectivePrice: best ? toNumber(best.netOut) / toNumber(amountIn) : undefined,
    });
  }

  const at = (f: number) => points.find((p) => p.fractionPct === f);
  const p100 = at(100);
  const p50 = at(50);
  let splitHelps = false;
  if (p100?.netOut !== undefined && p50?.netOut !== undefined) {
    // 2 swaps at 50% vs 1 swap at 100% (approximation: ignores inter-tx drift).
    splitHelps = p50.netOut * 2n > p100.netOut;
  }

  return {
    points,
    splitHelps,
    note: splitHelps
      ? 'Fractionner peut ameliorer le net (impact marginal decroissant) — approx., 2 tx, drift possible.'
      : 'Un swap unique semble optimal a cette taille.',
  };
}
