// Coherence probe: checks that a venue actually executes the route it quoted.
// Money-path: bigint stroops throughout.
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

// ─── Threshold constant ──────────────────────────────────────────────────────

const DELTA_BPS_SUSPECT = 50; // 0.5%

// ─── Exported type ────────────────────────────────────────────────────────────

export interface CoherenceResult {
  venue: Venue;
  incoherent: boolean;
  reason: string | null;
  netQuoted: bigint | null;
  netSimulated: bigint | null;
  deltaBps: number | null;
  route: string[];       // decoded route (Soroban) or XDR path (classic)
  transfers: Transfer[]; // empty for classic venues
}

// ─── Pure exported helper — net calculation from transfers ────────────────────

/** Sum of credits received by `sender` for the `buySymbol` asset across the transfer chain. */
export function netFromTransfers(transfers: Transfer[], buySymbol: string, sender: string): bigint {
  let sum = 0n;
  for (const t of transfers) {
    if (t.asset === buySymbol && t.to === sender) sum += t.amount;
  }
  return sum;
}

// ─── Pure exported helper — Soroban evaluation ─────────────────────────────────

/** Shared calculation for Soroban venues (xbull/aquarius/soroswap/comet).
 *  Exported for unit tests (pure, no network). */
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

// ─── Internal helper — decodes a classic Stellar XDR path ──────────────

/** Builds the route as symbols from a classic tx XDR (PathPaymentStrictSend).
 *  Supports multi-op tx (Ultra Stellar). Deduplicates consecutive symbols. */
async function routeFromClassicXdr(xdrStr: string): Promise<string[]> {
  const { bySac, ASSETS } = await import('../core/assets.js');

  // Resolves an SdkAsset to a readable symbol: native → 'XLM', otherwise looks up ASSETS by code+issuer.
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

  // Consecutive deduplication (same logic as routeFromTransfers)
  const route: string[] = [];
  for (const s of rawSymbols) {
    if (route[route.length - 1] !== s) route.push(s);
  }
  return route;
}

// ─── Main function ──────────────────────────────────────────────────────

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

    // ── Comet (BLND→USDC only) ─────────────────────────────────────────
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

    // ── Horizon (classic) ───────────────────────────────────────────────────
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

    // ── Ultra Stellar (classic multi-op) ────────────────────────────────────
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
    // Best-effort: any network/sim failure → null (never throws)
    return null;
  }
}

// ─── Daily probe orchestration ────────────────────────────────────

/** Venues to probe (all known venues). */
const PROBE_VENUES: Venue[] = ['xbull', 'aquarius', 'soroswap', 'comet', 'horizon', 'ultrastellar'];

/**
 * Runs one coherence probe per venue, once per UTC day,
 * spread randomly across the day (increasing probability → 1 right before midnight).
 * Best-effort: a venue failure never interrupts the others or the daemon.
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

  // Start of the current UTC day (e.g. "2026-06-19T00:00:00.000Z")
  const startOfDay = now.toISOString().slice(0, 10) + 'T00:00:00.000Z';

  // Calculate the number of ticks remaining until UTC midnight
  const nextMidnight = new Date(now.toISOString().slice(0, 10));
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1); // next day's UTC midnight
  const msToMidnight = nextMidnight.getTime() - now.getTime();
  const ticksRemaining = Math.max(1, Math.floor(msToMidnight / (cfg.cadenceSec * 1000)));

  for (const venue of PROBE_VENUES) {
    try {
      // Already probed today → skip
      if (db.hasCoherenceProbeSince(venue, startOfDay)) continue;

      // Spread: p = 1/ticksRemaining → increases each tick, = 1 on the last tick
      if (random() >= 1 / ticksRemaining) continue;

      // Comet only supports USDC
      const pair: 'USDC' | 'EURC' = venue === 'comet'
        ? 'USDC'
        : cfg.pairs[Math.floor(random() * cfg.pairs.length)] ?? 'USDC';

      const buy: Asset = pair === 'EURC' ? EURC : USDC;

      // Random size among the configured sizes
      if (cfg.sizesBlnd.length === 0) continue;
      const amountIn = cfg.sizesBlnd[Math.floor(random() * cfg.sizesBlnd.length)] ?? cfg.sizesBlnd[0];

      const res = await probe(venue, buy, amountIn!, AQUARIUS_WITNESSES[0]!, cfg);

      // null = not measurable this tick (doesn't pollute the count, will retry)
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
      // Error isolated per venue — the daemon keeps going
    }
  }
}
