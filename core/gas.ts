// Gas: marginal (almost never decisive). Default estimate per route type, converted into
// the target asset. Can be refined later via simulateTransaction (Soroban minResourceFee) / 100 stroops x ops.
import type { Stroops } from './sources/types.js';
import { toNumber, toStroops } from './amount.js';

export type RouteKind = 'soroban' | 'classic';

/** Default XLM envelope (stroops). Soroban ~0.045 XLM (~$0.005); classic ~a few hundred stroops. */
export const DEFAULT_GAS_XLM: Record<RouteKind, Stroops> = {
  soroban: 450_000n,
  classic: 700n,
};

/** Converts an XLM gas cost to the target asset. Returns 0 if a price is missing (gas tolerated as zero). */
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
