// Classement des cotations par netOut = BRUT (montant cible recu, net des frais de swap + impact ;
// le gas XLM n'est PAS deduit, paye a part). Strictement comparable entre sources. StellarBroker est
// classe sur son plancher (son adapter met netOut = plancher), donc un simple tri descendant suffit.
import type { NormalizedQuote } from './sources/types.js';
import { toNumber } from './amount.js';

export interface RankedQuote extends NormalizedQuote {
  rank: number;
  /** Ecart vs le meilleur net, en % (0 pour le meilleur, negatif pour les autres). */
  deltaVsBestPct: number;
}

export interface Ranking {
  ranked: RankedQuote[];
  best?: RankedQuote;
  /** Cotation Horizon, exposee comme plancher de reference si presente. */
  floor?: NormalizedQuote;
}

/** Trie par netOut decroissant, attribue rang + ecart vs meilleur. Ignore les netOut <= 0. */
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
