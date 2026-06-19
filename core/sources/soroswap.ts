// Soroswap : agregateur Soroban. v1 KEYLESS = routage local (soroswap-router-sdk) sur les reserves
// du pool BLND/USDC lues en live via Soroban RPC (simulateTransaction, lecture seule). La math de frais
// de pool 0,3 % tourne dans le SDK => amountOut NET. Pas de pool direct => null (la source se retire).
// Multi-hop : le routeur recoit TOUS les pools existants entre {vendu, achete, USDC, XLM} (hubs profonds)
// et choisit le meilleur chemin (<= 2 hops). Sans pools intermediaires il ne route que le pool direct
// (souvent minuscule, ex. BLND/EURC) ; via USDC/XLM il trouve BLND->USDC->EURC, etc. 1 tx atomique.
import type { SourceAdapter, NormalizedQuote, QuoteRequest, SourceConfig } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { USDC, XLM, bySac } from '../assets.js';
import { bigintOrNull, hops, cached } from './util.js';
import { setReason, rpcReason } from './diag.js';
import { bumpRpc } from '../rpc-meter.js';

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
    } catch (e) {
      setReason(rpcReason(e));
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
    bumpRpc();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
    return scValToNative(sim.result!.retval);
  };

  // Univers d'actifs : vendu + achete + hubs Stellar profonds (USDC, XLM). Deduplique.
  const universe = Array.from(new Set([req.sellAsset.sac, req.buyAsset.sac, USDC.sac, XLM.sac]));
  const candidates: Array<[string, string]> = [];
  for (let i = 0; i < universe.length; i++) {
    for (let j = i + 1; j < universe.length; j++) candidates.push([universe[i]!, universe[j]!]);
  }

  // Lit chaque pool — MÉMOÏSÉ par paire {a,b} sur cfg.rpcCache (partagé par tout le tick) : les sondes
  // EURC relancent 3 sous-cotations qui re-lisent les mêmes pools → sans cache, rafale qui sature le RPC
  // public (429). Le résultat (token_0 + réserves) est indépendant de l'ordre/sens/taille → clé triée.
  // ponytail: drop silencieux d'un pool = Soroswap sous-cote (il perd, jamais de faux gagnant).
  const readPair = ([a, b]: [string, string]) =>
    cached(cfg.rpcCache, `soroswap:pool:${[a, b].slice().sort().join('|')}`, async () => {
      try {
        const pair = await simCall(FACTORY, 'get_pair', new Address(a).toScVal(), new Address(b).toScVal());
        const [reserves, token0] = await Promise.all([simCall(pair, 'get_reserves'), simCall(pair, 'token_0')]);
        const t0 = String(token0);
        return { tokenA: t0, tokenB: t0 === a ? b : a, reserveA: reserves[0].toString(), reserveB: reserves[1].toString(), protocol: Protocol.SOROSWAP, fee: '30' };
      } catch (e) {
        setReason(rpcReason(e)); // 429 / timeout / rpc — pour l'affichage santé
        return null;
      }
    });
  const livePairs = (await Promise.all(candidates.map(readPair)))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (livePairs.length === 0) { setReason('rpc'); return null; }

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
