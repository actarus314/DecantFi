// Ultra Stellar (moteur de StellarTerm) : split SDEX + AMM classiques. GET smart-routing.
// IMPORTANT : on OMET le param 'fee' (fee=0 est rejete ; l'omission = pas de skim = la "brute" du design).
// Reponse: optimized_sum = somme optimisee sans skim ; extended_paths[] decrit le split. netConfidence: exact.
import type { SourceAdapter, NormalizedQuote, QuoteRequest } from './types.js';
import type { Asset } from '../assets.js';
import { classicColon } from '../assets.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { fromStroops } from '../amount.js';
import { getJson } from './http.js';
import { stroopsOrNull, hops } from './util.js';

interface UltraPath {
  percent?: number;
  readablePath?: string[];
}
interface UltraRaw {
  optimized_sum?: string | number;
  extended_paths?: UltraPath[];
}

function colon(a: Asset): string {
  return a.native ? 'native' : classicColon(a);
}

export function parseUltrastellar(raw: unknown, req: QuoteRequest): NormalizedQuote | null {
  const j = raw as UltraRaw | null;
  const grossOut = stroopsOrNull(j?.optimized_sum);
  if (grossOut === null || grossOut <= 0n) return null;

  const paths = Array.isArray(j?.extended_paths) ? j!.extended_paths! : [];
  const top = [...paths].sort((a, b) => (Number(b?.percent) || 0) - (Number(a?.percent) || 0))[0];
  const rp =
    Array.isArray(top?.readablePath) && top!.readablePath!.length >= 2
      ? top!.readablePath!
      : [req.sellAsset.symbol, req.buyAsset.symbol];
  const venue = 'ultrastellar';

  return {
    source: 'ultrastellar',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut,
    feeBreakdown: paths.length > 1 ? [{ kind: 'unknown', note: `split sur ${paths.length} chemins` }] : [],
    gasXlm: DEFAULT_GAS_XLM.classic,
    gasInTarget: 0n,
    netOut: grossOut,
    netConfidence: 'exact',
    route: hops(venue, rp),
    raw,
  };
}

export const ultrastellar: SourceAdapter = {
  id: 'ultrastellar',
  available: () => true,
  async quote(req, cfg) {
    // 'fee' volontairement omis (cf. en-tete).
    const sp = new URLSearchParams({
      source: colon(req.sellAsset),
      destination: colon(req.buyAsset),
      amount: fromStroops(req.amountIn),
      type: 'send',
    });
    const url = `https://routing.ultrastellar.com/.netlify/functions/v1/smart-routing?${sp.toString()}`;
    return parseUltrastellar(await getJson(url, cfg.timeoutMs), req);
  },
};
