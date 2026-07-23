// EURC treated as a first-rank target: ALWAYS evaluate both families and keep the best EURC net.
//   1. Direct   : BLND -> EURC (each source does its own atomic internal multi-hop).
//   2. Via-USDC : best BLND -> USDC (leg 1), then USDC -> EURC requoted on the USDC ACTUALLY received (leg 2).
// Verified by design: via-USDC often beats direct (no deep BLND/EURC market).
import type { NormalizedQuote, Stroops } from './sources/types.js';
import { rankQuotes } from './rank.js';
import { fromStroops } from './amount.js';

/** true if a and b are within ~0.1% of each other (same underlying pools). */
function closeEnough(a: Stroops, b: Stroops): boolean {
  if (b <= 0n) return a === b;
  const diff = a > b ? a - b : b - a;
  return diff * 1000n <= b;
}

export interface ViaUsdcResult {
  leg1: NormalizedQuote; // best BLND -> USDC
  leg2: NormalizedQuote; // best USDC -> EURC on the USDC received at leg 1
  usdcMid: Stroops; // USDC received between the two legs
  netEurc: Stroops;
  txCount: 2;
}

export interface EurcComparison {
  direct?: NormalizedQuote; // best direct BLND -> EURC
  viaUsdc?: ViaUsdcResult;
  winner: 'direct' | 'via-usdc' | null;
  bestNetEurc?: Stroops;
  /** Cost/advantage of via-USDC vs direct, in EURC stroops (can be negative). */
  viaUsdcAdvantage?: Stroops;
  note: string;
}

export interface EurcQuoters {
  blndToEurc: (amountBlnd: Stroops) => Promise<NormalizedQuote[]>;
  blndToUsdc: (amountBlnd: Stroops) => Promise<NormalizedQuote[]>;
  usdcToEurc: (amountUsdc: Stroops) => Promise<NormalizedQuote[]>;
}

export async function compareEurc(
  amountBlnd: Stroops,
  q: EurcQuoters,
  reSimLeg?: (quotes: NormalizedQuote[], amountIn: Stroops) => Promise<NormalizedQuote[]>,
  isExecutable?: (source: string) => boolean,
): Promise<EurcComparison> {
  const [directRaw, leg1List] = await Promise.all([
    q.blndToEurc(amountBlnd),
    q.blndToUsdc(amountBlnd),
  ]);
  const direct = rankQuotes(directRaw).best;

  let viaUsdc: ViaUsdcResult | undefined;
  const leg1Honest = reSimLeg ? await reSimLeg(leg1List, amountBlnd) : leg1List;
  // Filter composite legs to executable sources only — ensures displayed composite == executable composite.
  const leg1Candidates = isExecutable ? leg1Honest.filter((q) => isExecutable(q.source)) : leg1Honest;
  const leg1 = rankQuotes(leg1Candidates).best;
  if (leg1 && leg1.grossOut > 0n) {
    // Requote on the USDC ACTUALLY received = grossOut (gas is paid in XLM, not taken from the USDC).
    const usdcReceived = leg1.grossOut;
    const leg2List = await q.usdcToEurc(usdcReceived);
    const leg2Honest = reSimLeg ? await reSimLeg(leg2List, usdcReceived) : leg2List;
    const leg2Candidates = isExecutable ? leg2Honest.filter((q) => isExecutable(q.source)) : leg2Honest;
    const leg2 = rankQuotes(leg2Candidates).best;
    if (leg2 && leg2.netOut > 0n) {
      // net = GROSS everywhere (Soroban gas is paid in XLM, separately — variable per tx, displayed by the
      // wallet/explorer). Leg-1 gas is no longer deducted from the EURC result.
      const netEurc = leg2.netOut;
      if (netEurc > 0n) viaUsdc = { leg1, leg2, usdcMid: usdcReceived, netEurc, txCount: 2 };
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
  if (winner === 'via-usdc' && viaUsdcAdvantage !== undefined) {
    note = `via-USDC gagne (+${fromStroops(viaUsdcAdvantage)} EURC) mais 2 swaps (drift inter-tx possible).`;
  } else if (winner === 'direct') {
    note =
      viaNet !== undefined && directNet !== undefined && closeEnough(viaNet, directNet)
        ? 'via-USDC ≈ direct : pas de marche BLND/EURC independant (tout passe par USDC). 1 swap suffit.'
        : 'Direct gagne (1 seul swap).';
  }

  return { direct, viaUsdc, winner, bestNetEurc, viaUsdcAdvantage, note };
}
