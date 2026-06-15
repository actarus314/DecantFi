// xBull : routeur Soroban. GET swap-api.xbull.io/swaps/quote (SAC C..., montant en stroops).
// Reponse: toAmount = NET (fee 0,1 % incluse), fee.platformFee en stroops cible. netConfidence: exact.
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
