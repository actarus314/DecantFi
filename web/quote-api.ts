// Cotation live et balance wallet pour l'UI web.
// ponytail: Number = affichage, jamais règlement.
import { quote as engineQuote } from '../core/engine.js';
import { readBlndBalance } from '../core/balance.js';
import { BLND, USDC, EURC } from '../core/assets.js';
import { toStroops, toNumber } from '../core/amount.js';
import { displayName, noteFor, chipFor, type Chip } from './stats.js';
import type { WebConfig } from './config.js';
import type { RouteHop } from '../core/sources/types.js';

export interface RibbonPart {
  asset?: string;
  qty?: string;
  out?: boolean;
  tool?: string;
}

export interface LiveLadderRow {
  display: string;
  note: string;
  route: string;
  net: number;
  deltaVsWinner: number;
  chip: Chip;
  impactPct: number | null;
  winner: boolean;
}

/** Route lisible depuis les hops d'une cotation : "BLND→XLM→USDC" (ou "BLND→<cible>" si pas de hop). */
function routeStr(hops: RouteHop[], sell: string, buy: string): string {
  if (hops.length === 0) return `${sell}→${buy}`;
  return [hops[0]!.sell, ...hops.map((h) => h.buy)].join('→');
}

export interface LiveQuote {
  best: {
    display: string;
    net: number;
    rate: number;
    chip: Chip;
    impactPct: number | null;
    route: RibbonPart[];
    deepLink: string | null;
  };
  ladder: LiveLadderRow[];
  prices: {
    blndUsd: number | null;
    eurUsd: number | null;
    xlmUsd: number | null;
  };
  errors: string[];
}

// ─── Deep-links (pages réelles, sans prefill inventé) ────────────────────────

const DEEP_LINKS: Record<string, string> = {
  xbull: 'https://swap.xbull.io/',
  soroswap: 'https://app.soroswap.finance/',
  aquarius: 'https://aqua.network/',
  ultrastellar: 'https://www.ultrastellar.com/',
};

export function deepLink(sourceId: string, _pairUi: string): string | null {
  // Pour un id combiné (ex. "xbull+ultrastellar") → premier hop = xbull
  const base = sourceId.split('+')[0]?.trim() ?? '';
  return DEEP_LINKS[base] ?? null;
}

// ─── Construction du ruban depuis la route du gagnant ────────────────────────

// Nom d'affichage du venue (cartouche outil = info la + importante du design). Fallback : capitalise.
const VENUE_LABEL: Record<string, string> = {
  xbull: 'xBull', soroswap: 'Soroswap', aquarius: 'Aquarius', aqua: 'Aquarius',
  comet: 'Comet', ultrastellar: 'Ultra', stellarbroker: 'StellarBroker',
  horizon: 'Horizon', sdex: 'SDEX', phoenix: 'Phoenix',
};
function prettyVenue(v: string): string {
  return VENUE_LABEL[v] ?? (v ? v[0]!.toUpperCase() + v.slice(1) : v);
}

function buildRoute(hops: RouteHop[], amountIn: bigint, netOut: bigint, pairUi: string): RibbonPart[] {
  const parts: RibbonPart[] = [];
  const amtStr = toNumber(amountIn).toFixed(2);
  const netStr = toNumber(netOut).toFixed(2);

  if (hops.length === 0) {
    // Route simple déduite du pair
    const target = pairUi;
    parts.push({ asset: 'BLND', qty: `${amtStr} BLND` });
    parts.push({ tool: 'swap' });
    parts.push({ asset: target, qty: `${netStr} ${target}`, out: true });
    return parts;
  }

  // Premier asset (BLND) avec quantité
  parts.push({ asset: hops[0]?.sell ?? 'BLND', qty: `${amtStr} BLND` });

  for (const hop of hops) {
    parts.push({ tool: prettyVenue(hop.venue) });
    // Asset de sortie du hop — si c'est le dernier hop, marquer out
    const isLast = hop === hops[hops.length - 1];
    parts.push({
      asset: hop.buy,
      qty: isLast ? `${netStr} ${hop.buy}` : undefined,
      out: isLast,
    });
  }

  return parts;
}

// ─── Cotation live ────────────────────────────────────────────────────────────

export async function liveQuote(
  pairUi: string,
  amountStroops: bigint,
  cfg: WebConfig,
): Promise<LiveQuote> {
  const buyAsset = pairUi === 'EURC' ? EURC : USDC;

  const result = await engineQuote({
    sell: BLND,
    buy: buyAsset,
    amountIn: amountStroops,
    cfg: {
      rpcUrl: cfg.rpcUrl,
      horizonUrl: cfg.horizonUrl,
      soroswapApiKey: cfg.soroswapApiKey,
      walletAddress: cfg.walletAddress,
      timeoutMs: cfg.timeoutMs,
    },
  });

  // Pour EURC : si le gagnant est via-usdc, utiliser result.eurc
  let bestQuote: import('../core/sources/types.js').NormalizedQuote | undefined = result.ranking.best;
  let bestNet: bigint | undefined = bestQuote?.netOut;
  let bestSource = bestQuote?.source ?? '';
  let eurcPath: string | null = null;

  // Pour EURC via-usdc : route combinée = leg1.route ++ leg2.route (BLND→USDC→EURC)
  let extraRoute: RouteHop[] | undefined;

  if (pairUi === 'EURC' && result.eurc) {
    const eurc = result.eurc;
    if (eurc.winner === 'via-usdc' && eurc.viaUsdc) {
      bestSource = `${eurc.viaUsdc.leg1.source}+${eurc.viaUsdc.leg2.source}`;
      bestNet = eurc.viaUsdc.netEurc;
      eurcPath = 'via-usdc';
      // Ruban complet = jambe 1 (BLND→USDC) + jambe 2 (USDC→EURC)
      bestQuote = eurc.viaUsdc.leg1;
      extraRoute = eurc.viaUsdc.leg2.route;
    } else if (eurc.winner === 'direct' && eurc.direct) {
      bestQuote = eurc.direct;
      bestNet = eurc.direct.netOut;
      bestSource = eurc.direct.source;
    }
  }

  if (!bestQuote || bestNet === undefined || bestNet <= 0n) {
    // Aucune cotation disponible
    return {
      best: {
        display: '—',
        net: 0,
        rate: 0,
        chip: 'est',
        impactPct: null,
        route: [],
        deepLink: null,
      },
      ladder: [],
      prices: {
        blndUsd: result.prices.blndUsd,
        eurUsd: result.prices.eurUsd,
        xlmUsd: result.prices.xlmUsd,
      },
      errors: result.errors,
    };
  }

  const netNum = toNumber(bestNet);
  const amtNum = toNumber(amountStroops);
  const rate = amtNum > 0 ? netNum / amtNum : 0;

  const bestConf = bestQuote.netConfidence;
  // Pour via-usdc : forcer 'calc' car leg1 peut être 'exact' mais c'est une estimation 2 swaps
  const chip: Chip = eurcPath === 'via-usdc' ? 'calc' : chipFor(bestConf, bestSource, eurcPath);
  const impactPct = bestQuote.priceImpactPct ?? null;

  // Route complète : si via-usdc, concaténer leg1 + leg2
  const combinedRoute = extraRoute ? [...bestQuote.route, ...extraRoute] : bestQuote.route;
  const route = buildRoute(combinedRoute, amountStroops, bestNet, pairUi);

  // Échelle complète depuis ranking.ranked
  const ladder: LiveLadderRow[] = [];
  const ranked = result.ranking.ranked;
  const winnerNet = ranked[0]?.netOut ?? 0n;
  const winNetNum = toNumber(winnerNet);

  for (const rq of ranked) {
    const rNet = toNumber(rq.netOut);
    const rConf = rq.netConfidence;
    const rSource = rq.source;
    const rEurcPath: string | null = null; // classement direct uniquement
    ladder.push({
      display: displayName(rSource),
      note: noteFor(rSource, rq.rank === 1, rEurcPath),
      route: routeStr(rq.route, rq.sellAsset.symbol, rq.buyAsset.symbol),
      net: rNet,
      deltaVsWinner: rNet - winNetNum,
      chip: chipFor(rConf, rSource, rEurcPath),
      impactPct: rq.priceImpactPct ?? null,
      winner: rq.rank === 1,
    });
  }

  return {
    best: {
      display: displayName(bestSource),
      net: netNum,
      rate,
      chip,
      impactPct,
      route,
      deepLink: deepLink(bestSource, pairUi),
    },
    ladder,
    prices: {
      blndUsd: result.prices.blndUsd,
      eurUsd: result.prices.eurUsd,
      xlmUsd: result.prices.xlmUsd,
    },
    errors: result.errors,
  };
}

// ─── Balance wallet ───────────────────────────────────────────────────────────

export async function walletBalance(cfg: WebConfig): Promise<{ blnd: number; configured: boolean }> {
  if (!cfg.walletAddress) {
    return { blnd: 0, configured: false };
  }
  const stroops = await readBlndBalance(cfg.walletAddress, {
    horizonUrl: cfg.horizonUrl,
    timeoutMs: cfg.timeoutMs,
  });
  return { blnd: toNumber(stroops), configured: true };
}

// ─── Parse amount helper ─────────────────────────────────────────────────────

export function parseAmountStroops(amountStr: string): bigint | null {
  const n = Number(amountStr);
  if (!isFinite(n) || n <= 0) return null;
  try {
    return toStroops(n);
  } catch {
    return null;
  }
}
