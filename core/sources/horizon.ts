// Horizon : plancher de reference (SDEX + LP classiques). GET /paths/strict-send.
// source_amount en unites HUMAINES ; destination_assets = CODE:ISSUER. Meilleur = max destination_amount.
import type { SourceAdapter, NormalizedQuote, QuoteRequest } from './types.js';
import type { Asset } from '../assets.js';
import { classicColon } from '../assets.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { fromStroops } from '../amount.js';
import { getJson } from './http.js';
import { stroopsOrNull, hops } from './util.js';

interface HorizonRecord {
  destination_amount?: string;
  path?: Array<{ asset_type?: string; asset_code?: string; asset_issuer?: string }>;
}
interface HorizonRaw {
  _embedded?: { records?: HorizonRecord[] };
}

function sourceParams(a: Asset): Record<string, string> {
  if (a.native) return { source_asset_type: 'native' };
  return {
    source_asset_type: a.code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
    source_asset_code: a.code,
    source_asset_issuer: a.issuer as string,
  };
}

export function parseHorizon(raw: unknown, req: QuoteRequest): NormalizedQuote | null {
  const records = (raw as HorizonRaw | null)?._embedded?.records;
  if (!Array.isArray(records) || records.length === 0) return null;

  let best: HorizonRecord | null = null;
  let bestNum = -1;
  for (const r of records) {
    const n = Number(r?.destination_amount);
    if (Number.isFinite(n) && n > bestNum) {
      best = r;
      bestNum = n;
    }
  }
  const grossOut = stroopsOrNull(best?.destination_amount);
  if (grossOut === null || grossOut <= 0n) return null;

  const pathSyms = (best?.path ?? []).map((p) => (p?.asset_type === 'native' ? 'XLM' : p?.asset_code ?? '?'));
  const route = hops('horizon', [req.sellAsset.symbol, ...pathSyms, req.buyAsset.symbol]);

  return {
    source: 'horizon',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut,
    feeBreakdown: [],
    gasXlm: DEFAULT_GAS_XLM.classic,
    gasInTarget: 0n,
    netOut: grossOut,
    netConfidence: 'exact',
    route,
    raw,
  };
}

export const horizon: SourceAdapter = {
  id: 'horizon',
  available: () => true,
  async quote(req, cfg) {
    const base = (cfg.horizonUrl || 'https://horizon.stellar.org').replace(/\/$/, '');
    const sp = new URLSearchParams({
      ...sourceParams(req.sellAsset),
      source_amount: fromStroops(req.amountIn),
      destination_assets: classicColon(req.buyAsset),
    });
    return parseHorizon(await getJson(`${base}/paths/strict-send?${sp.toString()}`, cfg.timeoutMs), req);
  },
};
