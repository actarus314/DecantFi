// Comet : sonde directe du pool backstop Blend 80/20 (BLND<->USDC UNIQUEMENT). Cross-check.
// Simule swap_exact_amount_in via Soroban RPC (lecture seule). Le transfer_from interne exige que
// `user` detienne le BLND => on utilise WALLET_ADDRESS (l'utilisateur sort SES positions, il detient BLND).
// Sans walletAddress ou si solde insuffisant => null (source retiree).
import type { SourceAdapter, NormalizedQuote, QuoteRequest, SourceConfig } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { hops } from './util.js';

// Pool backstop Blend 80/20 BLND/USDC (resolu on-chain ; design tronquait en CAS3FL6T...VEAM).
export const COMET_POOL = 'CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM';
const I128_MAX = 170141183460469231731687303715884105727n;

/** retval = vec [token_amount_out, spot_price_after] ; rend token_amount_out. */
export function decodeCometOut(native: unknown): bigint | null {
  let v: unknown = native;
  if (Array.isArray(native)) v = native[0];
  if (v == null) return null;
  try {
    const out = BigInt(v as string | number | bigint);
    return out > 0n ? out : null;
  } catch {
    return null;
  }
}

function isBlndUsdc(req: QuoteRequest): boolean {
  const pair = new Set([req.sellAsset.symbol, req.buyAsset.symbol]);
  return pair.size === 2 && pair.has('BLND') && pair.has('USDC');
}

export const comet: SourceAdapter = {
  id: 'comet',
  available: (cfg) => !!cfg.walletAddress,
  async quote(req, cfg) {
    if (!cfg.walletAddress || !isBlndUsdc(req)) return null;
    try {
      return await liveComet(req, cfg);
    } catch {
      return null;
    }
  },
};

async function liveComet(req: QuoteRequest, cfg: SourceConfig): Promise<NormalizedQuote | null> {
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks, Account, Contract, scValToNative, nativeToScVal } = sdk;

  const server = new rpc.Server(cfg.rpcUrl || 'https://mainnet.sorobanrpc.com');
  const user = cfg.walletAddress as string;
  const args = [
    new Address(req.sellAsset.sac).toScVal(),
    nativeToScVal(req.amountIn, { type: 'i128' }),
    new Address(req.buyAsset.sac).toScVal(),
    nativeToScVal(0n, { type: 'i128' }),
    nativeToScVal(I128_MAX, { type: 'i128' }),
    new Address(user).toScVal(),
  ];
  const tx = new TransactionBuilder(new Account(user, '0'), { fee: '100', networkPassphrase: Networks.PUBLIC })
    .addOperation(new Contract(COMET_POOL).call('swap_exact_amount_in', ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) return null;
  const grossOut = decodeCometOut(scValToNative(sim.result.retval));
  if (grossOut === null) return null;

  return {
    source: 'comet',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut,
    feeBreakdown: [{ kind: 'pool', note: 'Comet backstop 80/20' }],
    gasXlm: DEFAULT_GAS_XLM.soroban,
    gasInTarget: 0n,
    netOut: grossOut,
    netConfidence: 'exact',
    route: hops('comet', [req.sellAsset.symbol, req.buyAsset.symbol]),
    raw: { simulated: true },
  };
}
