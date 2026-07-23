// Ranks quotes by netOut = GROSS (target amount received, net of swap fees + impact;
// XLM gas is NOT deducted, paid separately). Strictly comparable across sources. StellarBroker is
// ranked on its WS estimate (its adapter sets netOut = estimate), so a plain descending sort is enough.
import type { NormalizedQuote } from './sources/types.js';
import { toNumber } from './amount.js';

export interface RankedQuote extends NormalizedQuote {
  rank: number;
  /** Gap vs the best net, in % (0 for the best, negative for the others). */
  deltaVsBestPct: number;
}

export interface Ranking {
  ranked: RankedQuote[];
  best?: RankedQuote;
  /** Horizon quote, exposed as a reference floor if present. */
  floor?: NormalizedQuote;
}

/** Sorts by descending netOut, assigns rank + gap vs best. Ignores netOut <= 0. */
export function rankQuotes(quotes: NormalizedQuote[]): Ranking {
  const valid = quotes.filter((q) => q.netOut > 0n);
  const sorted = [...valid].sort((a, b) => (a.netOut < b.netOut ? 1 : a.netOut > b.netOut ? -1 : 0));

  const bestNet = sorted.length > 0 ? sorted[0]!.netOut : 0n;
  const bestNum = toNumber(bestNet);

  const ranked: RankedQuote[] = sorted.map((q, i) => ({
    ...q,
    rank: i + 1,
    deltaVsBestPct: bestNum > 0 ? ((toNumber(q.netOut) - bestNum) / bestNum) * 100 : 0,
  }));

  return {
    ranked,
    best: ranked[0],
    floor: quotes.find((q) => q.source === 'horizon') ?? quotes.find((q) => q.source === 'ultrastellar'),
  };
}
