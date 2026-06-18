// xBull : routeur Soroban. Cotation via l'endpoint exécutable (vérité actuelle).
//
// Migration d'endpoint en cours :
//   .app = https://swap.apis.xbull.app/swaps/quote  → param fromAmount= + maxSteps=3
//          ↑ VÉRITÉ ACTUELLE (net exécutable, corroboré par 5 autres venues)
//          Utilisé en DÉFAUT.
//   .io  = https://swap-api.xbull.io/swaps/quote    → param amount= (sans maxSteps)
//          ↑ FUTUR endpoint canonique xBull (migration en cours) MAIS renvoie
//          actuellement un net gonflé ~8-9 % NON-EXÉCUTABLE (mesuré live 2026-06-18).
//          Réactiver quand le monitoring externe confirme la parité avec .app.
//
// Flip = changer XBULL_QUOTE = XBULL_QUOTE_VARIANTS.app → ...io (+ amountParam + extra suivent).
//
// Shape de réponse .app (vérifiée) :
//   { route, fromAmount, fromAsset, toAsset, toAmount, fee }  — fee = string ratio ("0.001" = 0,1%)
// Shape de réponse .io (ancienne, fixture capturée) :
//   { route, fromAmount, toAmount, fromAsset, toAsset, fee: { platformFee, referralsFee } }
//
// parseXbull est tolérant aux deux shapes.
// netOut/grossOut = toAmount dans tous les cas. netConfidence = 'exact'.
// Le détail du fee est cosmétique : si non dérivable, feeBreakdown vide (ne plante pas).
import type { SourceAdapter, NormalizedQuote, QuoteRequest, FeeItem } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { getJson } from './http.js';

// ─── Config endpoint (deux variantes) ────────────────────────────────────────

const XBULL_QUOTE_VARIANTS = {
  /** Endpoint d'exécution xBull — vérité actuelle (net exécutable). Défaut. */
  app: {
    base: 'https://swap.apis.xbull.app/swaps/quote',
    amountParam: 'fromAmount',
    extra: '&maxSteps=3',
  },
  /** Futur endpoint canonique xBull — actuellement gonflé ~8-9 % (NON-EXÉCUTABLE).
   *  Réactiver ici quand monitoring externe confirme parité avec .app. */
  io: {
    base: 'https://swap-api.xbull.io/swaps/quote',
    amountParam: 'amount',
    extra: '',
  },
} as const;

/** Endpoint actif pour la cotation xBull. Flip = changer .app → .io. */
const XBULL_QUOTE = XBULL_QUOTE_VARIANTS.app;

// ─── Types ────────────────────────────────────────────────────────────────────

interface XbullRaw {
  toAmount?: string | number;
  route?: string;
  /** .io shape : objet fee */
  fee?: { platformFee?: string | number; referralsFee?: string | number } | string;
}

function bigintOrNull(v: unknown): bigint | null {
  if (v == null) return null;
  try {
    return BigInt(v as string | number);
  } catch {
    return null;
  }
}

// ─── Parser (tolérant aux deux shapes fee) ────────────────────────────────────

export function parseXbull(raw: unknown, req: QuoteRequest): NormalizedQuote | null {
  const j = raw as XbullRaw | null;
  const grossOut = bigintOrNull(j?.toAmount);
  if (grossOut === null || grossOut <= 0n) return null;

  const feeBreakdown: FeeItem[] = [];
  const feeField = j?.fee;
  if (feeField != null && typeof feeField === 'object') {
    // Shape .io : fee = { platformFee, referralsFee }
    const platformFee = bigintOrNull(feeField.platformFee);
    if (platformFee !== null && platformFee > 0n) {
      feeBreakdown.push({ kind: 'aggregator', amount: platformFee, asset: req.buyAsset.symbol, note: 'platformFee' });
    }
  }
  // Shape .app : fee = string ratio ("0.001") → cosmétique, non dérivable en stroops sans float → skip.

  return {
    source: 'xbull',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut,
    feeBreakdown,
    gasXlm: DEFAULT_GAS_XLM.soroban,
    gasInTarget: 0n,
    netOut: grossOut,
    netConfidence: 'exact',
    route: [{ venue: 'xbull', sell: req.sellAsset.symbol, buy: req.buyAsset.symbol }],
    raw,
  };
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export const xbull: SourceAdapter = {
  id: 'xbull',
  available: () => true,
  async quote(req, cfg) {
    const url =
      `${XBULL_QUOTE.base}?fromAsset=${req.sellAsset.sac}` +
      `&toAsset=${req.buyAsset.sac}&${XBULL_QUOTE.amountParam}=${req.amountIn.toString()}${XBULL_QUOTE.extra}`;
    return parseXbull(await getJson(url, cfg.timeoutMs), req);
  },
};
