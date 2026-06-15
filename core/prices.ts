// Prix spot pour l'impact de prix et la conversion du gas. Best-effort, tolerant aux pannes :
// chaque champ peut etre null ; l'impact n'est affiche que si le prix est disponible.
import type { Stroops } from './sources/types.js';
import { toNumber } from './amount.js';

export interface Prices {
  blndUsd: number | null;
  xlmUsd: number | null;
  /** USD par EUR (pour valoriser EURC). */
  eurUsd: number | null;
}

export type Fetcher = typeof fetch;

// DefiLlama agrege les prix CoinGecko en un appel keyless. eurUsd = prix USD de l'EURC (~= EUR/USD).
const LLAMA = 'https://coins.llama.fi/prices/current/coingecko:blend,coingecko:stellar,coingecko:euro-coin';

interface LlamaCoin {
  price?: number;
}
interface LlamaResponse {
  coins?: Record<string, LlamaCoin>;
}

/** Recupere blndUsd, xlmUsd et eurUsd en un appel DefiLlama. Best-effort, chaque champ peut etre null. */
export async function fetchPrices(opts: { fetcher?: Fetcher; timeoutMs?: number } = {}): Promise<Prices> {
  const fetcher = opts.fetcher ?? fetch;
  const empty: Prices = { blndUsd: null, xlmUsd: null, eurUsd: null };
  try {
    const res = await fetcher(LLAMA, { signal: AbortSignal.timeout(opts.timeoutMs ?? 8000) });
    if (!res.ok) return empty;
    const c = ((await res.json()) as LlamaResponse).coins ?? {};
    return {
      blndUsd: num(c['coingecko:blend']?.price),
      xlmUsd: num(c['coingecko:stellar']?.price),
      eurUsd: num(c['coingecko:euro-coin']?.price),
    };
  } catch {
    return empty;
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** Prix USD d'une unite de l'asset cible : USDC -> 1 ; EURC -> eurUsd. */
export function targetUsdPerUnit(targetSymbol: string, prices: Prices): number | null {
  if (targetSymbol === 'USDC') return 1;
  if (targetSymbol === 'EURC') return prices.eurUsd;
  return null;
}

/**
 * Impact de prix en % : part de la valeur (USD) perdue vs spot.
 * positif = on recoit moins que la valeur spot du BLND vendu.
 */
export function priceImpactPct(
  amountInBlnd: Stroops,
  netOutTarget: Stroops,
  blndUsd: number | null,
  targetUsdUnit: number | null,
): number | undefined {
  if (!blndUsd || !targetUsdUnit) return undefined;
  const inUsd = toNumber(amountInBlnd) * blndUsd;
  const outUsd = toNumber(netOutTarget) * targetUsdUnit;
  if (inUsd <= 0) return undefined;
  return ((inUsd - outUsd) / inUsd) * 100;
}
