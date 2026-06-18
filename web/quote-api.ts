// Cotation live et balance wallet pour l'UI web.
// ponytail: Number = affichage, jamais règlement.
import { quote as engineQuote } from '../core/engine.js';
import { rankQuotes } from '../core/rank.js';
import { simulateAquariusNet, simulateXbullNet } from './execute.js';
import { readBlndBalance } from '../core/balance.js';
import { BLND, USDC, EURC } from '../core/assets.js';
import { toStroops, toNumber } from '../core/amount.js';
import { priceImpactPct, targetUsdPerUnit } from '../core/prices.js';
import { displayName, noteFor, chipFor, maskedRoute, type Chip } from './stats.js';
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
  routeParts: RibbonPart[] | null;
  net: number;
  deltaVsWinner: number;
  chip: Chip;
  impactPct: number | null;
  winner: boolean;
  // click-to-select : identifiant source brut, deep-link et capacité d'exécution intégrée
  sourceId: string;
  deepLink: string | null;
  executable: boolean;
}

/** Normalise les symboles d'actifs : 'native' → 'XLM', tout le reste inchangé. */
const sym = (s: string): string => s === 'native' ? 'XLM' : s;

/** Route lisible depuis les hops d'une cotation : "BLND→XLM→USDC" (ou "BLND→<cible>" si pas de hop). */
function routeStr(hops: RouteHop[], sell: string, buy: string): string {
  if (hops.length === 0) return `${sym(sell)} → ${sym(buy)}`;
  return [hops[0]!.sell, ...hops.map((h) => h.buy)].map(sym).join(' → ');
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
  // axe santé, distinct des chips de confiance — ponytail: health axis
  downSources: Array<{ display: string; reason: string }>;
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
  comet: 'Comet', ultrastellar: 'Ultra Stellar', stellarbroker: 'StellarBroker',
  horizon: 'Horizon', sdex: 'SDEX', phoenix: 'Phoenix',
};
function prettyVenue(v: string): string {
  return VENUE_LABEL[v] ?? (v ? v[0]!.toUpperCase() + v.slice(1) : v);
}

function buildRoute(hops: RouteHop[], amountIn: bigint, netOut: bigint, pairUi: string): RibbonPart[] {
  const parts: RibbonPart[] = [];
  const amtStr = toNumber(amountIn).toFixed(3);
  const netStr = toNumber(netOut).toFixed(3);

  if (hops.length === 0) {
    // Route simple déduite du pair
    const target = pairUi;
    parts.push({ asset: 'BLND', qty: `${amtStr} BLND` });
    parts.push({ tool: 'swap' });
    parts.push({ asset: target, qty: `${netStr} ${target}`, out: true });
    return parts;
  }

  // Premier asset (BLND) avec quantité
  const firstSell = sym(hops[0]?.sell ?? 'BLND');
  parts.push({ asset: firstSell, qty: `${amtStr} ${firstSell}` });

  for (const hop of hops) {
    parts.push({ tool: prettyVenue(hop.venue) });
    // Asset de sortie du hop — si c'est le dernier hop, marquer out
    const isLast = hop === hops[hops.length - 1];
    const buySymbol = sym(hop.buy);
    parts.push({
      asset: buySymbol,
      qty: isLast ? `${netStr} ${buySymbol}` : undefined,
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
  deps?: { simulateAquariusNet?: typeof simulateAquariusNet; simulateXbullNet?: typeof simulateXbullNet },
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
      // Cache RPC pour cette requête : une cotation EURC relance 3 sous-cotations qui re-lisent
      // les mêmes pools → coalesce, évite de saturer le RPC sur un seul appel /api/quote.
      rpcCache: new Map(),
    },
  });

  // ─── Re-simulation Aquarius + xBull : remplace les nets sur-cotés par les vrais fills simulés ───
  // Aquarius find-path sur-cote ~0,2 % sur les routes via-XLM.
  // xBull /swaps/quote sur-cote ~0,1 % (skim routeur non divulgué).
  // On simule avec out_min=0 / minToGet='0' → vrai fill sans revert de slippage.
  let aquariusSimNet: bigint | undefined;
  let xbullSimNet: bigint | undefined;
  {
    const simFnAq = deps?.simulateAquariusNet ?? simulateAquariusNet;
    const simFnXb = deps?.simulateXbullNet ?? simulateXbullNet;

    const aqRanked = result.ranking.ranked.find((q) => q.source === 'aquarius');
    const rawXdr = (aqRanked?.raw as { swap_chain_xdr?: unknown } | undefined)?.swap_chain_xdr;
    if (aqRanked && rawXdr) {
      const simNet = await simFnAq(String(rawXdr), amountStroops, { rpcUrl: cfg.rpcUrl }).catch(() => null);
      if (simNet !== null && simNet > 0n && simNet !== aqRanked.netOut) aquariusSimNet = simNet;
    }

    const xbRanked = result.ranking.ranked.find((q) => q.source === 'xbull');
    const route = (xbRanked?.raw as { route?: unknown } | undefined)?.route;
    if (xbRanked && route) {
      const simNet = await simFnXb(String(route), amountStroops, { rpcUrl: cfg.rpcUrl }).catch(() => null);
      if (simNet !== null && simNet > 0n && simNet !== xbRanked.netOut) xbullSimNet = simNet;
    }

    if (aquariusSimNet !== undefined || xbullSimNet !== undefined) {
      const newQuotes = result.ranking.ranked.map((q) => {
        if (q.source === 'aquarius' && aquariusSimNet !== undefined)
          return { ...q, netOut: aquariusSimNet, grossOut: aquariusSimNet };
        if (q.source === 'xbull' && xbullSimNet !== undefined)
          return { ...q, netOut: xbullSimNet, grossOut: xbullSimNet };
        return q;
      });
      result.ranking = rankQuotes(newQuotes);
    }

    // EURC direct via Aquarius ou xBull : mettre à jour netOut et recalculer winner/bestNetEurc
    if (pairUi === 'EURC' && result.eurc?.direct) {
      const directSrc = result.eurc.direct.source;
      const simNet = directSrc === 'aquarius' ? aquariusSimNet : directSrc === 'xbull' ? xbullSimNet : undefined;
      if (simNet !== undefined) {
        const eurc = result.eurc;
        eurc.direct = { ...eurc.direct!, netOut: simNet, grossOut: simNet };
        const directNet = simNet;
        const viaNet = eurc.viaUsdc?.netEurc;
        if (viaNet !== undefined) {
          eurc.winner = viaNet > directNet ? 'via-usdc' : 'direct';
          eurc.bestNetEurc = eurc.winner === 'via-usdc' ? viaNet : directNet;
          eurc.viaUsdcAdvantage = viaNet - directNet;
        } else {
          eurc.winner = 'direct';
          eurc.bestNetEurc = directNet;
          eurc.viaUsdcAdvantage = undefined;
        }
      }
    }
  }

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
      downSources: result.errors.map((id) => ({ display: displayName(id), reason: result.errorReasons?.[id] ?? 'indisponible' })),
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

  // Échelle complète : ranking direct + (EURC) ligne composite via-USDC, triée par net.
  // Le composite est TOUJOURS listé quand il existe (comme le stockage collecteur) → le tableau
  // colle au simulateur (le gagnant peut être le composite, pas le meilleur direct).
  const raw: Array<{ source: string; netOut: bigint; conf: string; route: string; hops: RouteHop[] | null; eurcPath: string | null; impactPct: number | null }> =
    result.ranking.ranked.map((rq) => ({
      source: rq.source,
      netOut: rq.netOut,
      conf: rq.netConfidence,
      route: routeStr(rq.route, rq.sellAsset.symbol, rq.buyAsset.symbol),
      hops: rq.route,
      eurcPath: null,
      impactPct: rq.priceImpactPct ?? null,
    }));
  if (pairUi === 'EURC' && result.eurc?.viaUsdc) {
    const v = result.eurc.viaUsdc;
    const r1 = routeStr(v.leg1.route, v.leg1.sellAsset.symbol, v.leg1.buyAsset.symbol);
    const r2 = routeStr(v.leg2.route, v.leg2.sellAsset.symbol, v.leg2.buyAsset.symbol);
    raw.push({
      source: `${v.leg1.source}+${v.leg2.source}`,
      netOut: v.netEurc,
      conf: 'estimate',
      route: `${r1} → ${r2.split(' → ').slice(1).join(' → ')}`, // fusionne le nœud USDC partagé
      hops: null, // composite EURC via-USDC : pas de RouteHop[] structuré unique
      eurcPath: 'via-usdc',
      impactPct: priceImpactPct(amountStroops, v.netEurc, result.prices.blndUsd, targetUsdPerUnit('EURC', result.prices)) ?? null,
    });
  }
  raw.sort((a, b) => (a.netOut < b.netOut ? 1 : a.netOut > b.netOut ? -1 : 0));
  const topNetNum = toNumber(raw[0]?.netOut ?? 0n);
  const ladder: LiveLadderRow[] = raw.map((r, i) => ({
    display: displayName(r.source),
    note: noteFor(r.source, i === 0, r.eurcPath),
    route: maskedRoute(r.route, r.source),
    routeParts: r.hops !== null ? buildRoute(r.hops, amountStroops, r.netOut, pairUi) : null,
    net: toNumber(r.netOut),
    deltaVsWinner: toNumber(r.netOut) - topNetNum,
    chip: r.eurcPath === 'via-usdc' ? 'calc' : chipFor(r.conf, r.source, r.eurcPath),
    impactPct: r.impactPct,
    winner: i === 0,
    sourceId: r.source,
    deepLink: deepLink(r.source, pairUi),
    // Les lignes composites (EURC via-USDC = "leg1+leg2") = 2 tx non atomiques → JAMAIS exécutables en 1 clic
    // (sinon un clic exécuterait un swap direct 1-leg ≠ les 2 tx revues). Seules les venues simples le sont.
    executable: !r.source.includes('+') && ['xbull', 'soroswap', 'horizon', 'aquarius', 'comet', 'ultrastellar'].includes(r.source.trim()),
  }));

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
    downSources: result.errors.map((id) => ({ display: displayName(id), reason: result.errorReasons?.[id] ?? 'indisponible' })),
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
