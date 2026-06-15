// EURC traite comme cible de premier rang : on evalue TOUJOURS deux familles et on garde le meilleur net EURC.
//   1. Direct   : BLND -> EURC (chaque source fait son multi-hop interne atomique).
//   2. Via-USDC : meilleur BLND -> USDC (leg 1), puis USDC -> EURC recote sur l'USDC REELLEMENT recu (leg 2).
// Verifie au design : via-USDC bat souvent le direct (pas de marche BLND/EURC profond).
import type { NormalizedQuote, Stroops } from './sources/types.js';
import { rankQuotes } from './rank.js';

export interface ViaUsdcResult {
  leg1: NormalizedQuote; // meilleur BLND -> USDC
  leg2: NormalizedQuote; // meilleur USDC -> EURC sur l'USDC recu au leg 1
  usdcMid: Stroops; // USDC recu entre les deux legs
  netEurc: Stroops;
  txCount: 2;
}

export interface EurcComparison {
  direct?: NormalizedQuote; // meilleur BLND -> EURC direct
  viaUsdc?: ViaUsdcResult;
  winner: 'direct' | 'via-usdc' | null;
  bestNetEurc?: Stroops;
  /** Surcout/avantage du via-USDC vs direct, en stroops EURC (peut etre negatif). */
  viaUsdcAdvantage?: Stroops;
  note: string;
}

export interface EurcQuoters {
  blndToEurc: (amountBlnd: Stroops) => Promise<NormalizedQuote[]>;
  blndToUsdc: (amountBlnd: Stroops) => Promise<NormalizedQuote[]>;
  usdcToEurc: (amountUsdc: Stroops) => Promise<NormalizedQuote[]>;
}

export async function compareEurc(amountBlnd: Stroops, q: EurcQuoters): Promise<EurcComparison> {
  const direct = rankQuotes(await q.blndToEurc(amountBlnd)).best;

  let viaUsdc: ViaUsdcResult | undefined;
  const leg1 = rankQuotes(await q.blndToUsdc(amountBlnd)).best;
  if (leg1 && leg1.grossOut > 0n) {
    // Recote sur l'USDC REELLEMENT recu = grossOut (le gas est paye en XLM, pas preleve sur l'USDC).
    const usdcReceived = leg1.grossOut;
    const leg2 = rankQuotes(await q.usdcToEurc(usdcReceived)).best;
    if (leg2 && leg2.netOut > 0n) {
      viaUsdc = { leg1, leg2, usdcMid: usdcReceived, netEurc: leg2.netOut, txCount: 2 };
    }
  }

  const directNet = direct?.netOut;
  const viaNet = viaUsdc?.netEurc;

  let winner: EurcComparison['winner'] = null;
  let bestNetEurc: Stroops | undefined;
  if (directNet !== undefined && viaNet !== undefined) {
    winner = viaNet > directNet ? 'via-usdc' : 'direct';
    bestNetEurc = winner === 'via-usdc' ? viaNet : directNet;
  } else if (directNet !== undefined) {
    winner = 'direct';
    bestNetEurc = directNet;
  } else if (viaNet !== undefined) {
    winner = 'via-usdc';
    bestNetEurc = viaNet;
  }

  const viaUsdcAdvantage =
    directNet !== undefined && viaNet !== undefined ? viaNet - directNet : undefined;

  let note = 'Aucune route EURC trouvee.';
  if (winner === 'via-usdc') note = 'via-USDC gagne, mais 2 swaps a executer (drift inter-tx possible).';
  else if (winner === 'direct') note = 'Direct gagne (1 seul swap).';

  return { direct, viaUsdc, winner, bestNetEurc, viaUsdcAdvantage, note };
}
