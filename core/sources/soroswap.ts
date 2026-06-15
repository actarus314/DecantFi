// Soroswap : agregateur Soroban. v1 KEYLESS = routage local (soroswap-router-sdk) sur les reserves
// du pool BLND/USDC lues en live via Soroban RPC (simulateTransaction, lecture seule). La math de frais
// de pool 0,3 % tourne dans le SDK => amountOut NET. Pas de pool direct => null (la source se retire).
// Note v1 : seule la paire DIRECTE est alimentee (pas de multi-hop keyless) ; documente.
import type { SourceAdapter, NormalizedQuote, QuoteRequest, SourceConfig } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { bySac } from '../assets.js';
import { bigintOrNull, hops } from './util.js';

const FACTORY = 'CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2'; // mainnet, keyless

function short(a: string): string {
  return a.length > 9 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSoroswapRoute(route: any, req: QuoteRequest): NormalizedQuote | null {
  const grossOut = bigintOrNull(route?.quoteCurrency?.quotient?.toString?.() ?? route?.trade?.amountOut);
  if (grossOut === null || grossOut <= 0n) return null;

  const path: string[] = Array.isArray(route?.trade?.path) ? route.trade.path : [];
  const syms =
    path.length >= 2
      ? path.map((addr) => bySac(addr)?.symbol ?? short(addr))
      : [req.sellAsset.symbol, req.buyAsset.symbol];

  let priceImpactPct: number | undefined;
  const pi = route?.priceImpact;
  if (pi != null) {
    const n = Number(typeof pi?.toFixed === 'function' ? pi.toFixed(6) : pi);
    if (Number.isFinite(n)) priceImpactPct = n;
  }

  return {
    source: 'soroswap',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut,
    feeBreakdown: [{ kind: 'pool', bps: 30, note: 'Soroswap 0,3 %' }],
    gasXlm: DEFAULT_GAS_XLM.soroban,
    gasInTarget: 0n,
    netOut: grossOut,
    netConfidence: 'exact',
    route: hops('soroswap', syms),
    priceImpactPct,
    raw: { trade: route?.trade, priceImpactPct },
  };
}

export const soroswap: SourceAdapter = {
  id: 'soroswap',
  available: () => true, // keyless (SDK local) ; si indisponible -> quote() rend null
  async quote(req, cfg) {
    try {
      return await liveRoute(req, cfg);
    } catch {
      return null;
    }
  },
};

async function liveRoute(req: QuoteRequest, cfg: SourceConfig): Promise<NormalizedQuote | null> {
  const { Router, Token, CurrencyAmount, TradeType, Protocol, Networks } = await import('soroswap-router-sdk');
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks: NW, Account, Keypair, Contract, scValToNative } = sdk;

  const server = new rpc.Server(cfg.rpcUrl || 'https://mainnet.sorobanrpc.com');
  const dummy = Keypair.random().publicKey();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simCall = async (contract: string, method: string, ...args: any[]): Promise<any> => {
    const tx = new TransactionBuilder(new Account(dummy, '0'), { fee: '100', networkPassphrase: NW.PUBLIC })
      .addOperation(new Contract(contract).call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
    return scValToNative(sim.result!.retval);
  };

  const pairAddr = await simCall(
    FACTORY,
    'get_pair',
    new Address(req.sellAsset.sac).toScVal(),
    new Address(req.buyAsset.sac).toScVal(),
  );
  const [reserves, token0, token1] = await Promise.all([
    simCall(pairAddr, 'get_reserves'),
    simCall(pairAddr, 'token_0'),
    simCall(pairAddr, 'token_1'),
  ]);

  const livePairs = [
    {
      tokenA: token0,
      tokenB: token1,
      reserveA: reserves[0].toString(),
      reserveB: reserves[1].toString(),
      protocol: Protocol.SOROSWAP,
      fee: '30',
    },
  ];

  const tIn = new Token(Networks.PUBLIC, req.sellAsset.sac, req.sellAsset.decimals, req.sellAsset.code, req.sellAsset.symbol);
  const tOut = new Token(Networks.PUBLIC, req.buyAsset.sac, req.buyAsset.decimals, req.buyAsset.code, req.buyAsset.symbol);
  const amountIn = CurrencyAmount.fromRawAmount(tIn, req.amountIn.toString());

  // Le SDK ecrit des logs de debug sur stdout : on les neutralise le temps du routage.
  const origLog = console.log;
  const origDebug = console.debug;
  const origInfo = console.info;
  console.log = console.debug = console.info = () => {};
  let route;
  try {
    const router = new Router({
      pairsCacheInSeconds: 20,
      protocols: [Protocol.SOROSWAP],
      network: Networks.PUBLIC,
      maxHops: 2,
      getPairsFns: [{ protocol: Protocol.SOROSWAP, fn: async () => livePairs }],
    });
    route = await router.route(amountIn, tOut, TradeType.EXACT_INPUT);
  } finally {
    console.log = origLog;
    console.debug = origDebug;
    console.info = origInfo;
  }
  if (!route) return null;
  return parseSoroswapRoute(route, req);
}
