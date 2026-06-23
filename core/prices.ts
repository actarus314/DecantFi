// Prix spot pour l'impact de prix et la conversion du gas. Best-effort, tolerant aux pannes :
// chaque champ peut etre null ; l'impact n'est affiche que si le prix est disponible.
import type { Stroops } from './sources/types.js';
import { toNumber } from './amount.js';

export interface Prices {
  blndUsd: number | null;
  xlmUsd: number | null;
  /** USD par EURC (euro-coin, token Stellar/Base) — distinct du fiat EUR/USD. */
  eurcUsd: number | null;
  /** Mid du carnet EURC/USDC sur le SDEX Stellar (USDC par EURC). Best-effort, null si carnet vide/à sens unique/anomalie. */
  eurcStellarMid: number | null;
}

export type Fetcher = typeof fetch;

// DefiLlama agrege les prix CoinGecko en un appel keyless. eurcUsd = prix USD de l'EURC (euro-coin).
const LLAMA = 'https://coins.llama.fi/prices/current/coingecko:blend,coingecko:stellar,coingecko:euro-coin';

// Default Horizon base URL. Overridable via horizonUrl parameter (respects STELLAR_HORIZON_URL).
const DEFAULT_HORIZON = 'https://horizon.stellar.org';

// Build the EURC/USDC order-book URL from a given Horizon base URL.
function horizonOrderBookUrl(horizonBase: string): string {
  const base = horizonBase.replace(/\/$/, '');
  return base + '/order_book' +
    '?selling_asset_type=credit_alphanum4&selling_asset_code=EURC' +
    '&selling_asset_issuer=GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2' +
    '&buying_asset_type=credit_alphanum4&buying_asset_code=USDC' +
    '&buying_asset_issuer=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' +
    '&limit=1';
}

interface LlamaCoin {
  price?: number;
}
interface LlamaResponse {
  coins?: Record<string, LlamaCoin>;
}

interface OrderBookResponse {
  bids?: Array<{ price: string }>;
  asks?: Array<{ price: string }>;
}

/** Fetch le mid EURC/USDC du carnet SDEX Stellar. Best-effort : null si échec ou données invalides. */
export async function fetchEurcStellarMid(
  fetcher: Fetcher,
  timeoutMs: number,
  horizonUrl?: string,
): Promise<number | null> {
  try {
    const url = horizonOrderBookUrl(horizonUrl ?? DEFAULT_HORIZON);
    const res = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const ob = (await res.json()) as OrderBookResponse;
    const bidPrice = ob.bids?.[0]?.price;
    const askPrice = ob.asks?.[0]?.price;
    if (!bidPrice || !askPrice) return null;
    const bid = Number(bidPrice);
    const ask = Number(askPrice);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) return null;
    const mid = (bid + ask) / 2;
    // Anomalie : mid hors [0.5, 2.0] → suspect, on rejette
    if (mid < 0.5 || mid > 2.0) return null;
    return mid;
  } catch {
    return null;
  }
}

/** Recupere blndUsd, xlmUsd et eurcUsd en un appel DefiLlama + mid carnet Stellar. Best-effort, chaque champ peut etre null. */
export async function fetchPrices(opts: { fetcher?: Fetcher; timeoutMs?: number; horizonUrl?: string } = {}): Promise<Prices> {
  const fetcher = opts.fetcher ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const empty: Prices = { blndUsd: null, xlmUsd: null, eurcUsd: null, eurcStellarMid: null };
  try {
    const res = await fetcher(LLAMA, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return empty;
    const c = ((await res.json()) as LlamaResponse).coins ?? {};
    const llamaPrices = {
      blndUsd: num(c['coingecko:blend']?.price),
      xlmUsd: num(c['coingecko:stellar']?.price),
      eurcUsd: num(c['coingecko:euro-coin']?.price),
    };
    // Fetch mid carnet Stellar en parallèle (best-effort, try/catch séparé)
    const eurcStellarMid = await fetchEurcStellarMid(fetcher, timeoutMs, opts.horizonUrl).catch(() => null);
    return { ...llamaPrices, eurcStellarMid };
  } catch {
    return empty;
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** Prix EVM/global d'une unite de l'asset cible : USDC -> 1 ; EURC -> eurcUsd (prix CoinGecko/Circle). */
export function targetEvmPerUnit(targetSymbol: string, prices: Prices): number | null {
  if (targetSymbol === 'USDC') return 1;
  if (targetSymbol === 'EURC') return prices.eurcUsd;
  return null;
}

/** Prix local (SDEX Stellar) d'une unite de l'asset cible : USDC -> 1 ; EURC -> eurcStellarMid. */
export function targetLocalPerUnit(targetSymbol: string, prices: Prices): number | null {
  if (targetSymbol === 'USDC') return 1;
  if (targetSymbol === 'EURC') return prices.eurcStellarMid;
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
