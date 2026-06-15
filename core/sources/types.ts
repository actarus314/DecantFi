// Contrat commun a tous les adapters de source.
// Charge par engine / normalize / rank / split / eurc. Stable : toute source s'y conforme.

import type { Asset } from '../assets.js';

/** Montants en "stroops" : entier = 10^-7 unite. Toutes les assets Stellar concernees ont 7 decimales. */
export type Stroops = bigint;

export const DECIMALS = 7;
/** 1.0 exprime en stroops. */
export const ONE_UNIT: Stroops = 10_000_000n;

export interface QuoteRequest {
  sellAsset: Asset;
  buyAsset: Asset;
  /** Montant a vendre, en stroops de sellAsset. */
  amountIn: Stroops;
  /** Tolerance de slippage en points de base (50 = 0,5 %). */
  slippageBps: number;
}

export interface SourceConfig {
  soroswapApiKey?: string;
  rpcUrl: string;
  horizonUrl: string;
  walletAddress?: string;
  /** Timeout reseau par source (ms). */
  timeoutMs?: number;
}

export type NetConfidence = 'exact' | 'floor' | 'estimate';

export interface FeeItem {
  kind: 'aggregator' | 'pool' | 'network' | 'unknown';
  bps?: number;
  /** Montant du frais, en stroops de `asset`. */
  amount?: Stroops;
  /** Symbole de l'asset du frais. */
  asset?: string;
  note?: string;
}

export interface RouteHop {
  /** 'soroswap' | 'phoenix' | 'aqua' | 'sdex' | 'comet' | 'stellarbroker' | ... */
  venue: string;
  /** Symbole vendu sur ce hop. */
  sell: string;
  /** Symbole achete sur ce hop. */
  buy: string;
}

/**
 * Cotation normalisee, comparable strictement sur `netOut`.
 * `netOut` = montant cible reellement recu, net de TOUS frais (agregateur + pools), moins le gas converti.
 */
export interface NormalizedQuote {
  /** Id de l'adapter source (ex. 'xbull'). */
  source: string;
  sellAsset: Asset;
  buyAsset: Asset;
  amountIn: Stroops;
  /** Sortie brute avant deduction du gas (frais agregateur/pool deja deduits si la source les inclut). */
  grossOut: Stroops;
  feeBreakdown: FeeItem[];
  /** Cout reseau estime, en stroops XLM. */
  gasXlm: Stroops;
  /** Gas converti dans l'asset cible (buyAsset), en stroops. */
  gasInTarget: Stroops;
  /** grossOut - gasInTarget : LE montant comparable entre sources. */
  netOut: Stroops;
  netConfidence: NetConfidence;
  /** Fourchette quand netOut est incertain (ex. StellarBroker : [plancher directTrade, pre-fee]). */
  netRange?: { low: Stroops; high: Stroops };
  route: RouteHop[];
  /** Ecart du prix effectif (netOut/amountIn) vs spot, en %. */
  priceImpactPct?: number;
  /** Reponse brute de la source (debug / fixtures). */
  raw: unknown;
}

export interface SourceAdapter {
  /** Identifiant stable (sert de cle de fixture et d'affichage). */
  id: string;
  /** false => non interrogee dans ce contexte (ex. Soroswap sans cle ni SDK local). */
  available(cfg: SourceConfig): boolean;
  /** Optionnel : false => la source ne couvre PAS cette paire (ex. Comet hors BLND/USDC). */
  supports?(req: QuoteRequest): boolean;
  /** null = source indisponible (timeout / 429 / route absente) : le classement continue sans elle. */
  quote(req: QuoteRequest, cfg: SourceConfig): Promise<NormalizedQuote | null>;
}
