// Phoenix : AMM Soroban, sonde directe read-only via `simulate_swap` sur le contrat pool.
// Pas de pool BLND mainnet → inerte pour les paires BLND ; sert de cross-check de prix /
// préparation multi-jetons. simulate_swap = pure view (pas de transfer) → aucun témoin financé
// nécessaire, n'importe quelle adresse G... valide suffit comme source de la tx builder.
import type { SourceAdapter, NormalizedQuote, QuoteRequest, SourceConfig } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { hops, cached } from './util.js';
import { setReason, rpcReason } from './diag.js';
import { bumpRpc } from '../rpc-meter.js';
import { XLM, USDC, EURC } from '../assets.js';

// Compte source neutre pour la simulation read-only (simulate_swap = pure view, pas de transfer).
const PHOENIX_PROBE_SRC = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

/** Clé canonique de paire (ordre trié) : pairKey(A, B) == pairKey(B, A). */
const pairKey = (a: string, b: string) => [a, b].sort().join('|');

// Pools Phoenix confirmés on-chain. Clés = pairKey des deux SAC.
// BLND intentionnellement absent : aucun pool Phoenix BLND n'existe sur mainnet → adaptateur inerte
// pour les paires BLND. Des pools supplémentaires (PHO, EURx…) peuvent être ajoutés quand DecantFi
// couvrira ces actifs.
const POOLS: Record<string, { address: string; feeBps: number }> = {
  [pairKey(XLM.sac, USDC.sac)]: {
    address: 'CBHCRSVX3ZZ7EGTSYMKPEFGZNWRVCSESQR3UABET4MIW52N4EVU6BIZX',
    feeBps: 50,
  },
  [pairKey(XLM.sac, EURC.sac)]: {
    address: 'CBISULYO5ZGS32WTNCBMEFCNKNSLFXCQ4Z3XHVDP4X4FLPSEALGSY3PS',
    feeBps: 50,
  },
};

function poolFor(req: QuoteRequest): { address: string; feeBps: number } | undefined {
  return POOLS[pairKey(req.sellAsset.sac, req.buyAsset.sac)];
}

/** SimulateSwapResponse.ask_amount = net reçu (déjà net de commission). null si absent/≤0. */
export function decodePhoenixOut(native: unknown): bigint | null {
  if (native == null || typeof native !== 'object') return null;
  const ask = (native as Record<string, unknown>)['ask_amount'];
  if (ask == null) return null;
  try {
    const out = BigInt(ask as string | number | bigint);
    return out > 0n ? out : null;
  } catch {
    return null;
  }
}

export const phoenix: SourceAdapter = {
  id: 'phoenix',
  available: () => true,
  supports: (req) => poolFor(req) !== undefined,
  async quote(req, cfg) {
    const pool = poolFor(req);
    if (!pool) return null;
    return cached(cfg.rpcCache, `phoenix:swap:${req.sellAsset.sac}:${req.amountIn}:${req.buyAsset.sac}`, async () => {
      try {
        return await livePhoenix(req, cfg, pool);
      } catch (e) {
        setReason(rpcReason(e)); // 429 / timeout / rpc — pour l'affichage santé
        return null;
      }
    });
  },
};

async function livePhoenix(
  req: QuoteRequest,
  cfg: SourceConfig,
  pool: { address: string; feeBps: number },
): Promise<NormalizedQuote | null> {
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks, Account, Contract, scValToNative, nativeToScVal } = sdk;

  const server = new rpc.Server(cfg.rpcUrl || 'https://mainnet.sorobanrpc.com');

  const args = [
    new Address(req.sellAsset.sac).toScVal(),
    nativeToScVal(req.amountIn, { type: 'i128' }),
  ];

  const tx = new TransactionBuilder(new Account(PHOENIX_PROBE_SRC, '0'), {
    fee: '100',
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(new Contract(pool.address).call('simulate_swap', ...args))
    .setTimeout(30)
    .build();

  bumpRpc();
  const sim = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim) || !sim.result) {
    setReason('simulation');
    return null;
  }

  const out = decodePhoenixOut(scValToNative(sim.result.retval));
  if (out === null) {
    setReason('simulation');
    return null;
  }

  return {
    source: 'phoenix',
    sellAsset: req.sellAsset,
    buyAsset: req.buyAsset,
    amountIn: req.amountIn,
    grossOut: out,
    feeBreakdown: [{ kind: 'pool', bps: pool.feeBps, note: `Phoenix ${pool.feeBps}bps` }],
    gasXlm: DEFAULT_GAS_XLM.soroban,
    gasInTarget: 0n,
    netOut: out,
    netConfidence: 'exact',
    route: hops('phoenix', [req.sellAsset.symbol, req.buyAsset.symbol]),
    raw: { simulated: true },
  };
}
