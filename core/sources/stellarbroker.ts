// StellarBroker : matcher classique + Soroban. GET api.stellar.broker/quote (CODE-ISSUER, montant humain).
// estimatedBuyingAmount est PRE-fee (vfee+ffee opaques) ; directTrade.buying est le PLANCHER fiable.
// Regle design : classe sur le plancher, expose la fourchette [plancher, pre-fee]. netConfidence: floor.
import type { SourceAdapter, NormalizedQuote, QuoteRequest } from './types.js';
import type { Asset } from '../assets.js';
import { classicDash } from '../assets.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { fromStroops } from '../amount.js';
import { getJson } from './http.js';
import { stroopsOrNull, hops } from './util.js';

interface StellarBrokerRaw {
  status?: string;
  directTrade?: { buying?: string; path?: string[] };
  estimatedBuyingAmount?: string;
}

/** StellarBroker veut le natif comme litteral 'XLM' (et non 'native'). */
function dash(a: Asset): string {
  return a.native ? 'XLM' : classicDash(a);
}

export function parseStellarbroker(raw: unknown, req: QuoteRequest): NormalizedQuote | null {
  const j = raw as StellarBrokerRaw | null;
  if (!j || j.status !== 'success') return null;

  const floor = stroopsOrNull(j.directTrade?.buying);
  if (floor === null || floor <= 0n) return null;

  let high = floor;
  const pre = stroopsOrNull(j.estimatedBuyingAmount);
  if (pre !== null && pre > high) high = pre;

  const pathSyms = (j.directTrade?.path ?? []).map((p) => String(p).split('-')[0] ?? '?');
  const route = hops('stellarbroker', [req.sellAsset.symbol, ...pathSyms, req.buyAsset.symbol]);

  return {
    source: 'stellarbroker',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut: floor,
    feeBreakdown: [{ kind: 'aggregator', note: 'vfee+ffee opaque ; net reel entre plancher et pre-fee' }],
    gasXlm: DEFAULT_GAS_XLM.classic,
    gasInTarget: 0n,
    netOut: floor,
    netConfidence: 'floor',
    netRange: { low: floor, high },
    route,
    raw,
  };
}

export const stellarbroker: SourceAdapter = {
  id: 'stellarbroker',
  available: () => true,
  async quote(req, cfg) {
    const sp = new URLSearchParams({
      sellingAsset: dash(req.sellAsset),
      buyingAsset: dash(req.buyAsset),
      sellingAmount: fromStroops(req.amountIn),
      slippageTolerance: (req.slippageBps / 10000).toString(),
    });
    return parseStellarbroker(await getJson(`https://api.stellar.broker/quote?${sp.toString()}`, cfg.timeoutMs), req);
  },
};
