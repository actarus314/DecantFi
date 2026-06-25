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
  stellarBrokerApiKey?: string;
  rpcUrl: string;
  horizonUrl: string;
  walletAddress?: string;
  /** Timeout reseau par source (ms). */
  timeoutMs?: number;
  /**
   * Cache de lectures RPC partagé sur la durée d'UNE opération logique (un tick = ses 4 sondes,
   * ou une requête web). Coalesce les lectures de pools identiques entre sondes/sous-cotations
   * (les sondes EURC relancent 3 sous-cotations qui re-lisent les mêmes pools) → évite la rafale
   * qui sature le RPC public (429). Clé = `${contract}:${method}:${args}`. Absent = pas de cache.
   */
  rpcCache?: Map<string, Promise<unknown>>;
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
  /** Gas estimé converti dans l'asset cible (buyAsset), en stroops. INFORMATIF : plus déduit du net
   *  (le gas Soroban est payé en XLM, à part, variable par tx — affiché séparément par wallet/explorer). */
  gasInTarget: Stroops;
  /** = grossOut : montant cible reçu, comparable entre sources. Le gas n'est PAS déduit (payé en XLM). */
  netOut: Stroops;
  netConfidence: NetConfidence;
  /** Fourchette quand netOut est incertain (ex. StellarBroker : [plancher directTrade, pre-fee]). */
  netRange?: { low: Stroops; high: Stroops };
  route: RouteHop[];
  /** Ecart du prix effectif (netOut/amountIn) vs spot EVM/global, en %. */
  priceImpactPct?: number;
  /** Ecart du prix effectif vs spot local (carnet SDEX Stellar). null/undefined si mid indisponible. */
  priceImpactLocalPct?: number;
  /** Reponse brute de la source (debug / fixtures). */
  raw: unknown;
  /** Durée totale de cotation pour cette source (ms) : fetch API + re-simulation incluse le cas échéant.
   *  Alimenté par engine (fetch) + quote-api/tick (re-sim). Optionnel : absent = non mesuré. */
  durationMs?: number;
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
