// Comet : sonde directe du pool backstop Blend 80/20 (BLND<->USDC UNIQUEMENT). Cross-check de prix.
// Simule swap_exact_amount_in via Soroban RPC (LECTURE SEULE). La sortie ne depend QUE des reserves du
// pool, pas de l'identite du `user` ; le user ne sert qu'au transfer_from interne (controle de solde).
// On simule donc avec un detenteur-temoin (COMET_PROBE) qui possede du BLND + une trustline USDC, pour
// coter sans exiger que le wallet de l'utilisateur detienne du BLND liquide (souvent stake dans Blend).
// Au-dela du solde du temoin (gros montants) ou si le pool est absent => null (source retiree).
import type { SourceAdapter, NormalizedQuote, QuoteRequest, SourceConfig } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { hops, cached } from './util.js';
import { setReason, rpcReason } from './diag.js';

// Pool backstop Blend 80/20 BLND/USDC (resolu on-chain ; design tronquait en CAS3FL6T...VEAM).
export const COMET_POOL = 'CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM';
// Detenteur BLND (+ trustline USDC) utilise UNIQUEMENT comme source de la simulation read-only.
export const COMET_PROBE = 'GA23C2NY7WGU7AGBRKI2E4X2HDZRZGY7VUZZ4SZIVFV2RND3TG3YSUQE';
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
  available: () => true, // sonde de pool : pas besoin du wallet de l'utilisateur
  supports: (req) => isBlndUsdc(req), // pool BLND/USDC uniquement : non listee comme "echec" ailleurs
  async quote(req, cfg) {
    if (!isBlndUsdc(req)) return null; // garde-fou (le filtre supports() exclut deja les autres paires)
    // Mémoïsé par (sens, montant) : la jambe BLND->USDC d'une sonde EURC duplique la sonde USDC principale.
    return cached(cfg.rpcCache, `comet:swap:${req.sellAsset.sac}:${req.amountIn}:${req.buyAsset.sac}`, async () => {
      try {
        return await liveComet(req, cfg);
      } catch (e) {
        setReason(rpcReason(e)); // 429 / timeout / rpc — pour l'affichage santé
        return null;
      }
    });
  },
};

async function liveComet(req: QuoteRequest, cfg: SourceConfig): Promise<NormalizedQuote | null> {
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks, Account, Contract, scValToNative, nativeToScVal } = sdk;

  const server = new rpc.Server(cfg.rpcUrl || 'https://mainnet.sorobanrpc.com');
  // Toujours le temoin : la sortie est independante du user, et le wallet de l'utilisateur ne detient
  // souvent pas de BLND liquide (stake dans Blend) -> sinon le transfer_from simule echouerait.
  const user = COMET_PROBE;
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
  if (rpc.Api.isSimulationError(sim) || !sim.result) { setReason('simulation'); return null; }
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
