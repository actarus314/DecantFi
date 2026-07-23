// xBull: Soroban router. Quoted via the executable endpoint (current source of truth).
//
// Endpoint migration in progress:
//   .app = https://swap.apis.xbull.app/swaps/quote  → param fromAmount= + maxSteps=3
//          ↑ CURRENT SOURCE OF TRUTH (executable net, corroborated by 5 other venues)
//          Used by DEFAULT.
//   .io  = https://swap-api.xbull.io/swaps/quote    → param amount= (no maxSteps)
//          ↑ FUTURE canonical xBull endpoint (migration in progress) BUT currently
//          returns an inflated net ~8-9% NON-EXECUTABLE.
//          Re-enable once external monitoring confirms parity with .app.
//
// Flip = change XBULL_QUOTE = XBULL_QUOTE_VARIANTS.app → ...io (+ amountParam + extra follow).
//
// .app response shape (verified):
//   { route, fromAmount, fromAsset, toAsset, toAmount, fee }  — fee = string ratio ("0.001" = 0.1%)
// .io response shape (old, captured fixture):
//   { route, fromAmount, toAmount, fromAsset, toAsset, fee: { platformFee, referralsFee } }
//
// parseXbull tolerates both shapes.
// netOut/grossOut = toAmount in all cases. netConfidence = 'exact'.
// Fee detail is cosmetic: if not derivable, feeBreakdown is empty (doesn't fail).
import type { SourceAdapter, NormalizedQuote, QuoteRequest, FeeItem } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { getJson } from './http.js';

// ─── Config endpoint (deux variantes) ────────────────────────────────────────

const XBULL_QUOTE_VARIANTS = {
  /** xBull execution endpoint — current source of truth (executable net). Default. */
  app: {
    base: 'https://swap.apis.xbull.app/swaps/quote',
    amountParam: 'fromAmount',
    extra: '&maxSteps=3',
  },
  /** Future canonical xBull endpoint — currently inflated ~8-9% (NON-EXECUTABLE).
   *  Re-enable here once external monitoring confirms parity with .app. */
  io: {
    base: 'https://swap-api.xbull.io/swaps/quote',
    amountParam: 'amount',
    extra: '',
  },
} as const;

/** Active endpoint for xBull quoting. Flip = change .app → .io. */
const XBULL_QUOTE = XBULL_QUOTE_VARIANTS.app;

// ─── Types ────────────────────────────────────────────────────────────────────

interface XbullRaw {
  toAmount?: string | number;
  route?: string;
  /** .io shape: fee object */
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

// ─── Parser (tolerant to both fee shapes) ─────────────────────────────────────

export function parseXbull(raw: unknown, req: QuoteRequest): NormalizedQuote | null {
  const j = raw as XbullRaw | null;
  const grossOut = bigintOrNull(j?.toAmount);
  if (grossOut === null || grossOut <= 0n) return null;

  const feeBreakdown: FeeItem[] = [];
  const feeField = j?.fee;
  if (feeField != null && typeof feeField === 'object') {
    // .io shape: fee = { platformFee, referralsFee }
    const platformFee = bigintOrNull(feeField.platformFee);
    if (platformFee !== null && platformFee > 0n) {
      feeBreakdown.push({ kind: 'aggregator', amount: platformFee, asset: req.buyAsset.symbol, note: 'platformFee' });
    }
  }
  // .app shape: fee = string ratio ("0.001") → cosmetic, not derivable in stroops without float → skip.

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
