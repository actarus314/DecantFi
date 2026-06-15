// Analyse de fractionnement : recote le montant a plusieurs tailles (defaut 25/50/100 %) pour
// montrer l'impact marginal et si decouper le swap aide. v1 = INFORMATIF (l'utilisateur execute).
import type { NormalizedQuote, Stroops } from './sources/types.js';
import { rankQuotes } from './rank.js';
import { toNumber } from './amount.js';

/** Rend toutes les cotations disponibles pour un montant d'entree donne. */
export type QuoteAllFn = (amountIn: Stroops) => Promise<NormalizedQuote[]>;

export interface SplitPoint {
  fractionPct: number;
  amountIn: Stroops;
  best?: NormalizedQuote;
  netOut?: Stroops;
  /** Prix effectif net par unite vendue (cible / BLND) a cette taille. */
  effectivePrice?: number;
}

export interface SplitAnalysis {
  points: SplitPoint[];
  /** true si 2 demi-swaps rendent (approximativement) plus qu'un swap unique a 100 %. */
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
    // 2 swaps a 50 % vs 1 swap a 100 % (approximation : ignore le drift inter-tx).
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
