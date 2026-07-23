// Common contract for all source adapters.
// Loaded by engine / normalize / rank / split / eurc. Stable: every source conforms to it.

import type { Asset } from '../assets.js';

/** Amounts in "stroops": integer = 10^-7 unit. All Stellar assets involved have 7 decimals. */
export type Stroops = bigint;

export const DECIMALS = 7;
/** 1.0 expressed in stroops. */
export const ONE_UNIT: Stroops = 10_000_000n;

export interface QuoteRequest {
  sellAsset: Asset;
  buyAsset: Asset;
  /** Amount to sell, in stroops of sellAsset. */
  amountIn: Stroops;
  /** Slippage tolerance in basis points (50 = 0.5%). */
  slippageBps: number;
}

export interface SourceConfig {
  soroswapApiKey?: string;
  stellarBrokerApiKey?: string;
  rpcUrl: string;
  horizonUrl: string;
  walletAddress?: string;
  /** Per-source network timeout (ms). */
  timeoutMs?: number;
  /**
   * RPC read cache shared for the duration of ONE logical operation (a tick = its 4 probes,
   * or a web request). Coalesces identical pool reads across probes/sub-quotes
   * (EURC probes re-trigger 3 sub-quotes that re-read the same pools) → avoids the burst
   * that saturates the public RPC (429). Key = `${contract}:${method}:${args}`. Absent = no cache.
   */
  rpcCache?: Map<string, Promise<unknown>>;
}

export type NetConfidence = 'exact' | 'floor' | 'estimate';

export interface FeeItem {
  kind: 'aggregator' | 'pool' | 'network' | 'unknown';
  bps?: number;
  /** Fee amount, in stroops of `asset`. */
  amount?: Stroops;
  /** Symbol of the fee asset. */
  asset?: string;
  note?: string;
}

export interface RouteHop {
  /** 'soroswap' | 'phoenix' | 'aqua' | 'sdex' | 'comet' | 'stellarbroker' | ... */
  venue: string;
  /** Symbol sold on this hop. */
  sell: string;
  /** Symbol bought on this hop. */
  buy: string;
}

/**
 * Normalized quote, strictly comparable on `netOut`.
 * `netOut` = target amount actually received, net of ALL fees (aggregator + pools), minus converted gas.
 */
export interface NormalizedQuote {
  /** Source adapter id (e.g. 'xbull'). */
  source: string;
  sellAsset: Asset;
  buyAsset: Asset;
  amountIn: Stroops;
  /** Gross output before gas deduction (aggregator/pool fees already deducted if the source includes them). */
  grossOut: Stroops;
  feeBreakdown: FeeItem[];
  /** Estimated network cost, in stroops XLM. */
  gasXlm: Stroops;
  /** Estimated gas converted into the target asset (buyAsset), in stroops. INFORMATIONAL: not deducted from net
   *  (Soroban gas is paid in XLM, separately, variable per tx — shown separately by wallet/explorer). */
  gasInTarget: Stroops;
  /** = grossOut: target amount received, comparable across sources. Gas is NOT deducted (paid in XLM). */
  netOut: Stroops;
  netConfidence: NetConfidence;
  /** Range when netOut is uncertain (e.g. StellarBroker: [directTrade floor, pre-fee]). */
  netRange?: { low: Stroops; high: Stroops };
  route: RouteHop[];
  /** Deviation of the effective price (netOut/amountIn) vs EVM/global spot, in %. */
  priceImpactPct?: number;
  /** Deviation of the effective price vs local spot (Stellar SDEX order book). null/undefined if mid is unavailable. */
  priceImpactLocalPct?: number;
  /** Raw response from the source (debug / fixtures). */
  raw: unknown;
  /** Total quoting duration for this source (ms): fetch API + re-simulation when applicable.
   *  Populated by engine (fetch) + quote-api/tick (re-sim). Optional: absent = not measured. */
  durationMs?: number;
}

export interface SourceAdapter {
  /** Stable identifier (used as fixture key and for display). */
  id: string;
  /** false => not queried in this context (e.g. Soroswap without a key or local SDK). */
  available(cfg: SourceConfig): boolean;
  /** Optional: false => the source does NOT cover this pair (e.g. Comet outside BLND/USDC). */
  supports?(req: QuoteRequest): boolean;
  /** null = source unavailable (timeout / 429 / no route): ranking continues without it. */
  quote(req: QuoteRequest, cfg: SourceConfig): Promise<NormalizedQuote | null>;
}
