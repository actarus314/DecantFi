// Construit la liste des sondes : produit cartésien {tailles} × {paires cibles}.
import { USDC, EURC, type Asset } from '../core/assets.js';
import type { CollectorConfig } from './config.js';

export interface Probe { pair: string; buy: Asset; amountIn: bigint; }

const TARGETS: Record<'USDC' | 'EURC', Asset> = { USDC, EURC };

export function buildProbes(cfg: Pick<CollectorConfig, 'sizesBlnd' | 'pairs'>): Probe[] {
  const probes: Probe[] = [];
  for (const amountIn of cfg.sizesBlnd)
    for (const sym of cfg.pairs)
      probes.push({ pair: `BLND->${sym}`, buy: TARGETS[sym], amountIn });
  return probes;
}
