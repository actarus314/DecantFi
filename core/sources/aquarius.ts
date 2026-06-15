// Aquarius : pools Soroban natifs. POST amm-api.aqua.network find-path (SAC C..., montant en stroops).
// Reponse: amount_with_fee = NET du pool (fallback amount) ; tokens[] decrit la route (souvent via sUSD).
import type { SourceAdapter, NormalizedQuote, QuoteRequest } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { postJson } from './http.js';
import { bigintOrNull, hops } from './util.js';

interface AquariusRaw {
  success?: boolean;
  amount?: string | number;
  amount_with_fee?: string | number;
  tokens?: string[];
  pools?: string[];
}

export function parseAquarius(raw: unknown, req: QuoteRequest): NormalizedQuote | null {
  const j = raw as AquariusRaw | null;
  if (!j || j.success === false) return null;
  const grossOut = bigintOrNull(j.amount_with_fee ?? j.amount);
  if (grossOut === null || grossOut <= 0n) return null;

  const syms = (j.tokens ?? []).map((t) => t.split(':')[0] ?? t);
  const route =
    syms.length >= 2
      ? hops('aqua', syms)
      : [{ venue: 'aqua', sell: req.sellAsset.symbol, buy: req.buyAsset.symbol }];

  return {
    source: 'aquarius',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut,
    feeBreakdown: [],
    gasXlm: DEFAULT_GAS_XLM.soroban,
    gasInTarget: 0n,
    netOut: grossOut,
    netConfidence: 'exact',
    route,
    raw,
  };
}

export const aquarius: SourceAdapter = {
  id: 'aquarius',
  available: () => true,
  async quote(req, cfg) {
    const body = {
      token_in_address: req.sellAsset.sac,
      token_out_address: req.buyAsset.sac,
      amount: req.amountIn.toString(),
    };
    const raw = await postJson(
      'https://amm-api.aqua.network/api/external/v1/find-path/',
      body,
      cfg.timeoutMs,
    );
    return parseAquarius(raw, req);
  },
};
