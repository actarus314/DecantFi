// xBull : routeur Soroban. GET swap-api.xbull.io/swaps/quote (SAC C..., montant en stroops).
// Reponse: toAmount = NET (fee 0,1 % incluse), fee.platformFee en stroops cible. netConfidence: exact.
// Route OPAQUE : l'API ne renvoie que `route` (ID/UUID interne), JAMAIS le chemin. Verifie 2026-06-16 sur la
// spec officielle swap.apis.xbull.app/public-api.yaml : QuoteSwapResponseDto = route + amounts + fee (aucun
// champ hops) ; accept-quote ne rend qu'un XDR (appel de contrat router par ID) et exige un `sender`.
// => impossible de deplier la route cote lecture ; l'UI affiche l'ellipse BLND->...->cible.
import type { SourceAdapter, NormalizedQuote, QuoteRequest, FeeItem } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { getJson } from './http.js';

interface XbullRaw {
  toAmount?: string | number;
  route?: string;
  fee?: { platformFee?: string | number; referralsFee?: string | number };
}

function bigintOrNull(v: unknown): bigint | null {
  if (v == null) return null;
  try {
    return BigInt(v as string | number);
  } catch {
    return null;
  }
}

export function parseXbull(raw: unknown, req: QuoteRequest): NormalizedQuote | null {
  const j = raw as XbullRaw | null;
  const grossOut = bigintOrNull(j?.toAmount);
  if (grossOut === null || grossOut <= 0n) return null;

  const feeBreakdown: FeeItem[] = [];
  const platformFee = bigintOrNull(j?.fee?.platformFee);
  if (platformFee !== null && platformFee > 0n) {
    feeBreakdown.push({ kind: 'aggregator', amount: platformFee, asset: req.buyAsset.symbol, note: 'platformFee' });
  }

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

export const xbull: SourceAdapter = {
  id: 'xbull',
  available: () => true,
  async quote(req, cfg) {
    const url =
      `https://swap-api.xbull.io/swaps/quote?fromAsset=${req.sellAsset.sac}` +
      `&toAsset=${req.buyAsset.sac}&amount=${req.amountIn.toString()}`;
    return parseXbull(await getJson(url, cfg.timeoutMs), req);
  },
};
