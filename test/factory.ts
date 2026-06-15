// Fabrique de NormalizedQuote synthetiques pour les tests des modules purs (rank/split/eurc).
import type { NormalizedQuote, Stroops } from '../core/sources/types.js';
import type { Asset } from '../core/assets.js';
import { BLND, USDC } from '../core/assets.js';

export function quote(
  source: string,
  netOut: Stroops,
  extra: Partial<NormalizedQuote> = {},
): NormalizedQuote {
  const sellAsset: Asset = extra.sellAsset ?? BLND;
  const buyAsset: Asset = extra.buyAsset ?? USDC;
  return {
    source,
    sellAsset,
    buyAsset,
    amountIn: 10_000_000_000n,
    grossOut: netOut,
    feeBreakdown: [],
    gasXlm: 0n,
    gasInTarget: 0n,
    netOut,
    netConfidence: 'exact',
    route: [],
    raw: null,
    ...extra,
  };
}
