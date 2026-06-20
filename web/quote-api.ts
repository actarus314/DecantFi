// Cotation live et balance wallet pour l'UI web.
// ponytail: Number = affichage, jamais règlement.
import { quote as engineQuote } from '../core/engine.js';
import { rankQuotes } from '../core/rank.js';
import { simulateAquariusNet, simulateXbullNet } from './execute.js';
import { readBlndBalance } from '../core/balance.js';
import { BLND, USDC, EURC } from '../core/assets.js';
import { toStroops, toNumber } from '../core/amount.js';
import { priceImpactPct, targetEvmPerUnit, targetLocalPerUnit } from '../core/prices.js';
import { displayName, noteFor, chipFor, maskedRoute, type Chip } from './stats.js';
import type { WebConfig } from './config.js';
import type { RouteHop } from '../core/sources/types.js';
import type { QuoteResult } from '../core/engine.js';

export interface RibbonPart {
  asset?: string;
  qty?: string;
  out?: boolean;
  tool?: string;
}

export interface CompositeLeg {
  sourceId: string;
  display: string;
  from: string;
  to: string;
  hops: number;
  routeParts: RibbonPart[];
}

export interface LiveLadderRow {
  display: string;
  note: string;
  route: string;
  routeParts: RibbonPart[] | null;
  net: number;
  deltaVsWinner: number;
  chip: Chip;
  /** Impact EVM/global (vs prix CoinGecko/Circle). */
  impactPct: number | null;
  /** Impact local (vs mid SDEX Stellar). null si mid indisponible. */
  impactLocalPct: number | null;
  winner: boolean;
  // click-to-select : identifiant source brut et capacité d'exécution intégrée
  sourceId: string;
  executable: boolean;
  /** Legs du composite EURC via-USDC (2 transactions). Absent pour les routes atomiques. */
  legs?: CompositeLeg[];
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
    /** Impact EVM/global (vs prix CoinGecko/Circle). */
    impactPct: number | null;
    /** Impact local (vs mid SDEX Stellar). null si mid indisponible. */
    impactLocalPct: number | null;
    route: RibbonPart[];
    /** Legs du composite EURC via-USDC (2 transactions). Absent pour les routes atomiques. */
    legs?: CompositeLeg[];
  };
  ladder: LiveLadderRow[];
  prices: {
    blndUsd: number | null;
    eurcUsd: number | null;
    eurcStellarMid: number | null;
    xlmUsd: number | null;
  };
  errors: string[];
  // axe santé, distinct des chips de confiance — ponytail: health axis
  downSources: Array<{ display: string; sourceId: string; reason: string }>;
}

// ─── Construction du ruban depuis la route du gagnant ────────────────────────

// Nom d'affichage du venue (cartouche outil = info la + importante du design). Fallback : capitalise.
const VENUE_LABEL: Record<string, string> = {
  xbull: 'xBull', soroswap: 'Soroswap', aquarius: 'Aquarius', aqua: 'Aquarius',
  comet: 'Comet', ultrastellar: 'Ultra Stellar', stellarbroker: 'StellarBroker',
  horizon: 'Horizon', phoenix: 'Phoenix',
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

// ─── Re-simulation Aquarius + xBull (helper partagé web + collecteur) ────────

/**
 * Crée un callback `reSimLeg` pour `compareEurc` : re-simule on-chain chaque cote xBull/Aquarius
 * de la liste et remplace netOut+grossOut par le vrai fill. Best-effort : un échec RPC ou l'absence
 * de données brutes → cote brute conservée, jamais d'exception.
 * Comet/Soroswap/Horizon/Ultra/StellarBroker sont déjà fidèles → inchangés.
 */
export function makeReSimLeg(
  cfg: { rpcUrl: string },
  deps?: { simulateAquariusNet?: typeof simulateAquariusNet; simulateXbullNet?: typeof simulateXbullNet },
): (quotes: import('../core/sources/types.js').NormalizedQuote[], amountIn: bigint) => Promise<import('../core/sources/types.js').NormalizedQuote[]> {
  const simFnAq = deps?.simulateAquariusNet ?? simulateAquariusNet;
  const simFnXb = deps?.simulateXbullNet ?? simulateXbullNet;

  return async (quotes, amountIn) => {
    const results = await Promise.all(quotes.map(async (q): Promise<import('../core/sources/types.js').NormalizedQuote | null> => {
      try {
        if (q.source === 'aquarius') {
          const rawXdr = (q.raw as { swap_chain_xdr?: unknown } | undefined)?.swap_chain_xdr;
          if (!rawXdr) return q;
          const inputSac = q.sellAsset.sac;
          // No .catch() — let transient RPC errors throw to outer catch (downgraded to 'estimate')
          const simNet = await simFnAq(String(rawXdr), amountIn, inputSac, { rpcUrl: cfg.rpcUrl });
          if (simNet !== null && simNet > 0n) {
            return { ...q, netOut: simNet, grossOut: simNet };
          }
          // simNet === null → structural failure: route non-executable as quoted → exclude
          return null;
        } else if (q.source === 'xbull') {
          const route = (q.raw as { route?: unknown } | undefined)?.route;
          if (!route) return q;
          const xbSim = await simFnXb(String(route), amountIn, { rpcUrl: cfg.rpcUrl }).catch(() => null);
          if (xbSim && xbSim.net > 0n && xbSim.net !== q.netOut)
            return { ...q, netOut: xbSim.net, grossOut: xbSim.net };
          // xbSim === null → RPC/timeout failure → downgrade confidence
          if (!xbSim) return { ...q, netConfidence: 'estimate' as const };
        }
      } catch {
        // Transient RPC error (throw from Aquarius sim) → downgrade confidence, keep raw quote
        return { ...q, netConfidence: 'estimate' as const };
      }
      return q;
    }));
    return results.filter((q): q is import('../core/sources/types.js').NormalizedQuote => q !== null);
  };
}

/**
 * Mute `result` en place : remplace les nets sur-cotés d'Aquarius et xBull par
 * les vrais fills simulés on-chain, re-décode la route xBull, puis re-classe via
 * rankQuotes. Met également à jour result.eurc.direct / winner pour EURC direct.
 * Best-effort : un échec RPC (429, timeout) ne propage jamais d'exception.
 */
export async function resimAquariusXbull(
  result: QuoteResult,
  pairUi: string,
  amountStroops: bigint,
  cfg: { rpcUrl: string },
  deps?: { simulateAquariusNet?: typeof simulateAquariusNet; simulateXbullNet?: typeof simulateXbullNet },
): Promise<void> {
  const simFnAq = deps?.simulateAquariusNet ?? simulateAquariusNet;
  const simFnXb = deps?.simulateXbullNet ?? simulateXbullNet;

  let aquariusSimNet: bigint | undefined;
  let xbullSimNet: bigint | undefined;
  // Tracks whether a sim was attempted but failed (→ downgrade to 'estimate')
  let aquariusSimFailed = false;
  let xbullSimFailed = false;

  const aqRanked = result.ranking.ranked.find((q) => q.source === 'aquarius');
  const rawXdr = (aqRanked?.raw as { swap_chain_xdr?: unknown } | undefined)?.swap_chain_xdr;
  let aqSimMs = 0;
  if (aqRanked && rawXdr) {
    const t0Aq = Date.now();
    const simNet = await simFnAq(String(rawXdr), amountStroops, BLND.sac, { rpcUrl: cfg.rpcUrl }).catch(() => null);
    aqSimMs = Date.now() - t0Aq;
    if (simNet !== null && simNet > 0n && simNet !== aqRanked.netOut) aquariusSimNet = simNet;
    else if (simNet === null) aquariusSimFailed = true; // RPC/timeout failure → downgrade
  }

  const xbRanked = result.ranking.ranked.find((q) => q.source === 'xbull');
  const route = (xbRanked?.raw as { route?: unknown } | undefined)?.route;
  let xbullHops: RouteHop[] | undefined;
  let xbSimMs = 0;
  if (xbRanked && route) {
    const t0Xb = Date.now();
    const xbSim = await simFnXb(String(route), amountStroops, { rpcUrl: cfg.rpcUrl }).catch(() => null);
    xbSimMs = Date.now() - t0Xb;
    if (xbSim && xbSim.net > 0n && xbSim.net !== xbRanked.netOut) xbullSimNet = xbSim.net;
    if (xbSim && xbSim.route.length >= 2) {
      const r = xbSim.route;
      xbullHops = r.slice(0, -1).map((sell, i) => ({ venue: 'xbull', sell, buy: r[i + 1]! }));
    }
    if (!xbSim) xbullSimFailed = true; // RPC/timeout failure → downgrade
  }

  if (aquariusSimNet !== undefined || xbullSimNet !== undefined || xbullHops !== undefined
    || aquariusSimFailed || xbullSimFailed) {
    const newQuotes = result.ranking.ranked.map((q) => {
      if (q.source === 'aquarius') {
        if (aquariusSimNet !== undefined)
          return { ...q, netOut: aquariusSimNet, grossOut: aquariusSimNet,
            durationMs: (q.durationMs ?? 0) + aqSimMs };
        if (aquariusSimFailed)
          return { ...q, netConfidence: 'estimate' as const };
      }
      if (q.source === 'xbull') {
        if (xbullSimNet !== undefined || xbullHops)
          return { ...q,
            ...(xbullSimNet !== undefined ? { netOut: xbullSimNet, grossOut: xbullSimNet } : {}),
            ...(xbullHops ? { route: xbullHops } : {}),
            durationMs: (q.durationMs ?? 0) + xbSimMs };
        if (xbullSimFailed)
          return { ...q, netConfidence: 'estimate' as const };
      }
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
      // Re-simulation honnête des jambes EURC via-USDC (xBull/Aquarius seulement).
      // Best-effort : un échec RPC laisse la cote brute, ne casse pas la cotation.
      reSimLeg: pairUi === 'EURC' ? makeReSimLeg({ rpcUrl: cfg.rpcUrl }, deps) : undefined,
    },
  });

  // ─── Re-simulation Aquarius + xBull : remplace les nets sur-cotés par les vrais fills simulés ───
  // Aquarius find-path sur-cote ~0,2 % sur les routes via-XLM.
  // xBull /swaps/quote sur-cote ~0,1 % (skim routeur non divulgué).
  await resimAquariusXbull(result, pairUi, amountStroops, { rpcUrl: cfg.rpcUrl }, deps);

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
        impactLocalPct: null,
        route: [],
      },
      ladder: [],
      prices: {
        blndUsd: result.prices.blndUsd,
        eurcUsd: result.prices.eurcUsd,
        eurcStellarMid: result.prices.eurcStellarMid,
        xlmUsd: result.prices.xlmUsd,
      },
      errors: result.errors,
      downSources: result.errors.map((id) => ({ display: displayName(id), sourceId: id, reason: result.errorReasons?.[id] ?? 'indisponible' })),
    };
  }

  const netNum = toNumber(bestNet);
  const amtNum = toNumber(amountStroops);
  const rate = amtNum > 0 ? netNum / amtNum : 0;

  const bestConf = eurcPath === 'via-usdc' ? 'exact' : bestQuote.netConfidence;
  const chip: Chip = chipFor(bestConf);
  // FIX 4 : quand le gagnant est le composite via-usdc, l'impact doit porter sur le net EURC final
  // (bestNet = netEurc) et non sur la leg1 seule (bestQuote = leg1 BLND→USDC).
  // On utilise le même calcul que la ligne ladder composite (~ligne 416).
  const impactPct = eurcPath === 'via-usdc'
    ? (priceImpactPct(amountStroops, bestNet, result.prices.blndUsd, targetEvmPerUnit('EURC', result.prices)) ?? null)
    : (bestQuote.priceImpactPct ?? null);
  const impactLocalPct = eurcPath === 'via-usdc'
    ? (priceImpactPct(amountStroops, bestNet, result.prices.blndUsd, targetLocalPerUnit('EURC', result.prices)) ?? null)
    : (bestQuote.priceImpactLocalPct ?? null);

  // Route complète : si via-usdc, concaténer leg1 + leg2
  const combinedRoute = extraRoute ? [...bestQuote.route, ...extraRoute] : bestQuote.route;
  const route = buildRoute(combinedRoute, amountStroops, bestNet, pairUi);

  // Échelle complète : ranking direct + (EURC) ligne composite via-USDC, triée par net.
  // Le composite est TOUJOURS listé quand il existe (comme le stockage collecteur) → le tableau
  // colle au simulateur (le gagnant peut être le composite, pas le meilleur direct).
  const raw: Array<{ source: string; netOut: bigint; conf: string; route: string; hops: RouteHop[] | null; eurcPath: string | null; impactPct: number | null; impactLocalPct: number | null; legs?: CompositeLeg[] }> =
    result.ranking.ranked.map((rq) => ({
      source: rq.source,
      netOut: rq.netOut,
      conf: rq.netConfidence,
      route: routeStr(rq.route, rq.sellAsset.symbol, rq.buyAsset.symbol),
      hops: rq.route,
      eurcPath: null,
      impactPct: rq.priceImpactPct ?? null,
      impactLocalPct: rq.priceImpactLocalPct ?? null,
    }));

  // Legs du composite EURC via-USDC (calculés une seule fois, réutilisés pour best et ladder)
  let compositeLegs: CompositeLeg[] | undefined;
  if (pairUi === 'EURC' && result.eurc?.viaUsdc) {
    const v = result.eurc.viaUsdc;
    const r1 = routeStr(v.leg1.route, v.leg1.sellAsset.symbol, v.leg1.buyAsset.symbol);
    const r2 = routeStr(v.leg2.route, v.leg2.sellAsset.symbol, v.leg2.buyAsset.symbol);
    compositeLegs = [
      {
        sourceId: v.leg1.source,
        display: displayName(v.leg1.source),
        from: 'BLND',
        to: 'USDC',
        hops: v.leg1.route.length,
        routeParts: buildRoute(v.leg1.route, amountStroops, v.leg1.grossOut, 'USDC'),
      },
      {
        sourceId: v.leg2.source,
        display: displayName(v.leg2.source),
        from: 'USDC',
        to: 'EURC',
        hops: v.leg2.route.length,
        routeParts: buildRoute(v.leg2.route, v.leg1.grossOut, v.leg2.netOut, 'EURC'),
      },
    ];
    raw.push({
      source: `${v.leg1.source}+${v.leg2.source}`,
      netOut: v.netEurc,
      conf: 'exact',
      route: `${r1} → ${r2.split(' → ').slice(1).join(' → ')}`, // fusionne le nœud USDC partagé
      hops: null, // composite EURC via-USDC : pas de RouteHop[] structuré unique
      eurcPath: 'via-usdc',
      impactPct: priceImpactPct(amountStroops, v.netEurc, result.prices.blndUsd, targetEvmPerUnit('EURC', result.prices)) ?? null,
      impactLocalPct: priceImpactPct(amountStroops, v.netEurc, result.prices.blndUsd, targetLocalPerUnit('EURC', result.prices)) ?? null,
      legs: compositeLegs,
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
    chip: chipFor(r.conf),
    impactPct: r.impactPct,
    impactLocalPct: r.impactLocalPct,
    winner: i === 0,
    sourceId: r.source,
    // Les lignes composites (EURC via-USDC = "leg1+leg2") = 2 tx non atomiques → JAMAIS exécutables en 1 clic
    // (sinon un clic exécuterait un swap direct 1-leg ≠ les 2 tx revues). Seules les venues simples le sont.
    executable: !r.source.includes('+') && ['xbull', 'soroswap', 'horizon', 'aquarius', 'comet', 'ultrastellar'].includes(r.source.trim()),
    legs: r.legs,
  }));

  return {
    best: {
      display: displayName(bestSource),
      net: netNum,
      rate,
      chip,
      impactPct,
      impactLocalPct,
      route,
      legs: eurcPath === 'via-usdc' ? compositeLegs : undefined,
    },
    ladder,
    prices: {
      blndUsd: result.prices.blndUsd,
      eurcUsd: result.prices.eurcUsd,
      eurcStellarMid: result.prices.eurcStellarMid,
      xlmUsd: result.prices.xlmUsd,
    },
    errors: result.errors,
    downSources: result.errors.map((id) => ({ display: displayName(id), sourceId: id, reason: result.errorReasons?.[id] ?? 'indisponible' })),
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
