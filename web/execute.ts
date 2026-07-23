// Execution orchestrator: BLND → USDC/EURC via xBull, Soroswap, Horizon, or Aquarius.
// Money-path: bigint stroops throughout, never float for calculations.
import { BLND, USDC, EURC, XLM, ASSETS, bySac, classicColon, type Asset } from '../core/assets.js';
import { decodeTransfers, routeFromTransfers, type Transfer } from '../core/soroban-route.js';
import { bumpRpc } from '../core/rpc-meter.js';
import { withTimeout } from '../core/timeout.js';
import { toNumber, fromStroops, toStroops } from '../core/amount.js';
import { stroopsOrNull, bigintOrNull } from '../core/sources/util.js';
import { COMET_POOL, COMET_WITNESSES, decodeCometOut } from '../core/sources/comet.js';
import { SB_FEE_ACCOUNT } from '../core/sources/stellarbroker.js';
import { parseBlndBalance } from '../core/balance.js';
import { SoroswapSDK, SupportedNetworks, SupportedProtocols, TradeType } from '@soroswap/sdk';

/** Wired execution venues. Adding a venue = extending this union (and its build/submit case). */
export type Venue = 'xbull' | 'soroswap' | 'horizon' | 'aquarius' | 'comet' | 'ultrastellar';

// ─── Shared User-Agent (xBull blocks the default Node UA) ───────────────────
const XBULL_UA = 'Mozilla/5.0 (compatible; DecantFi/0.1; +exec)';
const XBULL_BASE = 'https://swap.apis.xbull.app';
const HORIZON_BASE_DEFAULT = 'https://horizon.stellar.org';
const AQUA_ROUTER = 'CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK';
const AQUA_FINDPATH = 'https://amm-api.aqua.network/api/external/v1/find-path/';
const I128_MAX = 170141183460469231731687303715884105727n;
// Hard cap on a single Soroban simulateTransaction / xBull accept-quote call. Without it a stalled
// RPC connection hangs the caller forever — and a hung re-sim freezes the whole collector tick loop.
const SIM_TIMEOUT_MS = 15000;

// ─── Typed error ──────────────────────────────────────────────────────────────

export class ExecError extends Error {
  constructor(
    public code: 'trustline' | 'funds' | 'slippage' | 'down' | 'no-route' | 'bad_request',
    message: string,
    /** For trustline errors: the CODE of the actually missing asset (USDC on leg1, EURC on leg2…).
     *  Needed by the frontend to add/retry the RIGHT trustline (the global `target` ≠ the leg's asset). */
    public asset?: string,
  ) {
    super(message);
    this.name = 'ExecError';
  }
}

/** Actionable trustline error message: explains how to add the trustline in the wallet.
 *  Use instead of `new ExecError('trustline', ...)` everywhere the output trustline is missing. */
function trustlineMissingError(buy: Asset, sender: string): ExecError {
  return new ExecError(
    'trustline',
    `Trustline ${buy.code} (émetteur : ${buy.issuer}) absente sur le compte ${sender}. ` +
    `Pour l'ajouter : dans votre wallet (Freighter / LOBSTR), allez dans « Manage Assets » ` +
    `et ajoutez l'actif ${buy.code}. Coût : ~0,5 XLM de réserve immobilisée (opération changeTrust).`,
    buy.code,
  );
}

// ─── Pure exported helpers ────────────────────────────────────────────────────

/** Converts a Stellar SDK Asset object (decoded from XDR) to a core Asset,
 *  or null if the asset is not in the known registry (unknown → cannot route). */
function sdkAssetToCore(a: { isNative(): boolean; getCode(): string; getIssuer(): string }): Asset | null {
  if (a.isNative()) return XLM;
  const code = a.getCode();
  const issuer = a.getIssuer();
  return ASSETS.find((x) => x.code === code && x.issuer === issuer) ?? null;
}

/** Floor-division: net * (10000-bps) / 10000. Throws if bps is invalid. */
export function minReceivedStroops(net: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps >= 10000) {
    throw new RangeError(`slippageBps invalide : ${slippageBps}`);
  }
  return (net * BigInt(10000 - slippageBps)) / 10000n;
}

/** Winner by max netOut (stable: on a tie, the first one wins). */
export function pickBest<T extends { netOut: bigint }>(quotes: Array<T | null>): T | null {
  let best: T | null = null;
  for (const q of quotes) {
    if (q === null) continue;
    if (best === null || q.netOut > best.netOut) best = q;
  }
  return best;
}

/** Validates the xBull accept-quote response; null if malformed. */
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

/** Execution error classification. Case-insensitive. */
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

/** Human-readable route label for the UI.
 *  Soroswap: each SAC → symbol via bySac (fallback C1234…7890).
 *  xBull: route decoded from the sim (simulateXbullNet) — no more ☁ mask. */
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
  /** Max network fee (XDR fee, in XLM). Cap authorized by the wallet. */
  gasFeeXlm: number;
  /** Estimated real network fee (Soroban resource fee from the simulation; == gasFeeXlm for a classic tx). */
  gasRealXlm?: number;
  /** Present only when the net shown by the meta-aggregator was higher than what we actually execute. */
  fidelity?: { displayedWinner: string; displayedWinnerNet: number };
}

/** {max: total authorized fee, real: Soroban resource fee (estimated real cost from the sim)}. For a classic tx real==max. */
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
    } catch { /* classic tx without sorobanData */ }
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

  // Fidelity: gap between what was displayed and what we actually execute.
  const dw = args.displayed?.winner;
  const dn = args.displayed?.net;
  if (dw && dn != null && dn - toNumber(args.netStroops) > 1e-6) {
    r.fidelity = { displayedWinner: dw, displayedWinnerNet: dn };
  }

  return r;
}

// ─── Injectable IO ────────────────────────────────────────────────────────────

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

/** Minimal Soroban RPC client for fire-and-poll. Injectable → hermetic tests. */
export interface SorobanRpcClient {
  /** FIRE: sends the signed XDR; returns the mempool admission status + hash. */
  send(signedXdr: string): Promise<{ status: SendStatus; hash: string; errorResult?: unknown }>;
  /** POLL: on-chain status of a tx by hash. */
  status(hash: string): Promise<{ status: 'SUCCESS' | 'NOT_FOUND' | 'FAILED' }>;
}

export interface ExecDeps {
  fetchJson: (url: string, init?: { method?: string; body?: unknown }) => Promise<FetchResult>;
  makeSoroswap: (apiKey: string) => SoroswapClient;
  /** Comet quote: read-only simulation of swap_exact_amount_in (output independent of the user). Injectable → hermetic tests. */
  simulateComet: (a: { sellSac: string; buySac: string; amountIn: bigint; rpcUrl: string }) => Promise<bigint | null>;
  /** xBull net simulation via accept-quote + simulateTransaction. Injectable → hermetic tests. */
  simulateXbullNet: (a: { route: string; amountIn: bigint; rpcUrl: string }) => Promise<{ net: bigint; route: string[]; transfers: Transfer[] } | null>;
  /** Soroban RPC client (fire-and-poll: sendTransaction + getTransaction). Injectable → hermetic tests. */
  makeRpc: (rpcUrl: string) => SorobanRpcClient;
}

/** Real dependencies backed by network fetch.
 * ponytail: unlike core/sources/http.ts which returns null on error (silent),
 * fetchJson surfaces error details in body so callers can build clear ExecErrors. */
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

/** Real implementation of the Soroban RPC client (fire-and-poll). Lazy SDK import + per-call timeout. */
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

/** Read-only Comet quote: simulates swap_exact_amount_in using the COMET_WITNESSES list
 *  (the output depends ONLY on the pool reserves, not the user). Takes the 1st witness whose sim succeeds.
 *  null if all witnesses fail or the pool is missing. Mirrors core/sources/comet.ts. */
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

/** BLND witnesses with enough liquidity to simulate swap_chained (their balance is never touched). */
export const AQUARIUS_WITNESSES = [
  'GCA34HBKNLWN3AOXWBRW5Y3HSGHCWF3UDBRJ5YHGU6HWGJZEPO2NSXI3',
  'GBBF7X4FQ3HGRIDSNQ2HOPS6BP7ZERJN22Y54O5WAOAK4CAA4FV3K3G2',
  'GC7IUIQ7R6NOIFNB4PYFNVYVNHSLJIULSWQTXG7UK33UTIC6NSZIW2BC',
];

/** Simulates Aquarius swap_chained with out_min=0 to get the real net (without a slippage revert).
 *  null if all witnesses fail or the XDR isn't decodable. */
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

/** Simulates xBull via accept-quote (minToGet='0') to get the real net fill (without the 0.1% skim).
 *  Reuses AQUARIUS_WITNESSES: shared witness accounts (BLND + USDC + EURC trustlines, large balances).
 *  Also extracts the real route from the SAC transfer chain in the simulation events.
 *  null if all witnesses fail or the XDR isn't simulable. */
export async function simulateXbullNet(
  route: string,
  amountIn: bigint,
  cfg: { rpcUrl: string },
): Promise<{ net: bigint; route: string[]; transfers: Transfer[] } | null> {
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
      // Extract the real route from the SAC transfer chain
      const transfers = await decodeTransfers((sim as any).events ?? []);
      const decodedRoute = routeFromTransfers(transfers);
      return { net, route: decodedRoute.length >= 2 ? decodedRoute : [], transfers };
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Simulation StellarBroker (empty-auth recording-mode) ────────────────────

// SB_FEE_ACCOUNT is defined canonically in core/sources/stellarbroker.ts; re-export for callers/tests.
export { SB_FEE_ACCOUNT };

/**
 * Re-simulate a StellarBroker swap using the empty-auth recording-mode technique
 * proven in spike/sb-mediator/scripts/t5b-emptyauth-sim.mjs.
 *
 * Opens a WS trade session against a witness (no signing), captures the unsigned
 * tx burst, then for each XDR:
 *   - invokeHostFunction: rebuild with witness as source, auth:[], no sorobanData;
 *     simulateTransaction in recording mode; contribution = scValToNative(retval)[1].
 *   - pathPaymentStrictSend to trader (≠ SB_FEE_ACCOUNT): contribution = destMin.
 *   - pathPaymentStrictSend to SB_FEE_ACCOUNT: excluded (fee leg).
 *
 * Net = Σ contributions. Returns null on capture failure or zero net.
 *
 * `exact` is true ONLY when every contributing leg was a Soroban recording-mode
 * sim (a real observed fill). If any classic trader leg contributed its destMin
 * (a slippage FLOOR, not an observed fill), `exact` is false: the net is then a
 * conservative lower bound and callers MUST NOT relabel it "observed".
 */
export async function simulateStellarBrokerNet(opts: {
  sellAsset: Asset;
  buyAsset: Asset;
  amountIn: bigint;
  slippageBps: number;
  apiKey: string;
  rpcUrl: string;
  wsConstructor?: typeof WebSocket;
  /** For testing: skip real WS capture, use these XDRs directly. */
  _capturedXdrs?: string[];
  /** For testing: override the RPC server. */
  _rpcServer?: { simulateTransaction(tx: unknown): Promise<unknown> };
  /** Execution deps (fetchJson) used by quoteHorizon for classic-leg re-quote.
   *  Defaults to defaultDeps() when not provided. */
  deps?: ExecDeps;
  /** Horizon base URL passed through to quoteHorizon. Defaults to HORIZON_BASE_DEFAULT. */
  horizonUrl?: string;
  /** For testing: override quoteHorizon to avoid real network calls. */
  _quoteHorizon?: typeof quoteHorizon;
}): Promise<{ net: bigint; route: string[]; exact: boolean } | null> {
  // All AQUARIUS_WITNESSES hold BLND, USDC, EURC — pick the first as witness/trader
  const witness = AQUARIUS_WITNESSES[0]!;

  let capturedXdrs: string[];

  if (opts._capturedXdrs) {
    capturedXdrs = opts._capturedXdrs;
  } else {
    const { captureStellarBrokerTx } = await import('../core/sources/stellarbroker.js');
    const capture = await withTimeout(
      captureStellarBrokerTx(
        { sellAsset: opts.sellAsset, buyAsset: opts.buyAsset, amountIn: opts.amountIn, slippageBps: opts.slippageBps },
        opts.apiKey,
        witness,
        { WebSocketConstructor: opts.wsConstructor },
      ),
      SIM_TIMEOUT_MS,
      'sb capture',
    ).catch(() => null);
    if (!capture || capture.xdrs.length === 0) return null;
    capturedXdrs = capture.xdrs;
  }

  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, TransactionBuilder, Networks, Account, Operation, scValToNative, FeeBumpTransaction } = sdk;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server: { simulateTransaction(tx: unknown): Promise<unknown> } =
    opts._rpcServer ?? new rpc.Server((opts.rpcUrl || 'https://mainnet.sorobanrpc.com').replace(/\/$/, ''));

  // Horizon re-quote seam: injectable for tests, real implementation otherwise.
  const qhFn = opts._quoteHorizon ?? quoteHorizon;
  // fetchJson provider for quoteHorizon calls; defaultDeps() as fallback.
  const execDeps = opts.deps ?? defaultDeps();

  let totalNet = 0n;
  // True as soon as a classic trader-leg destMin (a floor, not an observed fill) is summed
  // into the net → the result can no longer be honestly labelled "observed/exact".
  let classicContributed = false;

  // Track contributions per captured XDR (= per sub-tx). Used to select the dominant route.
  // SB bursts can be parallel splits across multiple XDRs; we display the route of the sub-tx
  // with the LARGEST fill contribution. This is a deliberate simplification consistent with the
  // linear-route convention used by xBull/Aquarius: rendering true parallel fan-outs is out of P2.
  const subTxContribs: Array<{ fill: bigint; route: string[] }> = [];

  for (const xdrStr of capturedXdrs) {
    try {
      const parsed = TransactionBuilder.fromXDR(xdrStr, Networks.PUBLIC);
      // Unwrap FeeBump if present
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = (parsed instanceof FeeBumpTransaction) ? (parsed as any).innerTransaction : parsed;

      // Check for invokeHostFunction ops (Soroban swap legs)
      const invokeOps = (tx.operations as Array<{ type: string }>).filter((o) => o.type === 'invokeHostFunction');

      if (invokeOps.length > 0) {
        // ── Soroban leg ────────────────────────────────────────────────────────
        let xdrFill = 0n;
        let xdrRoute: string[] = [];

        for (const invokeOp of invokeOps) {
          // Rebuild with witness as source, empty auth, no sorobanData → recording mode
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const func = (invokeOp as any).func;
          const rebuilt = new TransactionBuilder(new Account(witness, '0'), {
            fee: '1000000',
            networkPassphrase: Networks.PUBLIC,
          })
            .addOperation(Operation.invokeHostFunction({ func, auth: [] }))
            .setTimeout(120)
            .build();
          bumpRpc();
          const sim = await withTimeout(
            server.simulateTransaction(rebuilt),
            SIM_TIMEOUT_MS,
            'sb soroban sim',
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (rpc.Api.isSimulationError(sim as any) || !(sim as any)?.result?.retval) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const native = scValToNative((sim as any).result.retval);
          if (!Array.isArray(native) || native.length < 2) continue;
          const leg = BigInt(native[1]);
          if (leg > 0n) {
            totalNet += leg;
            xdrFill += leg;
          }
          // Decode real route from SAC transfer events, mirroring simulateXbullNet.
          // Falls back to [] when the RPC returns no events (e.g. in test stubs).
          if (xdrRoute.length < 2) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transfers = await decodeTransfers((sim as any).events ?? []);
            const decoded = routeFromTransfers(transfers);
            if (decoded.length >= 2) xdrRoute = decoded;
          }
        }

        if (xdrFill > 0n) subTxContribs.push({ fill: xdrFill, route: xdrRoute });
        continue; // tx was Soroban — classic branch below not applicable
      }

      // ── Classic pathPaymentStrictSend legs ────────────────────────────────
      type ClassicOp = {
        type: string;
        destination?: string;
        destMin?: string;
        sendAsset?: { isNative(): boolean; getCode(): string; getIssuer(): string };
        sendAmount?: string;
        destAsset?: { isNative(): boolean; getCode(): string; getIssuer(): string };
        /** Intermediate hops in the path (SDK Asset objects). */
        path?: Array<{ isNative(): boolean; getCode(): string }>;
      };
      // Convert SDK Asset → display symbol: native → 'XLM', else asset code.
      const assetSym = (a: { isNative(): boolean; getCode(): string }): string =>
        a.isNative() ? 'XLM' : a.getCode();

      let xdrFill = 0n;
      let xdrRoute: string[] = [];

      for (const op of (tx.operations as ClassicOp[])) {
        if (op.type !== 'pathPaymentStrictSend') continue;
        if (op.destination === SB_FEE_ACCOUNT) continue; // fee leg → skip

        // Decode route from this classic op: [sendAsset, ...path, destAsset].
        // Captured once from the first non-fee trader leg of this XDR.
        if (op.sendAsset && op.destAsset && xdrRoute.length < 2) {
          const sendSym = assetSym(op.sendAsset);
          const pathSyms = (op.path ?? []).map(assetSym);
          const destSym = assetSym(op.destAsset);
          xdrRoute = [sendSym, ...pathSyms, destSym];
        }

        // Attempt to observe the real fill via Horizon strict-send.
        // Only possible when sendAsset and destAsset are known (in our ASSETS registry).
        // On any failure (Horizon down, timeout, unknown asset) → fall back to destMin floor.
        let observedFill: bigint | null = null;
        if (op.sendAsset && op.sendAmount && op.destAsset) {
          const sendCore = sdkAssetToCore(op.sendAsset);
          const destCore = sdkAssetToCore(op.destAsset);
          if (sendCore && destCore) {
            try {
              const sendAmountStroops = toStroops(op.sendAmount);
              const hResult = await withTimeout(
                qhFn(sendCore, destCore, sendAmountStroops, execDeps, opts.horizonUrl),
                SIM_TIMEOUT_MS,
                'sb classic horizon',
              ).catch(() => null);
              if (hResult && hResult.netOut > 0n) observedFill = hResult.netOut;
            } catch { /* toStroops failure or other sync error — fall through to destMin */ }
          }
        }

        let legFill = 0n;
        if (observedFill !== null) {
          // Real fill from Horizon strict-send — this IS an observed fill.
          // Do NOT set classicContributed: exact stays true if all other legs are also observed.
          totalNet += observedFill;
          legFill = observedFill;
        } else {
          // Fallback: destMin is a slippage FLOOR, never an observed fill.
          // Summing it makes the net a conservative lower bound → mark non-exact so callers
          // keep the honest estimate label instead of promoting to "observed".
          if (op.destMin) {
            try {
              const destMinStroops = toStroops(op.destMin);
              if (destMinStroops > 0n) {
                totalNet += destMinStroops;
                classicContributed = true;
                legFill = destMinStroops;
              }
            } catch { /* malformed destMin — skip */ }
          }
        }

        if (legFill > 0n) xdrFill += legFill;
      }

      if (xdrFill > 0n) subTxContribs.push({ fill: xdrFill, route: xdrRoute });
    } catch {
      // Malformed XDR — skip
    }
  }

  if (totalNet <= 0n) return null;

  // Select the dominant route: the sub-tx with the largest fill contribution.
  // In a split burst this is the main path; true parallel routing is not rendered in P2.
  const dominant = subTxContribs.reduce<{ fill: bigint; route: string[] } | null>(
    (best, cur) => (!best || cur.fill > best.fill) ? cur : best,
    null,
  );
  const route = (dominant?.route?.length ?? 0) >= 2
    ? dominant!.route
    : [opts.sellAsset.symbol, opts.buyAsset.symbol];

  return { net: totalNet, route, exact: !classicContributed };
}

/** Simulates Aquarius swap_chained and returns the raw Transfer[] (for the consistency probe).
 *  Same logic as simulateAquariusNet but returns the decoded events instead of the retval.
 *  null if all witnesses fail or the XDR isn't decodable. */
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

/** Simulates a Soroswap swap and returns the raw Transfer[] (for the consistency probe).
 *  Builds the XDR via buildSoroswap then simulates without preparing (simulateTransaction).
 *  null if the build fails or the simulation fails. */
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

/** Simulates Comet swap_exact_amount_in and returns the raw Transfer[] (for the consistency probe).
 *  Mirrors simulateCometReal but returns the decoded events instead of the net.
 *  null if all witnesses fail. */
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
    // SOROSWAP only — verified empirically (quote vs. real simulated fill, the same method used to
    // debunk xBull's quotes): multi-protocol (PHOENIX/AQUA/SDEX) returns Aqua routes with absurd quotes
    // (USDC→EURC +2261%, BLND→EURC +124%) that FAIL at build time ('Invalid poolHashes', @soroswap/sdk
    // 0.4.0 bug). Off-chain SDK bug, not an on-chain contract bug; and Aqua liquidity is already captured
    // honestly by the keyless Aquarius adapter (find-path, 100% fill). Do NOT re-enable multi without re-verifying.
    const q = await client.quote({
      assetIn: sellSac,
      assetOut: buySac,
      amount,
      tradeType: TradeType.EXACT_IN,
      protocols: [SupportedProtocols.SOROSWAP],
      slippageBps,
      // ponytail: parity with the collector (core/sources/soroswap.ts maxHops:2). No-op today
      // (the API already routes BLND→USDC→EURC) but pins the multi-hop: prevents a silent
      // degradation to the tiny direct BLND/EURC pool if the API's default were to change.
      maxHops: 2,
    });
    // The SDK types these fields as bigint but returns NUMBERs at runtime (no transformResponse)
    // → explicit coercion. BigInt() accepts an integer number AND a bigint, and throws on a float (fail fast).
    const amountOut: bigint = BigInt(q?.amountOut ?? 0);
    if (amountOut <= 0n) return null;

    // amountOutMin: canonical SDK field (rawTrade for EXACT_IN), = the min threshold enforced in the XDR.
    // Fallback to minReceivedStroops if absent.
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

// ─── Quote / build / submit — Horizon (native PathPaymentStrictSend op) ──────
// No aggregation API: we build the XDR ourselves with stellar-sdk from the
// path returned by /paths/strict-send. A classic tx can't be simulated (≠ Soroban),
// so the pre-signature guard is checking the output trustline on the loaded account.

interface HorizonPathRecord { asset_type?: string; asset_code?: string; asset_issuer?: string }
interface HorizonRecord { destination_amount?: string; path?: HorizonPathRecord[] }

/** Human-readable symbols for the intermediate assets of a Horizon path (native → XLM). */
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

/** Live re-quote via Horizon strict-send: best destination_amount + structured path (for the build). */
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

/** Builds the (unsigned) PathPaymentStrictSend XDR. Pre-flight trustline check → clear ExecError. */
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

  // Output trustline present? (USDC/EURC are never native)
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

/** Horizon error codes (extras.result_codes) → readable message. */
function horizonResultCodes(e: unknown): string[] {
  const rc = (e as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } })
    ?.response?.data?.extras?.result_codes;
  if (!rc) return [];
  const ops = Array.isArray(rc.operations) ? rc.operations : [];
  return [rc.transaction ?? '', ...ops].filter(Boolean);
}

export function classifyHorizonSubmit(e: unknown): ExecError['code'] {
  const codes = horizonResultCodes(e).join(' ').toLowerCase();
  // Route consumed / price moved since the quote → re-quote (slippage, HTTP 400), not "unavailable" (502).
  if (codes.includes('under_dest_min') || codes.includes('too_few_offers') || codes.includes('cross_self')) return 'slippage';
  if (codes.includes('no_trust') || codes.includes('no_destination') || codes.includes('not_authorized')) return 'trustline';
  if (codes.includes('underfunded') || codes.includes('insufficient') || codes.includes('line_full')) return 'funds';
  return classifyExecError(codes || (e instanceof Error ? e.message : String(e)));
}

// ─── Quote / build / submit — Aquarius (Soroban swap_chained contract) ──────
// find-path API returns swap_chain_xdr (= serialized swaps_chain arg, decode as-is) +
// amount_with_fee (raw net stroops) + tokens (route). Build via stellar-sdk + prepareTransaction
// (Soroban IS simulable, ≠ Horizon). Pre-flight trustline check = clear message (the sim would also catch it).

/** Human-readable symbols for an Aquarius route. find-path tokens: 'native' (→XLM) or 'CODE:ISSUER'. */
export function aquariusPathSymbols(tokens: string[]): string[] {
  return tokens.map((t) => (t === 'native' ? 'XLM' : t.split(':')[0] ?? t));
}

/** Live re-quote via Aquarius find-path: net (amount_with_fee) + swap_chain_xdr + route. */
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

/** Builds + simulates (prepareTransaction) the swap_chained call → XDR ready to sign.
 *  user == sender == source: the source account's Soroban auth is covered by the tx signature. */
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
    // #2006 = Aquarius router revert when the simulated output < out_min: the find-path route
    // over-quoted and doesn't hold at the requested slippage (≠ outage, ≠ funds). Classify as slippage → actionable message.
    if (raw.includes('#2006')) throw new ExecError('slippage', safeExecMessage('slippage'));
    const code = classifyExecError(raw);
    throw new ExecError(code, safeExecMessage(code));
  }
}

// ─── Quote / build — Comet (backstop pool swap_exact_amount_in contract) ────
// Soroban pool BLND/USDC ONLY (CAS3FL6T…). Quote = read-only simulation with COMET_WITNESSES
// (output independent of the user). Build with the real sender: prepareTransaction enforces the
// HARD CAVEAT = the sender must hold LIQUID BLND (often staked in the backstop → clear message).

/** Re-quotes Comet via simulation (deps.simulateComet, injectable). null if pool missing / sim fails. */
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

/** Builds + simulates (prepareTransaction) the swap_exact_amount_in call → XDR ready to sign.
 *  Pre-flight checks USDC trustline + liquid BLND (backstop caveat) for clear messages.
 *  user == sender == source: the BLND transfer's Soroban auth is covered by the tx signature. */
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
  // Output USDC trustline (Comet = BLND→USDC only).
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

// ─── Quote / build / submit — Ultra Stellar (classic multi-op SDEX split) ───
// Ultra does NOT return a build: we build N PathPaymentStrictSend ourselves (1 per leg of the
// extended_paths[] split) in ONE atomic classic tx (1 signature). SDEX only (no Soroban liquidity)
// → almost always loses the competitive selection; a completeness venue (click-to-select). The
// intermediate assets (AQUA/yXLM/…) do NOT require a trustline (path payment); only the output does.
// Submit = identical to Horizon (classic tx).

const ULTRA_ROUTING = 'https://routing.ultrastellar.com/.netlify/functions/v1/smart-routing';

export interface UltraLeg {
  sendStroops: bigint;       // sourceAmount (BLND) in stroops
  destStroops: bigint;       // destinationAmount (target) in stroops
  path: HorizonPathRecord[]; // intermediates (reuses the Horizon type)
}

function ultraAssetParam(a: Asset): string {
  return a.native ? 'native' : classicColon(a);
}

/** Parses the smart-routing response → legs + net. null if no valid leg. */
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
    } catch { /* malformed leg → skipped */ }
  }
  if (legs.length === 0) return null;
  // net = Σ of the outputs per RETAINED leg (≡ optimized_sum when nothing is dropped, verified live).
  // We do NOT read optimized_sum: if a leg is dropped (malformed / rounds to 0), the displayed net
  // must reflect what we actually build — otherwise the net would be inflated vs. what's executed, silently misleading.
  const netOut = legs.reduce((s, l) => s + l.destStroops, 0n);
  return { netOut, legs };
}

/** Live re-quote via Ultra smart-routing (param 'fee' deliberately OMITTED: fee=0 rejected = the raw quote). */
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

/** Adjusts the legs so Σ sendStroops == the exact total (residual → largest leg).
 *  Money-path guard: the float→stroops conversion can drift; we never send a total ≠ the input. */
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

/** Builds the classic multi-op tx (N PathPaymentStrictSend). Pre-flight checks the output trustline
 *  (classic tx not simulable, like Horizon). destMin per leg = slippage floor of leg.destStroops. */
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

// ─── Trustline (pre-flight + in-app add) ─────────────────────────────────────

/** Pre-flight: loads the account once to check the trustline AND the liquid balance of sellAsset.
 *  trustline: true/false, or null if the read fails (account not found / Horizon down).
 *  liquid   : liquid balance of sellAsset in stroops, or null if the read fails.
 *  → null = let the builds handle it, no false positive. */
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
    // Liquid balance of the sold asset (not necessarily BLND)
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

/** Builds the (unsigned) changeTrust XDR to add the trustline for the bought asset.
 *  Default limit = max (unlimited receiving). Submitted afterwards via the classic Horizon path (submit horizon). */
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

// ─── Main orchestrator ────────────────────────────────────────────────────────

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

  // 1. Live re-quote in parallel (tolerant: failure → null) + trustline pre-flight (parallel → zero added latency).
  const soroClient = cfg.soroswapApiKey ? deps.makeSoroswap(cfg.soroswapApiKey) : null;
  const [preflight, xbullQ, soroQ, horizonQ, aquariusQ, cometQ, ultraQ] = await Promise.all([
    senderPreflight(sender, sellAsset, buyAsset, cfg.horizonUrl),
    quoteXbull(sellSac, buySac, amountStroops, deps),
    soroClient
      ? quoteSoroswap(soroClient, sellSac, buySac, amountStroops, slippageBps)
      : Promise.resolve(null),
    quoteHorizon(sellAsset, buyAsset, amountStroops, deps, cfg.horizonUrl),
    quoteAquarius(sellSac, buySac, amountStroops, deps),
    // Comet = BLND/USDC pool only: no quote if sellAsset ≠ BLND or target ≠ USDC.
    sellAsset === BLND && target === 'USDC' ? quoteComet(deps, sellSac, buySac, amountStroops, cfg.rpcUrl) : Promise.resolve(null),
    quoteUltra(sellAsset, buyAsset, amountStroops, deps),
  ]);

  const { trustline, liquid } = preflight;

  // UNIVERSAL trustline pre-flight: if the sender lacks the trustline for the bought asset, fail
  // clearly HERE (before any build) → this ALSO covers the turnkey xBull/Soroswap venues whose
  // trustline error wasn't surfaced classified (a misleading "source unavailable"). null = read failed → builds handle it.
  if (trustline === false) throw trustlineMissingError(buyAsset, sender);

  // UNIVERSAL balance pre-flight: if liquid BLND is insufficient, fail HERE (before any build/popup)
  // → uniform behavior across all venues (the classic Horizon/Ultra ones no longer reach Freighter
  //   just to fail later at submission). liquid null = read failed → let the builds handle it.
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

  // 2. Sort the non-null candidates by descending netOut.
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

  // Forcing a specific venue (click-to-select from the UI)
  if (forceVenue !== undefined) {
    candidates = candidates.filter((c) => c.venue === forceVenue);
    if (candidates.length === 0) {
      throw new ExecError('no-route', 'venue choisi indisponible');
    }
  }

  // 3. Try to BUILD in descending netOut order; first success wins.
  const errors: ExecError[] = [];

  for (const cand of candidates) {
    if (cand.venue === 'xbull') {
      try {
        // Use the real simulated fill for the floor (undisclosed ~0.1% xBull skim).
        // If the sim fails → fall back to cand.netOut (conservative floor).
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

  // 4. All builds failed → priority trustline > funds > slippage > down.
  const priority: ExecError['code'][] = ['trustline', 'funds', 'slippage', 'down'];
  for (const code of priority) {
    const found = errors.find((e) => e.code === code);
    if (found) throw found;
  }
  throw new ExecError('down', 'aucune route buildable');
}

// ─── Allowed-operations guard ─────────────────────────────────────────────────

/** Operation types the app emits: PathPaymentStrictSend (SDEX/Ultra), InvokeHostFunction
 *  (Soroban contracts: Comet / Aquarius / Soroswap), ChangeTrust (EURC trustline).
 *  Any other operation is rejected before reaching the network. */
const ALLOWED_OP_TYPES = new Set<string>([
  'pathPaymentStrictSend',
  'invokeHostFunction',
  'changeTrust',
]);

/** Checks that every operation in the signed XDR belongs to the allowlist.
 *  Unwraps FeeBumpTransaction. Throws ExecError 'bad_request' on violation. */
async function assertAllowedOps(signedXdr: string): Promise<void> {
  const sdk = await import('@stellar/stellar-sdk');
  const { TransactionBuilder, Networks, FeeBumpTransaction } = sdk;

  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, Networks.PUBLIC);
  } catch {
    throw new ExecError('bad_request', 'XDR illisible');
  }

  // Unwrap the fee-bump if needed
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

  // Defense-in-depth guard: checks the operation type BEFORE any network call.
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
    // classic tx → Horizon submission (handles form encoding + error extraction).
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
    // Fire-and-poll: we FIRE the tx (sendTransaction) and return the hash immediately.
    // The CONFIRMATION (getTransaction) is polled by the client via /api/tx-status — a
    // slow tx is therefore no longer a false failure post-signature. See txStatus + /api/tx-status.
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
    // ERROR | TRY_AGAIN_LATER = did NOT enter the mempool → real admission failure.
    if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
      process.stderr.write(`ExecError raw: Soroban a rejeté la tx (${sent.status}) : ${JSON.stringify(sent.errorResult ?? sent.status)}\n`);
      throw new ExecError('down', safeExecMessage('down'));
    }
    // PENDING | DUPLICATE → fired; confirmation is delegated to the client.
    return { hash: sent.hash, status: 'pending' };
  } else {
    const client = deps.makeSoroswap(cfg.soroswapApiKey!);
    try {
      const r = await client.send(payload.signedXdr);
      if (!r.success) throw new ExecError('down', `soroswap submit failed : txHash=${r.txHash}`);
      return { hash: r.txHash };
    } catch (e) {
      // Symmetric with buildSoroswap: any SDK error surfaces as a classified ExecError (never an opaque 500 post-signature).
      if (e instanceof ExecError) throw e;
      const raw = e instanceof Error ? e.message : String(e);
      process.stderr.write(`ExecError raw: ${raw}\n`);
      const code = classifyExecError(raw);
      throw new ExecError(code, safeExecMessage(code));
    }
  }
}

/** On-chain confirmation of a Soroban tx (fire-and-poll, polled by the client).
 *  SUCCESS → confirmed · FAILED → on-chain failure · NOT_FOUND/RPC down → still in flight ('pending', not an error). */
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
    // RPC unavailable ≠ failed tx: the client will poll again.
    return { status: 'pending' };
  }
}
