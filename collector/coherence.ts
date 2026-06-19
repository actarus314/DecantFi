// Sonde de cohérence : vérifie qu'une venue exécute bien la route annoncée.
// Money-path : bigint stroops partout.
import {
  quoteXbull,
  quoteAquarius,
  quoteSoroswap,
  quoteComet,
  quoteHorizon,
  quoteUltra,
  buildHorizon,
  buildUltra,
  simulateXbullNet,
  simulateAquariusTransfers,
  simulateSoroswapTransfers,
  simulateCometTransfers,
  defaultDeps,
  AQUARIUS_WITNESSES,
  type Venue,
} from '../web/execute.js';
import {
  verifyChain,
  routeFromTransfers,
  type Transfer,
} from '../core/soroban-route.js';
import { BLND, USDC, EURC, type Asset } from '../core/assets.js';
import { type CoherenceProbeInsert } from '../db/index.js';
import { bigIntJson } from './tick.js';
import { TransactionBuilder, Networks } from '@stellar/stellar-sdk';

// ─── Constante de seuil ──────────────────────────────────────────────────────

const DELTA_BPS_SUSPECT = 50; // 0,5 %

// ─── Type exporté ────────────────────────────────────────────────────────────

export interface CoherenceResult {
  venue: Venue;
  incoherent: boolean;
  reason: string | null;
  netQuoted: bigint | null;
  netSimulated: bigint | null;
  deltaBps: number | null;
  route: string[];       // route décodée (Soroban) ou path du XDR (classique)
  transfers: Transfer[]; // vide pour les venues classiques
}

// ─── Helper pur exporté — calcul net depuis les transfers ────────────────────

/** Somme des crédits reçus par `sender` pour l'actif `buySymbol` dans la chaîne de transferts. */
export function netFromTransfers(transfers: Transfer[], buySymbol: string, sender: string): bigint {
  let sum = 0n;
  for (const t of transfers) {
    if (t.asset === buySymbol && t.to === sender) sum += t.amount;
  }
  return sum;
}

// ─── Helper pur exporté — évaluation Soroban ─────────────────────────────────

/** Calcul commun pour les venues Soroban (xbull/aquarius/soroswap/comet).
 *  Exporté pour les tests unitaires (pur, sans réseau). */
export function evaluateSoroban(
  transfers: Transfer[],
  netQuoted: bigint,
  sender: string,
  sellSym: string,
  buySym: string,
): { incoherent: boolean; reason: string | null; netSimulated: bigint; deltaBps: number | null; route: string[] } {
  const netSimulated = netFromTransfers(transfers, buySym, sender);
  const route = routeFromTransfers(transfers);
  const chk = verifyChain(transfers, sellSym, buySym);

  let deltaBps: number | null = null;
  if (netSimulated > 0n) {
    const diff = netSimulated > netQuoted ? netSimulated - netQuoted : netQuoted - netSimulated;
    deltaBps = Number((diff * 10000n) / netSimulated);
  }

  const reasons: string[] = [];
  if (!chk.chained && chk.reason) reasons.push(chk.reason);
  if (deltaBps !== null && deltaBps > DELTA_BPS_SUSPECT) reasons.push(`écart prix ${deltaBps} bps`);

  const incoherent = !chk.chained || (deltaBps !== null && deltaBps > DELTA_BPS_SUSPECT);
  const reason = reasons.length > 0 ? reasons.join(' ; ') : null;

  return { incoherent, reason, netSimulated, deltaBps, route };
}

// ─── Helper interne — décode le path d'un XDR Stellar classique ──────────────

/** Construit la route en symboles depuis un XDR de tx classique (PathPaymentStrictSend).
 *  Supporte les tx multi-op (Ultra Stellar). Déduplique les symboles consécutifs. */
async function routeFromClassicXdr(xdrStr: string): Promise<string[]> {
  const { bySac, ASSETS } = await import('../core/assets.js');

  // Résout un SdkAsset en symbole lisible : natif → 'XLM', sinon cherche dans ASSETS par code+issuer.
  function resolveSymbol(a: { asset_type?: string; asset_code?: string; asset_issuer?: string } | { getAssetType(): string; getCode?(): string; getIssuer?(): string }): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aa = a as any;
    const type: string = aa.asset_type ?? (typeof aa.getAssetType === 'function' ? aa.getAssetType() : '');
    if (type === 'native') return 'XLM';
    const code: string = aa.asset_code ?? (typeof aa.getCode === 'function' ? aa.getCode() : '');
    const issuer: string = aa.asset_issuer ?? (typeof aa.getIssuer === 'function' ? aa.getIssuer() : '');
    const found = ASSETS.find((asset) => asset.code === code && asset.issuer === issuer);
    return found?.symbol ?? code;
  }

  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    tx = TransactionBuilder.fromXDR(xdrStr, Networks.PUBLIC);
  } catch {
    return [];
  }

  const rawSymbols: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const op of (tx as any).operations ?? []) {
    if (op.type !== 'pathPaymentStrictSend') continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendAsset = op.sendAsset as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const destAsset = op.destAsset as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const path: any[] = op.path ?? [];
    rawSymbols.push(resolveSymbol(sendAsset));
    for (const p of path) rawSymbols.push(resolveSymbol(p));
    rawSymbols.push(resolveSymbol(destAsset));
  }

  // Déduplication consécutive (même logique que routeFromTransfers)
  const route: string[] = [];
  for (const s of rawSymbols) {
    if (route[route.length - 1] !== s) route.push(s);
  }
  return route;
}

// ─── Fonction principale ──────────────────────────────────────────────────────

export async function probeVenueCoherence(
  venue: Venue,
  buy: Asset,
  amountIn: bigint,
  sender: string,
  cfg: { rpcUrl: string; horizonUrl?: string; soroswapApiKey?: string; timeoutMs?: number },
): Promise<CoherenceResult | null> {
  const deps = defaultDeps(cfg.timeoutMs);
  const sellSym = 'BLND';
  const buySym = buy.symbol;

  try {
    // ── xBull ────────────────────────────────────────────────────────────────
    if (venue === 'xbull') {
      const q = await quoteXbull(BLND.sac, buy.sac, amountIn, deps);
      if (!q) return null;
      const netQuoted = q.netOut;
      const sim = await simulateXbullNet(q.route, amountIn, { rpcUrl: cfg.rpcUrl });
      if (!sim) return null;
      const ev = evaluateSoroban(sim.transfers, netQuoted, sender, sellSym, buySym);
      return { venue, netQuoted, netSimulated: ev.netSimulated, deltaBps: ev.deltaBps, route: ev.route, transfers: sim.transfers, incoherent: ev.incoherent, reason: ev.reason };
    }

    // ── Aquarius ─────────────────────────────────────────────────────────────
    if (venue === 'aquarius') {
      const q = await quoteAquarius(BLND.sac, buy.sac, amountIn, deps);
      if (!q) return null;
      const netQuoted = q.netOut;
      const transfers = await simulateAquariusTransfers(q.swapChainXdr, amountIn, { rpcUrl: cfg.rpcUrl });
      if (!transfers) return null;
      const ev = evaluateSoroban(transfers, netQuoted, sender, sellSym, buySym);
      return { venue, netQuoted, netSimulated: ev.netSimulated, deltaBps: ev.deltaBps, route: ev.route, transfers, incoherent: ev.incoherent, reason: ev.reason };
    }

    // ── Soroswap ─────────────────────────────────────────────────────────────
    if (venue === 'soroswap') {
      if (!cfg.soroswapApiKey) return null;
      const client = deps.makeSoroswap(cfg.soroswapApiKey);
      const q = await quoteSoroswap(client, BLND.sac, buy.sac, amountIn, 50);
      if (!q) return null;
      const netQuoted = q.netOut;
      const transfers = await simulateSoroswapTransfers(client, q.quote, sender, { rpcUrl: cfg.rpcUrl });
      if (!transfers) return null;
      const ev = evaluateSoroban(transfers, netQuoted, sender, sellSym, buySym);
      return { venue, netQuoted, netSimulated: ev.netSimulated, deltaBps: ev.deltaBps, route: ev.route, transfers, incoherent: ev.incoherent, reason: ev.reason };
    }

    // ── Comet (BLND→USDC uniquement) ─────────────────────────────────────────
    if (venue === 'comet') {
      if (buy.symbol !== 'USDC') return null;
      const q = await quoteComet(deps, BLND.sac, buy.sac, amountIn, cfg.rpcUrl);
      if (!q) return null;
      const netQuoted = q.netOut;
      const transfers = await simulateCometTransfers({ sellSac: BLND.sac, buySac: buy.sac, amountIn, rpcUrl: cfg.rpcUrl });
      if (!transfers) return null;
      const ev = evaluateSoroban(transfers, netQuoted, sender, sellSym, buySym);
      return { venue, netQuoted, netSimulated: ev.netSimulated, deltaBps: ev.deltaBps, route: ev.route, transfers, incoherent: ev.incoherent, reason: ev.reason };
    }

    // ── Horizon (classique) ───────────────────────────────────────────────────
    if (venue === 'horizon') {
      const q = await quoteHorizon(BLND, buy, amountIn, deps, cfg.horizonUrl);
      if (!q) return null;
      const netQuoted = q.netOut;
      const built = await buildHorizon(sender, BLND, buy, amountIn, 0n, q.path, cfg.horizonUrl);
      const route = await routeFromClassicXdr(built.xdr);
      const incoherent = !(route[0] === sellSym && route[route.length - 1] === buySym);
      const reason = incoherent ? `path XDR incohérent : ${route.join('→')}` : null;
      return { venue, netQuoted, netSimulated: null, deltaBps: null, route, transfers: [], incoherent, reason };
    }

    // ── Ultra Stellar (classique multi-op) ────────────────────────────────────
    if (venue === 'ultrastellar') {
      const q = await quoteUltra(BLND, buy, amountIn, deps);
      if (!q) return null;
      const netQuoted = q.netOut;
      const built = await buildUltra(sender, BLND, buy, q.legs, amountIn, 50, cfg.horizonUrl);
      const route = await routeFromClassicXdr(built.xdr);
      const incoherent = !(route[0] === sellSym && route[route.length - 1] === buySym);
      const reason = incoherent ? `path XDR incohérent : ${route.join('→')}` : null;
      return { venue, netQuoted, netSimulated: null, deltaBps: null, route, transfers: [], incoherent, reason };
    }

    return null;
  } catch {
    // Best-effort : tout échec réseau/sim → null (jamais throw)
    return null;
  }
}

// ─── Orchestration quotidienne des sondes ────────────────────────────────────

/** Venues à sonder (toutes les venues connues). */
const PROBE_VENUES: Venue[] = ['xbull', 'aquarius', 'soroswap', 'comet', 'horizon', 'ultrastellar'];

/**
 * Lance une sonde de cohérence par venue, une fois par jour UTC,
 * étalée aléatoirement sur la journée (probabilité croissante → 1 avant minuit).
 * Best-effort : un échec de venue n'interrompt pas les autres ni le daemon.
 */
export async function runCoherenceProbes(
  db: {
    hasCoherenceProbeSince(venue: string, sinceIso: string): boolean;
    insertCoherenceProbe(row: CoherenceProbeInsert): void;
  },
  cfg: {
    rpcUrl: string;
    horizonUrl?: string;
    soroswapApiKey?: string;
    timeoutMs?: number;
    sizesBlnd: bigint[];
    pairs: Array<'USDC' | 'EURC'>;
    cadenceSec: number;
  },
  now: Date,
  deps: { random?: () => number; probe?: typeof probeVenueCoherence } = {},
): Promise<void> {
  const random = deps.random ?? Math.random;
  const probe  = deps.probe  ?? probeVenueCoherence;

  // Début du jour UTC courant (ex: "2026-06-19T00:00:00.000Z")
  const startOfDay = now.toISOString().slice(0, 10) + 'T00:00:00.000Z';

  // Calcul du nombre de ticks restants jusqu'à minuit UTC
  const nextMidnight = new Date(now.toISOString().slice(0, 10));
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1); // minuit UTC du lendemain
  const msToMidnight = nextMidnight.getTime() - now.getTime();
  const ticksRemaining = Math.max(1, Math.floor(msToMidnight / (cfg.cadenceSec * 1000)));

  for (const venue of PROBE_VENUES) {
    try {
      // Déjà sondée aujourd'hui → skip
      if (db.hasCoherenceProbeSince(venue, startOfDay)) continue;

      // Étalement : p = 1/ticksRemaining → augmente à chaque tick, = 1 sur le dernier tick
      if (random() >= 1 / ticksRemaining) continue;

      // Comet ne supporte que USDC
      const pair: 'USDC' | 'EURC' = venue === 'comet'
        ? 'USDC'
        : cfg.pairs[Math.floor(random() * cfg.pairs.length)] ?? 'USDC';

      const buy: Asset = pair === 'EURC' ? EURC : USDC;

      // Taille aléatoire parmi les tailles configurées
      if (cfg.sizesBlnd.length === 0) continue;
      const amountIn = cfg.sizesBlnd[Math.floor(random() * cfg.sizesBlnd.length)] ?? cfg.sizesBlnd[0];

      const res = await probe(venue, buy, amountIn!, AQUARIUS_WITNESSES[0]!, cfg);

      // null = non mesurable ce tick (on ne pollue pas le décompte, on réessaiera)
      if (res === null) continue;

      db.insertCoherenceProbe({
        created_at:    now.toISOString(),
        venue,
        pair,
        amount_in:     amountIn!,
        incoherent:    res.incoherent,
        reason:        res.reason,
        net_quoted:    res.netQuoted,
        net_simulated: res.netSimulated,
        delta_bps:     res.deltaBps,
        route_json:    JSON.stringify(res.route),
        trace_json:    res.incoherent
          ? JSON.stringify(
              { transfers: res.transfers, route: res.route, netQuoted: res.netQuoted, netSimulated: res.netSimulated, deltaBps: res.deltaBps },
              bigIntJson,
            )
          : null,
      });
    } catch {
      // Erreur isolée par venue — le daemon continue
    }
  }
}
