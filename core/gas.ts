// Gas : marginal (ne decide quasi jamais). Estimation par defaut par type de route, convertie dans
// l'asset cible. Raffinable plus tard via simulateTransaction (Soroban minResourceFee) / 100 stroops x ops.
import type { Stroops } from './sources/types.js';
import { toNumber, toStroops } from './amount.js';

export type RouteKind = 'soroban' | 'classic';

/** Enveloppe XLM par defaut (stroops). Soroban ~0,045 XLM (~0,005 $) ; classique ~quelques centaines de stroops. */
export const DEFAULT_GAS_XLM: Record<RouteKind, Stroops> = {
  soroban: 450_000n,
  classic: 700n,
};

/** Convertit un cout gas en XLM vers l'asset cible. Rend 0 si un prix manque (gas tolere a zero). */
export function convertXlmToTarget(
  gasXlm: Stroops,
  xlmUsd: number | null,
  targetUsdUnit: number | null,
): Stroops {
  if (!xlmUsd || !targetUsdUnit || targetUsdUnit <= 0) return 0n;
  const gasUsd = toNumber(gasXlm) * xlmUsd;
  const targetUnits = gasUsd / targetUsdUnit;
  if (!Number.isFinite(targetUnits) || targetUnits <= 0) return 0n;
  return toStroops(targetUnits.toFixed(7));
}
