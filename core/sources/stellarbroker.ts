// StellarBroker: WS-authenticated quote source (key required).
// URL: wss://api.stellar.broker/ws?partner=<key>
// Flow: open → server sends {type:'connected'} → client sends quote request → server replies {type:'quote', quote:{...QuoteResult...}}
// Classified on the ESTIMATE (estimatedBuyingAmount); floor (directTrade.buying) stored in netRange.low and threaded to UI.
// Non-executable: comparison only (no integrated execution). Re-add to ADAPTERS once live-validated with the key.
// NOTE: the API key is WS-only; the REST endpoint is Cloudflare-rate-limited and ignores the key.
// netConfidence stays 'estimate'/'floor'; 'exact' (Observed chip) would require executing via SB's own router (Option B, deferred).
import type { SourceAdapter, NormalizedQuote, QuoteRequest } from './types.js';
import type { Asset } from '../assets.js';
import { classicDash } from '../assets.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { fromStroops } from '../amount.js';
import { stroopsOrNull, hops } from './util.js';

interface StellarBrokerRaw {
  status?: string;
  directTrade?: { buying?: string; path?: string[] };
  estimatedBuyingAmount?: string;
}

/** StellarBroker expects native as literal 'XLM' (not 'native'). */
function dash(a: Asset): string {
  return a.native ? 'XLM' : classicDash(a);
}

/**
 * Parse a QuoteResult (already unwrapped from msg.quote by the WS transport).
 * Classifies on the estimate (estimatedBuyingAmount); floor (directTrade.buying) in netRange.low.
 */
export function parseStellarbroker(raw: unknown, req: QuoteRequest): NormalizedQuote | null {
  const j = raw as StellarBrokerRaw | null;
  if (!j || j.status !== 'success') return null;

  const floor = stroopsOrNull(j.directTrade?.buying);
  const est = stroopsOrNull(j.estimatedBuyingAmount);

  let netOut: bigint;
  let netConfidence: NormalizedQuote['netConfidence'];
  let netRange: { low: bigint; high: bigint };

  if (est !== null && est > 0n) {
    netOut = est;
    netConfidence = 'estimate';
    netRange = { low: floor !== null && floor > 0n ? floor : est, high: est };
  } else if (floor !== null && floor > 0n) {
    netOut = floor;
    netConfidence = 'floor';
    netRange = { low: floor, high: floor };
  } else {
    return null;
  }

  const pathSyms = (j.directTrade?.path ?? []).map((p) => String(p).split('-')[0] ?? '?');
  const route = hops('stellarbroker', [req.sellAsset.symbol, ...pathSyms, req.buyAsset.symbol]);

  return {
    source: 'stellarbroker',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut: netOut,
    feeBreakdown: [{ kind: 'aggregator', note: 'opaque, deducted on-chain at execution; estimate reachable only via StellarBroker execution' }],
    gasXlm: DEFAULT_GAS_XLM.classic,
    gasInTarget: 0n,
    netOut,
    netConfidence,
    netRange,
    route,
    raw,
  };
}

// ─── WebSocket transport ──────────────────────────────────────────────────────

/** Injection seam: override the WebSocket constructor in tests to avoid real network calls.
 *  Mirror of ExecDeps pattern used in execute.ts. Pass via cfg.wsConstructor or StellarBrokerDeps. */
export interface StellarBrokerDeps {
  WebSocketConstructor?: typeof WebSocket;
}

export const stellarbroker: SourceAdapter & { deps?: StellarBrokerDeps } = {
  id: 'stellarbroker',
  deps: undefined,
  available: (cfg) => !!cfg.stellarBrokerApiKey,
  async quote(req, cfg) {
    const key = cfg.stellarBrokerApiKey;
    if (!key) return null;

    const url = `wss://api.stellar.broker/ws?partner=${encodeURIComponent(key)}`;
    const timeoutMs = cfg.timeoutMs ?? 10000;

    // Use injected constructor (for tests) or the global WebSocket (Node 26+)
    const WS = (stellarbroker.deps?.WebSocketConstructor) ?? (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket;
    if (!WS) return null;

    return new Promise<NormalizedQuote | null>((resolve) => {
      let done = false;
      let connectedReceived = false;
      let quoteSent = false;

      const finish = (result: NormalizedQuote | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { ws.close(); } catch { /* ignore */ }
        resolve(result);
      };

      const sendQuote = () => {
        if (quoteSent) return;
        quoteSent = true;
        ws.send(JSON.stringify({
          type: 'quote',
          sellingAsset: dash(req.sellAsset),
          buyingAsset: dash(req.buyAsset),
          sellingAmount: fromStroops(req.amountIn),
          slippageTolerance: req.slippageBps / 10000,
        }));
      };

      const timer = setTimeout(() => finish(null), timeoutMs);

      let ws: WebSocket;
      try {
        ws = new WS(url);
      } catch {
        clearTimeout(timer);
        resolve(null);
        return;
      }

      ws.onopen = () => {
        // Fallback: if 'connected' was not received before open fires (shouldn't happen but defensive)
        // We send on 'connected' message instead; this is just a safety net via a short delay.
        setTimeout(() => {
          if (!done && !quoteSent && ws.readyState === 1 /* OPEN */) {
            sendQuote();
          }
        }, 1500);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (done) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const type = msg['type'];
        if (type === 'connected') {
          connectedReceived = true;
          sendQuote();
        } else if (type === 'ping') {
          // Respond to heartbeat (defensive; quote usually arrives before any ping in lazy open-close)
          try { ws.send(JSON.stringify({ type: 'pong', uid: msg['uid'] })); } catch { /* ignore */ }
        } else if (type === 'quote') {
          // The QuoteResult is nested under msg.quote
          const quoteResult = msg['quote'];
          if (!quoteResult) { finish(null); return; }
          const quoteRaw = quoteResult as StellarBrokerRaw;
          if (quoteRaw.status !== 'success') { finish(null); return; }
          finish(parseStellarbroker(quoteRaw, req));
        }
      };

      ws.onerror = () => finish(null);
      ws.onclose = () => {
        if (!done) finish(null);
      };

      // Suppress unused variable warning for connectedReceived
      void connectedReceived;
    });
  },
};
