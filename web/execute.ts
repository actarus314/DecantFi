// Orchestrateur d'exécution : BLND → USDC/EURC via xBull, Soroswap ou Horizon.
// Money-path : bigint stroops partout, jamais de float pour les calculs.
import { BLND, USDC, EURC, bySac, classicColon, type Asset } from '../core/assets.js';
import { toNumber, fromStroops } from '../core/amount.js';
import { stroopsOrNull } from '../core/sources/util.js';
import { SoroswapSDK, SupportedNetworks, SupportedProtocols, TradeType } from '@soroswap/sdk';

/** Venues d'exécution branchées. Ajouter une venue = étendre cette union (et son cas de build/submit). */
export type Venue = 'xbull' | 'soroswap' | 'horizon';

// ─── User-Agent commun (xBull bloque l'UA Node par défaut) ──────────────────
const XBULL_UA = 'Mozilla/5.0 (compatible; stellar-swap/0.1; +exec)';
const XBULL_BASE = 'https://swap.apis.xbull.app';
const HORIZON_BASE_DEFAULT = 'https://horizon.stellar.org';

// ─── Erreur typée ────────────────────────────────────────────────────────────

export class ExecError extends Error {
  constructor(
    public code: 'trustline' | 'funds' | 'slippage' | 'down' | 'no-route',
    message: string,
  ) {
    super(message);
    this.name = 'ExecError';
  }
}

// ─── Helpers purs exportés ───────────────────────────────────────────────────

/** Floor-division : net * (10000-bps) / 10000. Lance si bps invalide. */
export function minReceivedStroops(net: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps >= 10000) {
    throw new RangeError(`slippageBps invalide : ${slippageBps}`);
  }
  return (net * BigInt(10000 - slippageBps)) / 10000n;
}

/** Gagnant par netOut max (stable : à égalité, le premier l'emporte). */
export function pickBest<T extends { netOut: bigint }>(quotes: Array<T | null>): T | null {
  let best: T | null = null;
  for (const q of quotes) {
    if (q === null) continue;
    if (best === null || q.netOut > best.netOut) best = q;
  }
  return best;
}

/** Valide la réponse accept-quote xBull ; null si mal formée. */
export function parseXbullAcceptQuote(raw: unknown): { id: string; xdr: string; type: 'full' | 'restore' } | null {
  if (raw === null || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['id'] !== 'string') return null;
  if (typeof obj['xdr'] !== 'string') return null;
  if (obj['type'] !== 'full' && obj['type'] !== 'restore') return null;
  return { id: obj['id'], xdr: obj['xdr'], type: obj['type'] };
}

/** Classification des erreurs d'exécution. Insensible à la casse. */
export function classifyExecError(message: string): 'trustline' | 'funds' | 'slippage' | 'down' {
  const m = message.toLowerCase();
  if (m.includes('trust')) return 'trustline';
  if (m.includes('fund') || m.includes('balance') || m.includes('enough') || m.includes('insufficient balance')) return 'funds';
  if (m.includes('slippage') || m.includes('routerinsufficientoutputamount') || m.includes('output amount')) return 'slippage';
  return 'down';
}

/** Label de route lisible pour l'UI.
 *  Soroswap : chaque SAC → symbole via bySac (fallback C1234…7890).
 *  xBull : route opaque → ☁ (glyph rendu côté web comme "hops cachés"). */
export function routeLabel(
  venue: 'xbull' | 'soroswap',
  target: 'USDC' | 'EURC',
  sorobanPath?: string[],
): string {
  if (venue === 'xbull') return `BLND → ☁ → ${target}`;
  if (!sorobanPath || sorobanPath.length === 0) return `BLND → ${target}`;
  return sorobanPath
    .map((sac) => {
      const a = bySac(sac);
      if (a) return a.symbol;
      return `${sac.slice(0, 4)}…${sac.slice(-4)}`;
    })
    .join(' → ');
}

// ─── ReviewData ───────────────────────────────────────────────────────────────

export interface ReviewData {
  venue: Venue;
  target: 'USDC' | 'EURC';
  type: 'full' | 'restore' | 'swap';
  sendAmount: number;
  netOut: number;
  minReceived: number;
  slippageBps: number;
  route: string;
  /** Présent seulement si le net affiché au meta-agrégateur était supérieur à ce qu'on exécute. */
  fidelity?: { displayedWinner: string; displayedWinnerNet: number };
}

export function reviewData(args: {
  venue: Venue;
  target: 'USDC' | 'EURC';
  type: 'full' | 'restore' | 'swap';
  sendStroops: bigint;
  netStroops: bigint;
  minReceivedStroops: bigint;
  slippageBps: number;
  route: string;
  displayed?: { winner?: string; net?: number };
}): ReviewData {
  const r: ReviewData = {
    venue: args.venue,
    target: args.target,
    type: args.type,
    sendAmount: toNumber(args.sendStroops),
    netOut: toNumber(args.netStroops),
    minReceived: toNumber(args.minReceivedStroops),
    slippageBps: args.slippageBps,
    route: args.route,
  };

  // Fidelity : écart entre ce qui était affiché et ce qu'on exécute réellement.
  const dw = args.displayed?.winner;
  const dn = args.displayed?.net;
  if (dw && dn != null && dn - toNumber(args.netStroops) > 1e-6) {
    r.fidelity = { displayedWinner: dw, displayedWinnerNet: dn };
  }

  return r;
}

// ─── IO injectable ───────────────────────────────────────────────────────────

export interface FetchResult {
  status: number;
  ok: boolean;
  body: unknown;
}

export interface SoroswapClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote(req: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build(req: { quote: any; from: string }): Promise<{ xdr: string }>;
  send(xdr: string): Promise<{ txHash: string; success: boolean }>;
}

export interface ExecDeps {
  fetchJson: (url: string, init?: { method?: string; body?: unknown }) => Promise<FetchResult>;
  makeSoroswap: (apiKey: string) => SoroswapClient;
}

/** Dépendances réelles avec fetch réseau.
 * ponytail: contrairement à core/sources/http.ts qui retourne null sur erreur (silencieux),
 * fetchJson remonte les détails d'erreur dans body pour permettre des ExecError claires côté appelant. */
export function defaultDeps(timeoutMs?: number): ExecDeps {
  return {
    async fetchJson(url, init) {
      try {
        const isPost = init?.method === 'POST';
        const res = await fetch(url, {
          method: init?.method ?? 'GET',
          signal: AbortSignal.timeout(timeoutMs ?? 15000),
          headers: {
            'User-Agent': XBULL_UA,
            Accept: 'application/json',
            ...(isPost ? { 'Content-Type': 'application/json' } : {}),
          },
          body: isPost && init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
        const text = await res.text();
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
        return { status: res.status, ok: res.ok, body };
      } catch (e) {
        return { status: 0, ok: false, body: { error: String(e) } };
      }
    },
    makeSoroswap(apiKey) {
      return new SoroswapSDK({
        apiKey,
        defaultNetwork: SupportedNetworks.MAINNET,
      }) as unknown as SoroswapClient;
    },
  };
}

// ─── Quote / build — xBull ───────────────────────────────────────────────────

export async function quoteXbull(
  sellSac: string,
  buySac: string,
  fromAmount: bigint,
  deps: ExecDeps,
): Promise<{ venue: 'xbull'; netOut: bigint; route: string } | null> {
  const url =
    `${XBULL_BASE}/swaps/quote?fromAsset=${encodeURIComponent(sellSac)}` +
    `&toAsset=${encodeURIComponent(buySac)}&fromAmount=${fromAmount.toString()}&maxSteps=3`;
  const res = await deps.fetchJson(url);
  if (!res.ok) return null;
  const body = res.body as Record<string, unknown> | null;
  const toAmountRaw = body?.['toAmount'];
  if (toAmountRaw == null) return null;
  let netOut: bigint;
  try {
    netOut = BigInt(toAmountRaw as string | number);
  } catch {
    return null;
  }
  if (netOut <= 0n) return null;
  const route = typeof body?.['route'] === 'string' ? body['route'] : '';
  return { venue: 'xbull', netOut, route };
}

export async function buildXbull(
  route: string,
  sender: string,
  fromAmount: bigint,
  minToGet: bigint,
  deps: ExecDeps,
): Promise<{ id: string; xdr: string; type: 'full' | 'restore' }> {
  const res = await deps.fetchJson(`${XBULL_BASE}/swaps/accept-quote`, {
    method: 'POST',
    body: {
      sender,
      recipient: sender,
      fromAmount: fromAmount.toString(),
      minToGet: minToGet.toString(),
      route,
    },
  });
  if (!res.ok) {
    const body = res.body as Record<string, unknown> | null;
    const msg =
      (body?.['message'] as string | undefined) ??
      (body?.['error'] as string | undefined) ??
      JSON.stringify(body);
    throw new ExecError(classifyExecError(msg), msg);
  }
  const parsed = parseXbullAcceptQuote(res.body);
  if (!parsed) {
    throw new ExecError('down', `réponse accept-quote non parseable : ${JSON.stringify(res.body)}`);
  }
  return parsed;
}

// ─── Quote / build — Soroswap ────────────────────────────────────────────────

export async function quoteSoroswap(
  client: SoroswapClient,
  sellSac: string,
  buySac: string,
  amount: bigint,
  slippageBps: number,
): Promise<{ venue: 'soroswap'; netOut: bigint; minOut: bigint; soroPath?: string[]; quote: unknown } | null> {
  try {
    // ponytail: SOROSWAP uniquement — l'agrégateur multi-protocole produit des quotes gonflées non construisibles.
    const q = await client.quote({
      assetIn: sellSac,
      assetOut: buySac,
      amount,
      tradeType: TradeType.EXACT_IN,
      protocols: [SupportedProtocols.SOROSWAP],
      slippageBps,
    });
    // Le SDK type ces champs en bigint mais renvoie des NUMBER au runtime (pas de transformResponse)
    // → coercition explicite. BigInt() accepte number entier ET bigint, et lance sur un float (fail fast).
    const amountOut: bigint = BigInt(q?.amountOut ?? 0);
    if (amountOut <= 0n) return null;

    // amountOutMin : champ canonique du SDK (rawTrade pour EXACT_IN), = seuil min enforced dans le XDR.
    // Fallback sur minReceivedStroops si absent.
    const rawTradeMin: bigint | undefined =
      q?.rawTrade?.amountOutMin != null ? BigInt(q.rawTrade.amountOutMin) : undefined;
    const minOut: bigint =
      rawTradeMin !== undefined ? rawTradeMin : minReceivedStroops(amountOut, slippageBps);

    const soroPath: string[] | undefined = q?.routePlan?.[0]?.swapInfo?.path;

    return { venue: 'soroswap', netOut: amountOut, minOut, soroPath, quote: q };
  } catch {
    return null;
  }
}

export async function buildSoroswap(
  client: SoroswapClient,
  quote: unknown,
  sender: string,
): Promise<{ xdr: string }> {
  try {
    return await client.build({ quote, from: sender });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ExecError(classifyExecError(msg), msg);
  }
}

// ─── Quote / build / submit — Horizon (op native PathPaymentStrictSend) ──────
// Pas d'API d'agrégation : on construit le XDR nous-mêmes avec stellar-sdk depuis le
// chemin renvoyé par /paths/strict-send. Une tx classique ne se simule pas (≠ Soroban),
// donc le garde-fou pré-signature = vérif trustline de sortie sur le compte chargé.

interface HorizonPathRecord { asset_type?: string; asset_code?: string; asset_issuer?: string }
interface HorizonRecord { destination_amount?: string; path?: HorizonPathRecord[] }

/** Symboles lisibles des actifs intermédiaires d'un chemin Horizon (native → XLM). */
export function horizonPathSymbols(records: HorizonPathRecord[]): string[] {
  return records.map((r) => (r.asset_type === 'native' ? 'XLM' : r.asset_code ?? '?'));
}

function horizonSourceParams(a: Asset): Record<string, string> {
  if (a.native) return { source_asset_type: 'native' };
  return {
    source_asset_type: a.code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
    source_asset_code: a.code,
    source_asset_issuer: a.issuer as string,
  };
}

/** Re-cote live via Horizon strict-send : meilleur destination_amount + chemin structuré (pour le build). */
export async function quoteHorizon(
  sell: Asset,
  buy: Asset,
  fromAmount: bigint,
  deps: ExecDeps,
  horizonUrl?: string,
): Promise<{ venue: 'horizon'; netOut: bigint; path: HorizonPathRecord[] } | null> {
  const base = (horizonUrl || HORIZON_BASE_DEFAULT).replace(/\/$/, '');
  const sp = new URLSearchParams({
    ...horizonSourceParams(sell),
    source_amount: fromStroops(fromAmount),
    destination_assets: classicColon(buy),
  });
  const res = await deps.fetchJson(`${base}/paths/strict-send?${sp.toString()}`);
  if (!res.ok) return null;
  const records = (res.body as { _embedded?: { records?: HorizonRecord[] } } | null)?._embedded?.records;
  if (!Array.isArray(records) || records.length === 0) return null;
  let best: HorizonRecord | null = null;
  let bestNum = -1;
  for (const r of records) {
    const n = Number(r?.destination_amount);
    if (Number.isFinite(n) && n > bestNum) { best = r; bestNum = n; }
  }
  const netOut = stroopsOrNull(best?.destination_amount);
  if (netOut === null || netOut <= 0n) return null;
  return { venue: 'horizon', netOut, path: best?.path ?? [] };
}

/** Construit le XDR PathPaymentStrictSend (non signé). Pré-flight trustline → ExecError clair. */
export async function buildHorizon(
  sender: string,
  sell: Asset,
  buy: Asset,
  fromAmount: bigint,
  destMin: bigint,
  path: HorizonPathRecord[],
  horizonUrl?: string,
): Promise<{ xdr: string }> {
  const sdk = await import('@stellar/stellar-sdk');
  const { Horizon, TransactionBuilder, Operation, Asset: SdkAsset, Networks, BASE_FEE } = sdk;
  const server = new Horizon.Server((horizonUrl || HORIZON_BASE_DEFAULT).replace(/\/$/, ''));

  let account: Awaited<ReturnType<typeof server.loadAccount>>;
  try {
    account = await server.loadAccount(sender);
  } catch {
    throw new ExecError('funds', `compte ${sender} introuvable ou non financé`);
  }

  // Trustline de sortie présente ? (USDC/EURC ne sont jamais natifs)
  if (!buy.native && !account.balances.some(
    (b) => 'asset_code' in b && b.asset_code === buy.code && b.asset_issuer === buy.issuer,
  )) {
    throw new ExecError('trustline', `trustline ${buy.code} absente sur ${sender}`);
  }

  const toSdk = (a: Asset) => (a.native ? SdkAsset.native() : new SdkAsset(a.code, a.issuer as string));
  const pathAssets = path.map((r) =>
    r.asset_type === 'native' ? SdkAsset.native() : new SdkAsset(r.asset_code as string, r.asset_issuer as string),
  );

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
    .addOperation(Operation.pathPaymentStrictSend({
      sendAsset: toSdk(sell),
      sendAmount: fromStroops(fromAmount),
      destination: sender,
      destAsset: toSdk(buy),
      destMin: fromStroops(destMin),
      path: pathAssets,
    }))
    .setTimeout(180)
    .build();

  return { xdr: tx.toXDR() };
}

/** Codes d'erreur Horizon (extras.result_codes) → message lisible. */
function horizonResultCodes(e: unknown): string[] {
  const rc = (e as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } })
    ?.response?.data?.extras?.result_codes;
  if (!rc) return [];
  const ops = Array.isArray(rc.operations) ? rc.operations : [];
  return [rc.transaction ?? '', ...ops].filter(Boolean);
}

export function classifyHorizonSubmit(e: unknown): ExecError['code'] {
  const codes = horizonResultCodes(e).join(' ').toLowerCase();
  // Route consommée / prix bougé depuis la cote → re-coter (slippage, HTTP 400) et pas « indisponible » (502).
  if (codes.includes('under_dest_min') || codes.includes('too_few_offers') || codes.includes('cross_self')) return 'slippage';
  if (codes.includes('no_trust') || codes.includes('no_destination') || codes.includes('not_authorized')) return 'trustline';
  if (codes.includes('underfunded') || codes.includes('insufficient') || codes.includes('line_full')) return 'funds';
  return classifyExecError(codes || (e instanceof Error ? e.message : String(e)));
}

// ─── Orchestrateur principal ─────────────────────────────────────────────────

export async function pickExecutableVenue(
  target: 'USDC' | 'EURC',
  amountStroops: bigint,
  sender: string,
  slippageBps: number,
  cfg: { soroswapApiKey?: string; rpcUrl: string; horizonUrl?: string; timeoutMs?: number },
  displayed?: { winner?: string; net?: number },
  depsOverride?: Partial<ExecDeps>,
  forceVenue?: Venue,
): Promise<{ venue: Venue; xdr: string; id?: string; type: 'full' | 'restore' | 'swap'; review: ReviewData }> {
  const deps: ExecDeps = { ...defaultDeps(cfg.timeoutMs), ...depsOverride };
  const buyAsset = target === 'EURC' ? EURC : USDC;
  const sellSac = BLND.sac;
  const buySac = buyAsset.sac;

  // 1. Re-quote live en parallèle (tolérant : échec → null).
  const soroClient = cfg.soroswapApiKey ? deps.makeSoroswap(cfg.soroswapApiKey) : null;
  const [xbullQ, soroQ, horizonQ] = await Promise.all([
    quoteXbull(sellSac, buySac, amountStroops, deps),
    soroClient
      ? quoteSoroswap(soroClient, sellSac, buySac, amountStroops, slippageBps)
      : Promise.resolve(null),
    quoteHorizon(BLND, buyAsset, amountStroops, deps, cfg.horizonUrl),
  ]);

  // 2. Trier les candidats non-null par netOut décroissant.
  type Candidate =
    | { venue: 'xbull'; netOut: bigint; route: string }
    | { venue: 'soroswap'; netOut: bigint; minOut: bigint; soroPath?: string[]; quote: unknown }
    | { venue: 'horizon'; netOut: bigint; path: HorizonPathRecord[] };

  let candidates: Candidate[] = [];
  if (xbullQ) candidates.push(xbullQ);
  if (soroQ) candidates.push(soroQ);
  if (horizonQ) candidates.push(horizonQ);
  candidates.sort((a, b) => (a.netOut < b.netOut ? 1 : a.netOut > b.netOut ? -1 : 0));

  if (candidates.length === 0) {
    throw new ExecError('no-route', 'aucune route exécutable');
  }

  // Forçage d'un venue précis (click-to-select depuis l'UI)
  if (forceVenue !== undefined) {
    candidates = candidates.filter((c) => c.venue === forceVenue);
    if (candidates.length === 0) {
      throw new ExecError('no-route', 'venue choisi indisponible');
    }
  }

  // 3. Essayer de BUILD par ordre de netOut décroissant ; premier succès = gagnant.
  const errors: ExecError[] = [];

  for (const cand of candidates) {
    if (cand.venue === 'xbull') {
      try {
        const minToGet = minReceivedStroops(cand.netOut, slippageBps);
        const built = await buildXbull(cand.route, sender, amountStroops, minToGet, deps);
        const route = routeLabel('xbull', target);
        const review = reviewData({
          venue: 'xbull',
          target,
          type: built.type,
          sendStroops: amountStroops,
          netStroops: cand.netOut,
          minReceivedStroops: minToGet,
          slippageBps,
          route,
          displayed,
        });
        return { venue: 'xbull', xdr: built.xdr, id: built.id, type: built.type, review };
      } catch (e) {
        if (e instanceof ExecError) errors.push(e);
        continue;
      }
    } else if (cand.venue === 'horizon') {
      try {
        const destMin = minReceivedStroops(cand.netOut, slippageBps);
        const built = await buildHorizon(sender, BLND, buyAsset, amountStroops, destMin, cand.path, cfg.horizonUrl);
        const route = ['BLND', ...horizonPathSymbols(cand.path), target].join(' → ');
        const review = reviewData({
          venue: 'horizon',
          target,
          type: 'swap',
          sendStroops: amountStroops,
          netStroops: cand.netOut,
          minReceivedStroops: destMin,
          slippageBps,
          route,
          displayed,
        });
        return { venue: 'horizon', xdr: built.xdr, type: 'swap', review };
      } catch (e) {
        if (e instanceof ExecError) errors.push(e);
        continue;
      }
    } else {
      // soroswap
      if (!soroClient) continue;
      try {
        const built = await buildSoroswap(soroClient, cand.quote, sender);
        const route = routeLabel('soroswap', target, cand.soroPath);
        const review = reviewData({
          venue: 'soroswap',
          target,
          type: 'swap',
          sendStroops: amountStroops,
          netStroops: cand.netOut,
          minReceivedStroops: cand.minOut,
          slippageBps,
          route,
          displayed,
        });
        return { venue: 'soroswap', xdr: built.xdr, type: 'swap', review };
      } catch (e) {
        if (e instanceof ExecError) errors.push(e);
        continue;
      }
    }
  }

  // 4. Tous les builds ont échoué → priorité trustline > funds > slippage > down.
  const priority: ExecError['code'][] = ['trustline', 'funds', 'slippage', 'down'];
  for (const code of priority) {
    const found = errors.find((e) => e.code === code);
    if (found) throw found;
  }
  throw new ExecError('down', 'aucune route buildable');
}

// ─── Submit ───────────────────────────────────────────────────────────────────

export async function submit(
  venue: Venue,
  payload: { id?: string; signedXdr: string },
  cfg: { rpcUrl: string; horizonUrl?: string; soroswapApiKey?: string; timeoutMs?: number },
  depsOverride?: Partial<ExecDeps>,
): Promise<{ hash: string }> {
  const deps: ExecDeps = { ...defaultDeps(cfg.timeoutMs), ...depsOverride };

  if (venue === 'xbull') {
    const res = await deps.fetchJson(`${XBULL_BASE}/swaps/submit`, {
      method: 'POST',
      body: { id: payload.id, xdr: payload.signedXdr },
    });
    const body = res.body as Record<string, unknown> | null;
    if (!res.ok || body?.['success'] !== true) {
      const msg =
        (body?.['message'] as string | undefined) ??
        (body?.['error'] as string | undefined) ??
        JSON.stringify(body);
      throw new ExecError('down', msg);
    }
    return { hash: body['hash'] as string };
  } else if (venue === 'horizon') {
    // tx classique → soumission Horizon (gère l'encodage form + extraction d'erreur).
    const sdk = await import('@stellar/stellar-sdk');
    const { Horizon, TransactionBuilder, Networks } = sdk;
    const server = new Horizon.Server((cfg.horizonUrl || HORIZON_BASE_DEFAULT).replace(/\/$/, ''));
    try {
      const tx = TransactionBuilder.fromXDR(payload.signedXdr, Networks.PUBLIC);
      const r = await server.submitTransaction(tx as Parameters<typeof server.submitTransaction>[0]);
      return { hash: r.hash };
    } catch (e) {
      if (e instanceof ExecError) throw e;
      const codes = horizonResultCodes(e);
      const msg = codes.length ? `Horizon a rejeté la tx : ${codes.join(', ')}` : (e instanceof Error ? e.message : String(e));
      throw new ExecError(classifyHorizonSubmit(e), msg);
    }
  } else {
    const client = deps.makeSoroswap(cfg.soroswapApiKey!);
    try {
      const r = await client.send(payload.signedXdr);
      if (!r.success) throw new ExecError('down', `soroswap submit failed : txHash=${r.txHash}`);
      return { hash: r.txHash };
    } catch (e) {
      // Symétrie avec buildSoroswap : toute erreur SDK ressort en ExecError classée (jamais un 500 opaque post-signature).
      if (e instanceof ExecError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new ExecError(classifyExecError(msg), msg);
    }
  }
}
