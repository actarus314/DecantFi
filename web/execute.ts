// Orchestrateur d'exécution : BLND → USDC/EURC via xBull, Soroswap, Horizon ou Aquarius.
// Money-path : bigint stroops partout, jamais de float pour les calculs.
import { BLND, USDC, EURC, bySac, classicColon, type Asset } from '../core/assets.js';
import { decodeTransfers, routeFromTransfers, type Transfer } from '../core/soroban-route.js';
import { bumpRpc } from '../core/rpc-meter.js';
import { withTimeout } from '../core/timeout.js';
import { toNumber, fromStroops, toStroops } from '../core/amount.js';
import { stroopsOrNull, bigintOrNull } from '../core/sources/util.js';
import { COMET_POOL, COMET_WITNESSES, decodeCometOut } from '../core/sources/comet.js';
import { parseBlndBalance } from '../core/balance.js';
import { SoroswapSDK, SupportedNetworks, SupportedProtocols, TradeType } from '@soroswap/sdk';

/** Venues d'exécution branchées. Ajouter une venue = étendre cette union (et son cas de build/submit). */
export type Venue = 'xbull' | 'soroswap' | 'horizon' | 'aquarius' | 'comet' | 'ultrastellar';

// ─── User-Agent commun (xBull bloque l'UA Node par défaut) ──────────────────
const XBULL_UA = 'Mozilla/5.0 (compatible; DecantFi/0.1; +exec)';
const XBULL_BASE = 'https://swap.apis.xbull.app';
const HORIZON_BASE_DEFAULT = 'https://horizon.stellar.org';
const AQUA_ROUTER = 'CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK';
const AQUA_FINDPATH = 'https://amm-api.aqua.network/api/external/v1/find-path/';
const I128_MAX = 170141183460469231731687303715884105727n;
// Hard cap on a single Soroban simulateTransaction / xBull accept-quote call. Without it a stalled
// RPC connection hangs the caller forever — and a hung re-sim freezes the whole collector tick loop.
const SIM_TIMEOUT_MS = 15000;

// ─── Erreur typée ────────────────────────────────────────────────────────────

export class ExecError extends Error {
  constructor(
    public code: 'trustline' | 'funds' | 'slippage' | 'down' | 'no-route' | 'bad_request',
    message: string,
    /** Pour les erreurs trustline : le CODE de l'actif réellement manquant (USDC au leg1, EURC au leg2…).
     *  Indispensable au front pour ajouter/relancer la BONNE trustline (le `target` global ≠ l'actif de la jambe). */
    public asset?: string,
  ) {
    super(message);
    this.name = 'ExecError';
  }
}

/** Message d'erreur trustline actionnable : indique comment ajouter la trustline dans le wallet.
 *  Utiliser à la place de `new ExecError('trustline', ...)` partout où la trustline de sortie est absente. */
function trustlineMissingError(buy: Asset, sender: string): ExecError {
  return new ExecError(
    'trustline',
    `Trustline ${buy.code} (émetteur : ${buy.issuer}) absente sur le compte ${sender}. ` +
    `Pour l'ajouter : dans votre wallet (Freighter / LOBSTR), allez dans « Manage Assets » ` +
    `et ajoutez l'actif ${buy.code}. Coût : ~0,5 XLM de réserve immobilisée (opération changeTrust).`,
    buy.code,
  );
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

/** Spendable XLM = native balance − minimum reserve ((2 + subentries) × 0.5 XLM).
 *  Returns whether the declared max_fee exceeds it (the network locks max_fee at submission). */
export function feeExceedsSpendable(
  maxFeeStroops: number,
  nativeBalanceStroops: number,
  subentryCount: number,
): { exceeds: boolean; spendableStroops: number } {
  const BASE_RESERVE = 5_000_000; // 0.5 XLM in stroops
  const reserve = (2 + subentryCount) * BASE_RESERVE;
  const spendable = nativeBalanceStroops - reserve;
  return { exceeds: maxFeeStroops > spendable, spendableStroops: Math.max(0, spendable) };
}

/** Classification des erreurs d'exécution. Insensible à la casse. */
export function classifyExecError(message: string): 'trustline' | 'funds' | 'slippage' | 'down' {
  const m = message.toLowerCase();
  if (m.includes('trust')) return 'trustline';
  if (m.includes('fund') || m.includes('balance') || m.includes('enough') || m.includes('insufficient balance')) return 'funds';
  if (m.includes('slippage') || m.includes('routerinsufficientoutputamount') || m.includes('output amount')) return 'slippage';
  return 'down';
}

/** Static client-facing message per ExecError code — never leaks upstream SDK text. */
function safeExecMessage(code: ExecError['code']): string {
  switch (code) {
    case 'down':        return 'service indisponible';
    case 'slippage':    return 'slippage dépassé';
    case 'no-route':    return 'aucune route exécutable';
    case 'bad_request': return 'requête invalide';
    case 'funds':       return 'compte introuvable ou non financé';
    case 'trustline':   return 'trustline requise';
    default:            return "erreur d'exécution";
  }
}

/** Label de route lisible pour l'UI.
 *  Soroswap : chaque SAC → symbole via bySac (fallback C1234…7890).
 *  xBull : route décodée depuis la sim (simulateXbullNet) — plus de masque ☁. */
export function routeLabel(
  venue: 'xbull' | 'soroswap',
  target: 'USDC' | 'EURC',
  sorobanPath?: string[],
): string {
  if (venue === 'xbull') return `BLND → ${target}`;
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
  /** Frais réseau max (fee du XDR en XLM). Plafond autorisé par le wallet. */
  gasFeeXlm: number;
  /** Frais réseau réels estimés (resource fee Soroban de la simulation ; == gasFeeXlm pour une tx classique). */
  gasRealXlm?: number;
  /** Présent seulement si le net affiché au meta-agrégateur était supérieur à ce qu'on exécute. */
  fidelity?: { displayedWinner: string; displayedWinnerNet: number };
}

/** {max: fee totale autorisée, real: resource fee Soroban (coût réel estimé depuis la sim)}. Pour tx classique real==max. */
export async function xdrGasBreakdown(xdr: string): Promise<{ real: number; max: number }> {
  try {
    const { TransactionBuilder, Networks } = await import('@stellar/stellar-sdk');
    const tx = TransactionBuilder.fromXDR(xdr, Networks.PUBLIC);
    const max = Number(tx.fee) / 1e7;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const env = (tx as any).toEnvelope?.();
      const extVal = env?.v1?.()?.tx?.()?.ext?.();
      if (extVal?.switch?.() === 1) {
        const resourceFee = extVal?.sorobanData?.()?.resourceFee?.();
        if (resourceFee != null) return { real: Number(resourceFee) / 1e7, max };
      }
    } catch { /* tx classique sans sorobanData */ }
    return { real: max, max };
  } catch {
    return { real: 0, max: 0 };
  }
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
  gasFeeXlm: number;
  gasRealXlm?: number;
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
    gasFeeXlm: args.gasFeeXlm,
    gasRealXlm: args.gasRealXlm,
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

export type SendStatus = 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR';

/** Client RPC Soroban minimal pour le fire-and-poll. Injectable → tests hermétiques. */
export interface SorobanRpcClient {
  /** FIRE : envoie le XDR signé ; rend le statut d'admission mempool + le hash. */
  send(signedXdr: string): Promise<{ status: SendStatus; hash: string; errorResult?: unknown }>;
  /** POLL : statut on-chain d'une tx par hash. */
  status(hash: string): Promise<{ status: 'SUCCESS' | 'NOT_FOUND' | 'FAILED' }>;
}

export interface ExecDeps {
  fetchJson: (url: string, init?: { method?: string; body?: unknown }) => Promise<FetchResult>;
  makeSoroswap: (apiKey: string) => SoroswapClient;
  /** Cotation Comet : simulation read-only de swap_exact_amount_in (sortie indépendante du user). Injectable → tests hermétiques. */
  simulateComet: (a: { sellSac: string; buySac: string; amountIn: bigint; rpcUrl: string }) => Promise<bigint | null>;
  /** xBull net simulation via accept-quote + simulateTransaction. Injectable → hermetic tests. */
  simulateXbullNet: (a: { route: string; amountIn: bigint; rpcUrl: string }) => Promise<{ net: bigint; route: string[]; transfers: Transfer[] } | null>;
  /** Client RPC Soroban (fire-and-poll : sendTransaction + getTransaction). Injectable → tests hermétiques. */
  makeRpc: (rpcUrl: string) => SorobanRpcClient;
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
    simulateComet: simulateCometReal,
    simulateXbullNet: (a) => simulateXbullNet(a.route, a.amountIn, { rpcUrl: a.rpcUrl }),
    makeRpc: makeRpcReal,
  };
}

/** Implémentation réelle du client RPC Soroban (fire-and-poll). Import SDK paresseux + timeout par appel. */
function makeRpcReal(rpcUrl: string): SorobanRpcClient {
  const base = rpcUrl.replace(/\/$/, '');
  return {
    async send(signedXdr) {
      const { rpc, TransactionBuilder, Networks } = await import('@stellar/stellar-sdk');
      const server = new rpc.Server(base);
      const tx = TransactionBuilder.fromXDR(signedXdr, Networks.PUBLIC);
      const sent = await withTimeout(server.sendTransaction(tx), SIM_TIMEOUT_MS, 'soroban send');
      return { status: sent.status as SendStatus, hash: sent.hash, errorResult: (sent as { errorResult?: unknown }).errorResult };
    },
    async status(hash) {
      const { rpc } = await import('@stellar/stellar-sdk');
      const server = new rpc.Server(base);
      const got = await withTimeout(server.getTransaction(hash), SIM_TIMEOUT_MS, 'soroban status');
      return { status: got.status as 'SUCCESS' | 'NOT_FOUND' | 'FAILED' };
    },
  };
}

/** Cotation Comet read-only : simule swap_exact_amount_in avec la liste de témoins COMET_WITNESSES
 *  (la sortie ne dépend QUE des réserves du pool, pas du user). Prend le 1er témoin dont la sim passe.
 *  null si tous les témoins échouent ou si le pool est absent. Calque core/sources/comet.ts. */
async function simulateCometReal(a: { sellSac: string; buySac: string; amountIn: bigint; rpcUrl: string }): Promise<bigint | null> {
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks, Account, Contract, scValToNative, nativeToScVal } = sdk;
  const server = new rpc.Server((a.rpcUrl || 'https://mainnet.sorobanrpc.com').replace(/\/$/, ''));
  for (const user of COMET_WITNESSES) {
    const args = [
      new Address(a.sellSac).toScVal(),
      nativeToScVal(a.amountIn, { type: 'i128' }),
      new Address(a.buySac).toScVal(),
      nativeToScVal(0n, { type: 'i128' }),
      nativeToScVal(I128_MAX, { type: 'i128' }),
      new Address(user).toScVal(),
    ];
    const tx = new TransactionBuilder(new Account(user, '0'), { fee: '100', networkPassphrase: Networks.PUBLIC })
      .addOperation(new Contract(COMET_POOL).call('swap_exact_amount_in', ...args))
      .setTimeout(30)
      .build();
    bumpRpc();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim) || !sim.result) continue;
    return decodeCometOut(scValToNative(sim.result.retval));
  }
  return null;
}

// ─── Simulation Aquarius read-only ───────────────────────────────────────────

/** Témoins BLND ayant assez de liquidité pour simuler swap_chained (le solde n'est pas touché). */
export const AQUARIUS_WITNESSES = [
  'GCA34HBKNLWN3AOXWBRW5Y3HSGHCWF3UDBRJ5YHGU6HWGJZEPO2NSXI3',
  'GBBF7X4FQ3HGRIDSNQ2HOPS6BP7ZERJN22Y54O5WAOAK4CAA4FV3K3G2',
  'GC7IUIQ7R6NOIFNB4PYFNVYVNHSLJIULSWQTXG7UK33UTIC6NSZIW2BC',
];

/** Simule swap_chained Aquarius avec out_min=0 pour obtenir le net réel (sans revert de slippage).
 *  null si tous les témoins échouent ou si le XDR n'est pas décodable. */
export async function simulateAquariusNet(
  swapChainXdr: string,
  amountIn: bigint,
  inputSac: string,
  cfg: { rpcUrl: string },
): Promise<bigint | null> {
  const resolvedCfg = cfg;
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks, Account, Contract, scValToNative, nativeToScVal, xdr } = sdk;

  let swapsChain: ReturnType<typeof xdr.ScVal.fromXDR>;
  try {
    swapsChain = xdr.ScVal.fromXDR(swapChainXdr, 'base64');
  } catch {
    return null;
  }

  const server = new rpc.Server((resolvedCfg.rpcUrl || 'https://mainnet.sorobanrpc.com').replace(/\/$/, ''));
  for (const witness of AQUARIUS_WITNESSES) {
    const args = [
      Address.fromString(witness).toScVal(),
      swapsChain,
      Address.fromString(inputSac).toScVal(),
      nativeToScVal(amountIn, { type: 'u128' }),
      nativeToScVal(0n, { type: 'u128' }),
    ];
    const tx = new TransactionBuilder(new Account(witness, '0'), { fee: '10000', networkPassphrase: Networks.PUBLIC })
      .addOperation(new Contract(AQUA_ROUTER).call('swap_chained', ...args))
      .setTimeout(180)
      .build();
    bumpRpc();
    const sim = await withTimeout(server.simulateTransaction(tx), SIM_TIMEOUT_MS, 'aquarius sim');
    if (rpc.Api.isSimulationError(sim) || !sim.result) continue;
    try { return BigInt(scValToNative(sim.result.retval)); } catch { return null; }
  }
  return null;
}

/** Simule xBull via accept-quote (minToGet='0') pour obtenir le vrai fill net (sans le skim de 0,1 %).
 *  Réutilise AQUARIUS_WITNESSES : comptes témoins communs (BLND + USDC + EURC trustlines, grands soldes).
 *  Extrait également la route réelle depuis la chaîne de transferts SAC des events de simulation.
 *  null si tous les témoins échouent ou si le XDR n'est pas simulable. */
export async function simulateXbullNet(
  route: string,
  amountIn: bigint,
  cfg: { rpcUrl: string },
): Promise<{ net: bigint; route: string[]; transfers: Transfer[]; gasRealXlm?: number } | null> {
  for (const witness of AQUARIUS_WITNESSES) {
    let xdrStr: string;
    try {
      const res = await fetch(`${XBULL_BASE}/swaps/accept-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': XBULL_UA,
        },
        body: JSON.stringify({ sender: witness, recipient: witness, fromAmount: amountIn.toString(), minToGet: '0', route }),
        signal: AbortSignal.timeout(SIM_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as Record<string, unknown>;
      if (typeof body['xdr'] !== 'string') continue;
      xdrStr = body['xdr'];
    } catch {
      continue;
    }
    try {
      const sdk = await import('@stellar/stellar-sdk');
      const { rpc, TransactionBuilder, Networks, scValToNative } = sdk;
      const server = new rpc.Server((cfg.rpcUrl || 'https://mainnet.sorobanrpc.com').replace(/\/$/, ''));
      const tx = TransactionBuilder.fromXDR(xdrStr, Networks.PUBLIC);
      bumpRpc();
      const sim = await withTimeout(server.simulateTransaction(tx), SIM_TIMEOUT_MS, 'xbull sim');
      if (rpc.Api.isSimulationError(sim) || !sim.result) continue;
      const rv = scValToNative(sim.result.retval);
      if (!Array.isArray(rv) || rv.length < 2) continue;
      const net = BigInt(rv[1]);
      // Extraction de la route réelle depuis la chaîne de transferts SAC
      const transfers = await decodeTransfers((sim as any).events ?? []);
      const decodedRoute = routeFromTransfers(transfers);
      // Extract real Soroban resource fee from the accept-quote XDR (rent/TTL cost, not the default flat).
      const gasBreakdown = await xdrGasBreakdown(xdrStr).catch(() => null);
      const gasRealXlm = gasBreakdown ? gasBreakdown.real : undefined;
      return { net, route: decodedRoute.length >= 2 ? decodedRoute : [], transfers, gasRealXlm };
    } catch {
      continue;
    }
  }
  return null;
}

/** Simule swap_chained Aquarius et retourne les Transfer[] bruts (pour la sonde de cohérence).
 *  Même logique que simulateAquariusNet mais retourne les events décodés au lieu du retval.
 *  null si tous les témoins échouent ou si le XDR n'est pas décodable. */
export async function simulateAquariusTransfers(
  swapChainXdr: string,
  amountIn: bigint,
  cfg: { rpcUrl: string },
): Promise<Transfer[] | null> {
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks, Account, Contract, nativeToScVal, xdr } = sdk;

  let swapsChain: ReturnType<typeof xdr.ScVal.fromXDR>;
  try {
    swapsChain = xdr.ScVal.fromXDR(swapChainXdr, 'base64');
  } catch {
    return null;
  }

  const server = new rpc.Server((cfg.rpcUrl || 'https://mainnet.sorobanrpc.com').replace(/\/$/, ''));
  for (const witness of AQUARIUS_WITNESSES) {
    const args = [
      Address.fromString(witness).toScVal(),
      swapsChain,
      Address.fromString(BLND.sac!).toScVal(),
      nativeToScVal(amountIn, { type: 'u128' }),
      nativeToScVal(0n, { type: 'u128' }),
    ];
    const tx = new TransactionBuilder(new Account(witness, '0'), { fee: '10000', networkPassphrase: Networks.PUBLIC })
      .addOperation(new Contract(AQUA_ROUTER).call('swap_chained', ...args))
      .setTimeout(180)
      .build();
    bumpRpc();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim) || !sim.result) continue;
    return decodeTransfers((sim as any).events ?? []);
  }
  return null;
}

/** Simule un swap Soroswap et retourne les Transfer[] bruts (pour la sonde de cohérence).
 *  Construit le XDR via buildSoroswap puis simule sans préparer (simulateTransaction).
 *  null si le build échoue ou si la simulation échoue. */
export async function simulateSoroswapTransfers(
  client: SoroswapClient,
  quote: unknown,
  sender: string,
  cfg: { rpcUrl: string },
): Promise<Transfer[] | null> {
  try {
    const { xdr: xdrStr } = await buildSoroswap(client, quote, sender);
    const sdk = await import('@stellar/stellar-sdk');
    const { rpc, TransactionBuilder, Networks } = sdk;
    const tx = TransactionBuilder.fromXDR(xdrStr, Networks.PUBLIC);
    const server = new rpc.Server((cfg.rpcUrl || 'https://mainnet.sorobanrpc.com').replace(/\/$/, ''));
    bumpRpc();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim) || !sim.result) return null;
    return decodeTransfers((sim as any).events ?? []);
  } catch {
    return null;
  }
}

/** Simule swap_exact_amount_in Comet et retourne les Transfer[] bruts (pour la sonde de cohérence).
 *  Calque simulateCometReal mais retourne les events décodés au lieu du net.
 *  null si tous les témoins échouent. */
export async function simulateCometTransfers(a: {
  sellSac: string;
  buySac: string;
  amountIn: bigint;
  rpcUrl: string;
}): Promise<Transfer[] | null> {
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks, Account, Contract, nativeToScVal } = sdk;
  const server = new rpc.Server((a.rpcUrl || 'https://mainnet.sorobanrpc.com').replace(/\/$/, ''));
  for (const user of COMET_WITNESSES) {
    const args = [
      new Address(a.sellSac).toScVal(),
      nativeToScVal(a.amountIn, { type: 'i128' }),
      new Address(a.buySac).toScVal(),
      nativeToScVal(0n, { type: 'i128' }),
      nativeToScVal(I128_MAX, { type: 'i128' }),
      new Address(user).toScVal(),
    ];
    const tx = new TransactionBuilder(new Account(user, '0'), { fee: '100', networkPassphrase: Networks.PUBLIC })
      .addOperation(new Contract(COMET_POOL).call('swap_exact_amount_in', ...args))
      .setTimeout(30)
      .build();
    bumpRpc();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim) || !sim.result) continue;
    return decodeTransfers((sim as any).events ?? []);
  }
  return null;
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
    const raw =
      (body?.['message'] as string | undefined) ??
      (body?.['error'] as string | undefined) ??
      JSON.stringify(body);
    process.stderr.write(`ExecError raw: ${raw}\n`);
    const code = classifyExecError(raw);
    throw new ExecError(code, safeExecMessage(code));
  }
  const parsed = parseXbullAcceptQuote(res.body);
  if (!parsed) {
    process.stderr.write(`ExecError raw: réponse accept-quote non parseable : ${JSON.stringify(res.body)}\n`);
    throw new ExecError('down', safeExecMessage('down'));
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
    // SOROSWAP uniquement — vérifié empiriquement 2026-06-24 (cote vs vrai fill simulé, la méthode qui a
    // démystifié xBull) : protocols multi (PHOENIX/AQUA/SDEX) renvoie des routes Aqua aux cotes absurdes
    // (USDC→EURC +2261 %, BLND→EURC +124 %) qui ÉCHOUENT au build ('Invalid poolHashes', bug @soroswap/sdk
    // 0.4.0). Bug du SDK off-chain, pas du contrat on-chain ; et la liquidité Aqua est déjà captée honnêtement
    // par l'adaptateur Aquarius keyless (find-path, 100 % fill). Ne PAS réactiver multi sans re-vérifier.
    const q = await client.quote({
      assetIn: sellSac,
      assetOut: buySac,
      amount,
      tradeType: TradeType.EXACT_IN,
      protocols: [SupportedProtocols.SOROSWAP],
      slippageBps,
      // ponytail: parité avec le collecteur (core/sources/soroswap.ts maxHops:2). No-op aujourd'hui
      // (l'API route déjà BLND→USDC→EURC) mais épingle le multi-hop : empêche une dégradation
      // silencieuse vers le pool direct BLND/EURC minuscule si le défaut de l'API changeait.
      maxHops: 2,
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
    const raw = e instanceof Error ? e.message : String(e);
    process.stderr.write(`ExecError raw: ${raw}\n`);
    const code = classifyExecError(raw);
    throw new ExecError(code, safeExecMessage(code));
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
    throw trustlineMissingError(buy, sender);
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

// ─── Quote / build / submit — Aquarius (contrat Soroban swap_chained) ────────
// find-path API rend swap_chain_xdr (= arg swaps_chain sérialisé, à décoder tel quel) +
// amount_with_fee (net stroops bruts) + tokens (route). Build via stellar-sdk + prepareTransaction
// (Soroban EST simulable, ≠ Horizon). Pré-flight trustline = message clair (la sim l'attraperait aussi).

/** Symboles lisibles d'une route Aquarius. tokens find-path : 'native' (→XLM) ou 'CODE:ISSUER'. */
export function aquariusPathSymbols(tokens: string[]): string[] {
  return tokens.map((t) => (t === 'native' ? 'XLM' : t.split(':')[0] ?? t));
}

/** Re-cote live via Aquarius find-path : net (amount_with_fee) + swap_chain_xdr + route. */
export async function quoteAquarius(
  sellSac: string,
  buySac: string,
  fromAmount: bigint,
  deps: ExecDeps,
): Promise<{ venue: 'aquarius'; netOut: bigint; swapChainXdr: string; tokens: string[] } | null> {
  const res = await deps.fetchJson(AQUA_FINDPATH, {
    method: 'POST',
    body: { token_in_address: sellSac, token_out_address: buySac, amount: fromAmount.toString() },
  });
  if (!res.ok) return null;
  const b = res.body as
    | { success?: boolean; amount?: string | number; amount_with_fee?: string | number; swap_chain_xdr?: string; tokens?: string[] }
    | null;
  if (!b || b.success === false) return null;
  const netOut = bigintOrNull(b.amount_with_fee ?? b.amount);
  if (netOut === null || netOut <= 0n) return null;
  if (typeof b.swap_chain_xdr !== 'string' || b.swap_chain_xdr.length === 0) return null;
  return { venue: 'aquarius', netOut, swapChainXdr: b.swap_chain_xdr, tokens: b.tokens ?? [] };
}

/** Construit + simule (prepareTransaction) l'appel swap_chained → XDR prêt à signer.
 *  user == sender == source : l'auth Soroban du compte source est couverte par la signature de la tx. */
export async function buildAquarius(
  sender: string,
  buy: Asset,
  tokenInSac: string,
  fromAmount: bigint,
  outMin: bigint,
  swapChainXdr: string,
  cfg: { rpcUrl: string; horizonUrl?: string },
): Promise<{ xdr: string }> {
  const sdk = await import('@stellar/stellar-sdk');
  const { Horizon, rpc, TransactionBuilder, Contract, Address, Networks, nativeToScVal, xdr } = sdk;
  const horizon = new Horizon.Server((cfg.horizonUrl || HORIZON_BASE_DEFAULT).replace(/\/$/, ''));

  let account: Awaited<ReturnType<typeof horizon.loadAccount>>;
  try {
    account = await horizon.loadAccount(sender);
  } catch {
    throw new ExecError('funds', `compte ${sender} introuvable ou non financé`);
  }
  if (!buy.native && !account.balances.some(
    (b) => 'asset_code' in b && b.asset_code === buy.code && b.asset_issuer === buy.issuer,
  )) {
    throw trustlineMissingError(buy, sender);
  }

  let swapsChain: ReturnType<typeof xdr.ScVal.fromXDR>;
  try {
    swapsChain = xdr.ScVal.fromXDR(swapChainXdr, 'base64');
  } catch {
    throw new ExecError('no-route', 'swap_chain_xdr Aquarius non décodable');
  }

  const tx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.PUBLIC })
    .addOperation(new Contract(AQUA_ROUTER).call(
      'swap_chained',
      Address.fromString(sender).toScVal(),
      swapsChain,
      Address.fromString(tokenInSac).toScVal(),
      nativeToScVal(fromAmount, { type: 'u128' }),
      nativeToScVal(outMin, { type: 'u128' }),
    ))
    .setTimeout(180)
    .build();

  const server = new rpc.Server(cfg.rpcUrl.replace(/\/$/, ''));
  try {
    const prepared = await server.prepareTransaction(tx);
    return { xdr: prepared.toXDR() };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    process.stderr.write(`ExecError raw: ${raw}\n`);
    // #2006 = revert du routeur Aquarius quand la sortie simulée < out_min : la route find-path a
    // sur-coté, elle ne tient pas au slippage demandé (≠ panne, ≠ fonds). Classer en slippage → message actionnable.
    if (raw.includes('#2006')) throw new ExecError('slippage', safeExecMessage('slippage'));
    const code = classifyExecError(raw);
    throw new ExecError(code, safeExecMessage(code));
  }
}

// ─── Quote / build — Comet (contrat pool backstop swap_exact_amount_in) ──────
// Pool Soroban BLND/USDC UNIQUEMENT (CAS3FL6T…). Cotation = simulation read-only avec COMET_WITNESSES
// (sortie indépendante du user). Build avec le vrai sender : prepareTransaction enforce le
// CAVEAT DUR = le sender doit détenir du BLND LIQUIDE (souvent staké dans le backstop → message clair).

/** Re-cote Comet via simulation (deps.simulateComet, injectable). null si pool absent / sim KO. */
export async function quoteComet(
  deps: ExecDeps,
  sellSac: string,
  buySac: string,
  amountIn: bigint,
  rpcUrl: string,
): Promise<{ venue: 'comet'; netOut: bigint } | null> {
  const out = await deps.simulateComet({ sellSac, buySac, amountIn, rpcUrl });
  if (out === null || out <= 0n) return null;
  return { venue: 'comet', netOut: out };
}

/** Construit + simule (prepareTransaction) l'appel swap_exact_amount_in → XDR prêt à signer.
 *  Pré-flight trustline USDC + BLND liquide (caveat backstop) pour des messages clairs.
 *  user == sender == source : l'auth Soroban du transfer BLND est couverte par la signature de la tx. */
export async function buildComet(
  sender: string,
  amountIn: bigint,
  outMin: bigint,
  cfg: { rpcUrl: string; horizonUrl?: string },
): Promise<{ xdr: string }> {
  const sdk = await import('@stellar/stellar-sdk');
  const { Horizon, rpc, TransactionBuilder, Contract, Address, Networks, nativeToScVal } = sdk;
  const horizon = new Horizon.Server((cfg.horizonUrl || HORIZON_BASE_DEFAULT).replace(/\/$/, ''));

  let account: Awaited<ReturnType<typeof horizon.loadAccount>>;
  try {
    account = await horizon.loadAccount(sender);
  } catch {
    throw new ExecError('funds', `compte ${sender} introuvable ou non financé`);
  }
  // Trustline USDC de sortie (Comet = BLND→USDC uniquement).
  if (!account.balances.some(
    (b) => 'asset_code' in b && b.asset_code === USDC.code && b.asset_issuer === USDC.issuer,
  )) {
    throw trustlineMissingError(USDC, sender);
  }
  const tx = new TransactionBuilder(account, { fee: '10000', networkPassphrase: Networks.PUBLIC })
    .addOperation(new Contract(COMET_POOL).call(
      'swap_exact_amount_in',
      new Address(BLND.sac).toScVal(),
      nativeToScVal(amountIn, { type: 'i128' }),
      new Address(USDC.sac).toScVal(),
      nativeToScVal(outMin, { type: 'i128' }),
      nativeToScVal(I128_MAX, { type: 'i128' }),
      new Address(sender).toScVal(),
    ))
    .setTimeout(180)
    .build();

  const server = new rpc.Server(cfg.rpcUrl.replace(/\/$/, ''));
  try {
    const prepared = await server.prepareTransaction(tx);
    return { xdr: prepared.toXDR() };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    process.stderr.write(`ExecError raw: ${raw}\n`);
    const code = classifyExecError(raw);
    throw new ExecError(code, safeExecMessage(code));
  }
}

// ─── Quote / build / submit — Ultra Stellar (split SDEX multi-op classique) ──
// Ultra ne rend PAS de build : on construit nous-mêmes N PathPaymentStrictSend (1 par jambe du split
// extended_paths[]) dans UNE tx classique atomique (1 signature). SDEX only (pas de liquidité Soroban)
// → perd quasi toujours la sélection compétitive ; venue de complétude (click-to-select). Les actifs
// intermédiaires (AQUA/yXLM/…) n'exigent PAS de trustline (path payment) ; seule la sortie en exige une.
// Submit = identique à Horizon (tx classique).

const ULTRA_ROUTING = 'https://routing.ultrastellar.com/.netlify/functions/v1/smart-routing';

export interface UltraLeg {
  sendStroops: bigint;       // sourceAmount (BLND) en stroops
  destStroops: bigint;       // destinationAmount (cible) en stroops
  path: HorizonPathRecord[]; // intermédiaires (réutilise le type Horizon)
}

function ultraAssetParam(a: Asset): string {
  return a.native ? 'native' : classicColon(a);
}

/** Parse la réponse smart-routing → jambes + net. null si aucune jambe valide. */
export function parseUltraQuote(raw: unknown): { netOut: bigint; legs: UltraLeg[] } | null {
  const j = raw as { optimized_sum?: string | number; extended_paths?: Array<{ sourceAmount?: string | number; destinationAmount?: string | number; path?: HorizonPathRecord[] }> } | null;
  const legs: UltraLeg[] = [];
  for (const p of j?.extended_paths ?? []) {
    try {
      const sendStroops = toStroops(p?.sourceAmount ?? '');
      const destStroops = toStroops(p?.destinationAmount ?? '');
      if (sendStroops > 0n && destStroops > 0n) {
        legs.push({ sendStroops, destStroops, path: Array.isArray(p?.path) ? p.path : [] });
      }
    } catch { /* jambe malformée → ignorée */ }
  }
  if (legs.length === 0) return null;
  // net = Σ des sorties par jambe RETENUE (≡ optimized_sum quand rien n'est droppé, vérifié live).
  // On ne lit PAS optimized_sum : si une jambe est ignorée (malformée / arrondie à 0), le net affiché
  // doit refléter ce qu'on construit réellement — sinon net inflaté vs exécuté = « mensonge » non signalé.
  const netOut = legs.reduce((s, l) => s + l.destStroops, 0n);
  return { netOut, legs };
}

/** Re-cote live via Ultra smart-routing (param 'fee' OMIS volontairement : fee=0 rejeté = la brute). */
export async function quoteUltra(
  sell: Asset,
  buy: Asset,
  fromAmount: bigint,
  deps: ExecDeps,
): Promise<{ venue: 'ultrastellar'; netOut: bigint; legs: UltraLeg[] } | null> {
  const sp = new URLSearchParams({
    source: ultraAssetParam(sell),
    destination: ultraAssetParam(buy),
    amount: fromStroops(fromAmount),
    type: 'send',
  });
  const res = await deps.fetchJson(`${ULTRA_ROUTING}?${sp.toString()}`);
  if (!res.ok) return null;
  const parsed = parseUltraQuote(res.body);
  if (!parsed) return null;
  return { venue: 'ultrastellar', netOut: parsed.netOut, legs: parsed.legs };
}

/** Ajuste les jambes pour que Σ sendStroops == total exact (résidu → plus grande jambe).
 *  Garde-fou money-path : la conversion float→stroops peut dériver ; on n'envoie jamais un total ≠ l'input. */
export function reconcileLegSends(sends: bigint[], total: bigint): bigint[] {
  if (sends.length === 0) return sends;
  const sum = sends.reduce((a, b) => a + b, 0n);
  const residual = total - sum;
  if (residual === 0n) return sends.slice();
  let maxI = 0;
  for (let i = 1; i < sends.length; i++) if (sends[i]! > sends[maxI]!) maxI = i;
  const out = sends.slice();
  out[maxI] = out[maxI]! + residual;
  if (out[maxI]! <= 0n) throw new ExecError('no-route', 'jambe Ultra négative après réconciliation');
  return out;
}

/** Construit la tx classique multi-op (N PathPaymentStrictSend). Pré-flight trustline de sortie
 *  (tx classique non simulable, comme Horizon). destMin par jambe = floor slippage de leg.destStroops. */
export async function buildUltra(
  sender: string,
  sell: Asset,
  buy: Asset,
  legs: UltraLeg[],
  fromAmount: bigint,
  slippageBps: number,
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
  if (!buy.native && !account.balances.some(
    (b) => 'asset_code' in b && b.asset_code === buy.code && b.asset_issuer === buy.issuer,
  )) {
    throw trustlineMissingError(buy, sender);
  }

  const sends = reconcileLegSends(legs.map((l) => l.sendStroops), fromAmount);
  const toSdk = (a: Asset) => (a.native ? SdkAsset.native() : new SdkAsset(a.code, a.issuer as string));
  const pathAssets = (recs: HorizonPathRecord[]) =>
    recs.map((r) => (r.asset_type === 'native' ? SdkAsset.native() : new SdkAsset(r.asset_code as string, r.asset_issuer as string)));

  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC });
  legs.forEach((leg, i) => {
    builder.addOperation(Operation.pathPaymentStrictSend({
      sendAsset: toSdk(sell),
      sendAmount: fromStroops(sends[i]!),
      destination: sender,
      destAsset: toSdk(buy),
      destMin: fromStroops(minReceivedStroops(leg.destStroops, slippageBps)),
      path: pathAssets(leg.path),
    }));
  });
  const tx = builder.setTimeout(180).build();
  return { xdr: tx.toXDR() };
}

// ─── Trustline (pré-flight + ajout in-app) ───────────────────────────────────

/** Pré-flight : charge le compte une seule fois pour vérifier la trustline ET le solde liquide de sellAsset.
 *  trustline : true/false ou null si lecture impossible (compte introuvable / Horizon en panne).
 *  liquid    : solde liquide de sellAsset en stroops, ou null si lecture impossible.
 *  → null = on laisse les builds gérer, pas de faux-positif. */
async function senderPreflight(
  sender: string,
  sellAsset: Asset,
  buy: Asset,
  horizonUrl?: string,
): Promise<{ trustline: boolean | null; liquid: bigint | null }> {
  try {
    const sdk = await import('@stellar/stellar-sdk');
    const { Horizon } = sdk;
    const server = new Horizon.Server((horizonUrl || HORIZON_BASE_DEFAULT).replace(/\/$/, ''));
    const account = await server.loadAccount(sender);
    const trustline = buy.native
      ? true
      : account.balances.some((b) => 'asset_code' in b && b.asset_code === buy.code && b.asset_issuer === buy.issuer);
    // Solde liquide de l'actif vendu (pas forcément BLND)
    const sellBal = account.balances.find(
      (b) => 'asset_code' in b && b.asset_code === sellAsset.code && b.asset_issuer === sellAsset.issuer,
    );
    const liquid = sellBal && 'balance' in sellBal
      ? BigInt(Math.round(parseFloat(sellBal.balance) * 1e7))
      : sellAsset.code === 'BLND'
        ? parseBlndBalance({ balances: account.balances })
        : null;
    return { trustline, liquid };
  } catch {
    return { trustline: null, liquid: null };
  }
}

/** Construit le XDR changeTrust (non signé) pour ajouter la trustline de l'actif d'achat.
 *  Limite par défaut = max (réception illimitée). Soumis ensuite via la voie classique Horizon (submit horizon). */
export async function buildChangeTrust(sender: string, buy: Asset, horizonUrl?: string): Promise<{ xdr: string }> {
  if (buy.native) throw new ExecError('no-route', 'actif natif : aucune trustline requise');
  const sdk = await import('@stellar/stellar-sdk');
  const { Horizon, TransactionBuilder, Operation, Asset: SdkAsset, Networks, BASE_FEE } = sdk;
  const server = new Horizon.Server((horizonUrl || HORIZON_BASE_DEFAULT).replace(/\/$/, ''));
  let account: Awaited<ReturnType<typeof server.loadAccount>>;
  try {
    account = await server.loadAccount(sender);
  } catch {
    throw new ExecError('funds', `compte ${sender} introuvable ou non financé`);
  }
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
    .addOperation(Operation.changeTrust({ asset: new SdkAsset(buy.code, buy.issuer as string) }))
    .setTimeout(180)
    .build();
  return { xdr: tx.toXDR() };
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
  sellAsset: Asset = BLND,
): Promise<{ venue: Venue; xdr: string; id?: string; type: 'full' | 'restore' | 'swap'; review: ReviewData }> {
  const deps: ExecDeps = { ...defaultDeps(cfg.timeoutMs), ...depsOverride };
  const buyAsset = target === 'EURC' ? EURC : USDC;
  const sellSac = sellAsset.sac;
  const buySac = buyAsset.sac;

  // 1. Re-quote live en parallèle (tolérant : échec → null) + pré-flight trustline (parallèle → zéro latence ajoutée).
  const soroClient = cfg.soroswapApiKey ? deps.makeSoroswap(cfg.soroswapApiKey) : null;
  const [preflight, xbullQ, soroQ, horizonQ, aquariusQ, cometQ, ultraQ] = await Promise.all([
    senderPreflight(sender, sellAsset, buyAsset, cfg.horizonUrl),
    quoteXbull(sellSac, buySac, amountStroops, deps),
    soroClient
      ? quoteSoroswap(soroClient, sellSac, buySac, amountStroops, slippageBps)
      : Promise.resolve(null),
    quoteHorizon(sellAsset, buyAsset, amountStroops, deps, cfg.horizonUrl),
    quoteAquarius(sellSac, buySac, amountStroops, deps),
    // Comet = pool BLND/USDC uniquement : pas de cotation si sellAsset ≠ BLND ou target ≠ USDC.
    sellAsset === BLND && target === 'USDC' ? quoteComet(deps, sellSac, buySac, amountStroops, cfg.rpcUrl) : Promise.resolve(null),
    quoteUltra(sellAsset, buyAsset, amountStroops, deps),
  ]);

  const { trustline, liquid } = preflight;

  // Pré-flight trustline UNIVERSEL : si le sender n'a pas la trustline de l'actif d'achat, échouer
  // clairement ICI (avant tout build) → couvre AUSSI les venues turnkey xBull/Soroswap dont l'erreur
  // trustline ne remontait pas classée (« source indisponible » trompeur). null = lecture KO → builds gèrent.
  if (trustline === false) throw trustlineMissingError(buyAsset, sender);

  // Pré-flight solde UNIVERSEL : si le BLND liquide est insuffisant, échouer ICI (avant tout build/popup)
  // → comportement uniforme pour toutes les venues (les classiques Horizon/Ultra n'atteignent plus Freighter
  //   pour échouer ensuite à la soumission). liquid null = lecture KO → on laisse les builds gérer.
  if (liquid !== null && liquid < amountStroops) {
    if (sellAsset.code === 'BLND') {
      throw new ExecError('funds',
        `BLND liquide insuffisant (${fromStroops(liquid)} dispo, ${fromStroops(amountStroops)} requis) — ` +
        `ton BLND est peut-être staké dans le backstop Blend (retire-le d'abord).`);
    } else {
      throw new ExecError('funds',
        `solde ${sellAsset.code} liquide insuffisant (${fromStroops(liquid)} dispo, ${fromStroops(amountStroops)} requis).`);
    }
  }

  // 2. Trier les candidats non-null par netOut décroissant.
  type Candidate =
    | { venue: 'xbull'; netOut: bigint; route: string }
    | { venue: 'soroswap'; netOut: bigint; minOut: bigint; soroPath?: string[]; quote: unknown }
    | { venue: 'horizon'; netOut: bigint; path: HorizonPathRecord[] }
    | { venue: 'aquarius'; netOut: bigint; swapChainXdr: string; tokens: string[] }
    | { venue: 'comet'; netOut: bigint }
    | { venue: 'ultrastellar'; netOut: bigint; legs: UltraLeg[] };

  let candidates: Candidate[] = [];
  if (xbullQ) candidates.push(xbullQ);
  if (soroQ) candidates.push(soroQ);
  if (horizonQ) candidates.push(horizonQ);
  if (aquariusQ) candidates.push(aquariusQ);
  if (cometQ) candidates.push(cometQ);
  if (ultraQ) candidates.push(ultraQ);
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
        // Utilise le vrai fill simulé pour le plancher (skim xBull ~0,1 % non divulgué).
        // Si la sim échoue → fallback sur cand.netOut (plancher conservateur).
        const xbSim = await deps.simulateXbullNet({ route: cand.route, amountIn: amountStroops, rpcUrl: cfg.rpcUrl });
        const realNet = xbSim?.net ?? cand.netOut;
        const minToGet = minReceivedStroops(realNet, slippageBps);
        const built = await buildXbull(cand.route, sender, amountStroops, minToGet, deps);
        const route = (xbSim?.route && xbSim.route.length >= 2) ? xbSim.route.join(' → ') : `${sellAsset.code} → ${target}`;
        const review = reviewData({
          venue: 'xbull',
          target,
          type: built.type,
          sendStroops: amountStroops,
          netStroops: realNet,
          minReceivedStroops: minToGet,
          slippageBps,
          route,
          ...await xdrGasBreakdown(built.xdr).then(g => ({ gasFeeXlm: g.max, gasRealXlm: g.real })),
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
        const built = await buildHorizon(sender, sellAsset, buyAsset, amountStroops, destMin, cand.path, cfg.horizonUrl);
        const route = [sellAsset.code, ...horizonPathSymbols(cand.path), target].join(' → ');
        const review = reviewData({
          venue: 'horizon',
          target,
          type: 'swap',
          sendStroops: amountStroops,
          netStroops: cand.netOut,
          minReceivedStroops: destMin,
          slippageBps,
          route,
          ...await xdrGasBreakdown(built.xdr).then(g => ({ gasFeeXlm: g.max, gasRealXlm: g.real })),
          displayed,
        });
        return { venue: 'horizon', xdr: built.xdr, type: 'swap', review };
      } catch (e) {
        if (e instanceof ExecError) errors.push(e);
        continue;
      }
    } else if (cand.venue === 'aquarius') {
      try {
        const outMin = minReceivedStroops(cand.netOut, slippageBps);
        const built = await buildAquarius(sender, buyAsset, sellSac, amountStroops, outMin, cand.swapChainXdr, { rpcUrl: cfg.rpcUrl, horizonUrl: cfg.horizonUrl });
        const syms = aquariusPathSymbols(cand.tokens);
        const route = syms.length >= 2 ? syms.join(' → ') : `${sellAsset.code} → ${target}`;
        const review = reviewData({
          venue: 'aquarius',
          target,
          type: 'swap',
          sendStroops: amountStroops,
          netStroops: cand.netOut,
          minReceivedStroops: outMin,
          slippageBps,
          route,
          ...await xdrGasBreakdown(built.xdr).then(g => ({ gasFeeXlm: g.max, gasRealXlm: g.real })),
          displayed,
        });
        return { venue: 'aquarius', xdr: built.xdr, type: 'swap', review };
      } catch (e) {
        if (e instanceof ExecError) errors.push(e);
        continue;
      }
    } else if (cand.venue === 'comet') {
      try {
        const outMin = minReceivedStroops(cand.netOut, slippageBps);
        const built = await buildComet(sender, amountStroops, outMin, { rpcUrl: cfg.rpcUrl, horizonUrl: cfg.horizonUrl });
        const route = `${sellAsset.code} → ${target}`;
        const review = reviewData({
          venue: 'comet',
          target,
          type: 'swap',
          sendStroops: amountStroops,
          netStroops: cand.netOut,
          minReceivedStroops: outMin,
          slippageBps,
          route,
          ...await xdrGasBreakdown(built.xdr).then(g => ({ gasFeeXlm: g.max, gasRealXlm: g.real })),
          displayed,
        });
        return { venue: 'comet', xdr: built.xdr, type: 'swap', review };
      } catch (e) {
        if (e instanceof ExecError) errors.push(e);
        continue;
      }
    } else if (cand.venue === 'ultrastellar') {
      try {
        const built = await buildUltra(sender, sellAsset, buyAsset, cand.legs, amountStroops, slippageBps, cfg.horizonUrl);
        const outMin = cand.legs.reduce((s, l) => s + minReceivedStroops(l.destStroops, slippageBps), 0n);
        const route = `${sellAsset.code} → ${target} · split SDEX ×${cand.legs.length}`;
        const review = reviewData({
          venue: 'ultrastellar',
          target,
          type: 'swap',
          sendStroops: amountStroops,
          netStroops: cand.netOut,
          minReceivedStroops: outMin,
          slippageBps,
          route,
          ...await xdrGasBreakdown(built.xdr).then(g => ({ gasFeeXlm: g.max, gasRealXlm: g.real })),
          displayed,
        });
        return { venue: 'ultrastellar', xdr: built.xdr, type: 'swap', review };
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
          ...await xdrGasBreakdown(built.xdr).then(g => ({ gasFeeXlm: g.max, gasRealXlm: g.real })),
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

// ─── Garde d'opérations autorisées ───────────────────────────────────────────

/** Types d'opérations que l'app émet : PathPaymentStrictSend (SDEX/Ultra), InvokeHostFunction
 *  (contrats Soroban : Comet / Aquarius / Soroswap), ChangeTrust (trustline EURC).
 *  Toute autre opération est rejetée avant d'atteindre le réseau. */
const ALLOWED_OP_TYPES = new Set<string>([
  'pathPaymentStrictSend',
  'invokeHostFunction',
  'changeTrust',
]);

/** Vérifie que toutes les opérations du XDR signé appartiennent à l'allowlist.
 *  Déballe les FeeBumpTransaction. Lance ExecError 'bad_request' en cas de violation. */
async function assertAllowedOps(signedXdr: string): Promise<void> {
  const sdk = await import('@stellar/stellar-sdk');
  const { TransactionBuilder, Networks, FeeBumpTransaction } = sdk;

  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, Networks.PUBLIC);
  } catch {
    throw new ExecError('bad_request', 'XDR illisible');
  }

  // Déballe le fee-bump si nécessaire
  const inner = tx instanceof FeeBumpTransaction ? tx.innerTransaction : tx;
  const ops = (inner as { operations: Array<{ type: string }> }).operations;

  if (!ops || ops.length === 0) {
    throw new ExecError('bad_request', 'tx sans opération');
  }

  for (const op of ops) {
    if (!ALLOWED_OP_TYPES.has(op.type)) {
      throw new ExecError('bad_request', `opération non autorisée : ${op.type}`);
    }
  }
}

// ─── Submit ───────────────────────────────────────────────────────────────────

export async function submit(
  venue: Venue,
  payload: { id?: string; signedXdr: string },
  cfg: { rpcUrl: string; horizonUrl?: string; soroswapApiKey?: string; timeoutMs?: number },
  depsOverride?: Partial<ExecDeps>,
): Promise<{ hash: string; status?: 'pending' }> {
  const deps: ExecDeps = { ...defaultDeps(cfg.timeoutMs), ...depsOverride };

  // Garde defense-in-depth : vérifie le type d'opération AVANT tout appel réseau.
  await assertAllowedOps(payload.signedXdr);

  if (venue === 'xbull') {
    const res = await deps.fetchJson(`${XBULL_BASE}/swaps/submit`, {
      method: 'POST',
      body: { id: payload.id, xdr: payload.signedXdr },
    });
    const body = res.body as Record<string, unknown> | null;
    if (!res.ok || body?.['success'] !== true) {
      const raw =
        (body?.['message'] as string | undefined) ??
        (body?.['error'] as string | undefined) ??
        JSON.stringify(body);
      process.stderr.write(`ExecError raw: ${raw}\n`);
      throw new ExecError('down', safeExecMessage('down'));
    }
    if (typeof body['hash'] !== 'string' || !body['hash']) {
      throw new ExecError('down', 'xBull submit succeeded but returned no transaction hash');
    }
    return { hash: body['hash'] };
  } else if (venue === 'horizon' || venue === 'ultrastellar') {
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
      if (codes.length) {
        // Protocol result_codes are public — safe to include verbatim.
        throw new ExecError(classifyHorizonSubmit(e), `Horizon a rejeté la tx : ${codes.join(', ')}`);
      }
      const raw = e instanceof Error ? e.message : String(e);
      process.stderr.write(`ExecError raw: ${raw}\n`);
      throw new ExecError(classifyHorizonSubmit(e), safeExecMessage(classifyHorizonSubmit(e)));
    }
  } else if (venue === 'aquarius' || venue === 'comet') {
    // Fire-and-poll : on FIRE la tx (sendTransaction) et on rend le hash immédiatement.
    // La CONFIRMATION (getTransaction) est polled par le client via /api/tx-status — une
    // tx lente n'est donc plus un faux échec post-signature. Cf. txStatus + /api/tx-status.
    const client = deps.makeRpc(cfg.rpcUrl);
    let sent: { status: SendStatus; hash: string; errorResult?: unknown };
    try {
      sent = await client.send(payload.signedXdr);
    } catch (e) {
      if (e instanceof ExecError) throw e;
      const raw = e instanceof Error ? e.message : String(e);
      process.stderr.write(`ExecError raw: ${raw}\n`);
      const code = classifyExecError(raw);
      throw new ExecError(code, safeExecMessage(code));
    }
    // ERROR | TRY_AGAIN_LATER = PAS entrée mempool → vrai échec d'admission.
    if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
      process.stderr.write(`ExecError raw: Soroban a rejeté la tx (${sent.status}) : ${JSON.stringify(sent.errorResult ?? sent.status)}\n`);
      throw new ExecError('down', safeExecMessage('down'));
    }
    // PENDING | DUPLICATE → fired ; la confirmation est déléguée au client.
    return { hash: sent.hash, status: 'pending' };
  } else {
    const client = deps.makeSoroswap(cfg.soroswapApiKey!);
    try {
      const r = await client.send(payload.signedXdr);
      if (!r.success) throw new ExecError('down', `soroswap submit failed : txHash=${r.txHash}`);
      return { hash: r.txHash };
    } catch (e) {
      // Symétrie avec buildSoroswap : toute erreur SDK ressort en ExecError classée (jamais un 500 opaque post-signature).
      if (e instanceof ExecError) throw e;
      const raw = e instanceof Error ? e.message : String(e);
      process.stderr.write(`ExecError raw: ${raw}\n`);
      const code = classifyExecError(raw);
      throw new ExecError(code, safeExecMessage(code));
    }
  }
}

/** Confirmation on-chain d'une tx Soroban (fire-and-poll, polled par le client).
 *  SUCCESS → confirmée · FAILED → échec on-chain · NOT_FOUND/RPC KO → encore en vol ('pending', pas une erreur). */
export async function txStatus(
  hash: string,
  cfg: { rpcUrl: string; timeoutMs?: number },
  depsOverride?: Partial<ExecDeps>,
): Promise<{ status: 'success' | 'failed' | 'pending' }> {
  const deps: ExecDeps = { ...defaultDeps(cfg.timeoutMs), ...depsOverride };
  try {
    const got = await deps.makeRpc(cfg.rpcUrl).status(hash);
    if (got.status === 'SUCCESS') return { status: 'success' };
    if (got.status === 'FAILED') return { status: 'failed' };
    return { status: 'pending' }; // NOT_FOUND
  } catch {
    // RPC indispo ≠ tx échouée : le client re-pollera.
    return { status: 'pending' };
  }
}
