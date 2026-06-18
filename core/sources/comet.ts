// Comet : sonde directe du pool backstop Blend 80/20 (BLND<->USDC UNIQUEMENT). Cross-check de prix.
// Simule swap_exact_amount_in via Soroban RPC (LECTURE SEULE). La sortie ne depend QUE des reserves du
// pool, pas de l'identite du `user` ; le user ne sert qu'au transfer_from interne (controle de solde).
// On simule avec une liste de temoins ordonnee (COMET_WITNESSES) — chacun possede du BLND + une trustline
// USDC. On prend le 1er dont la simulation passe (solde suffisant). Si pool absent => null (source retiree).
import type { SourceAdapter, NormalizedQuote, QuoteRequest, SourceConfig } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { hops, cached } from './util.js';
import { setReason, rpcReason } from './diag.js';

// Pool backstop Blend 80/20 BLND/USDC (resolu on-chain ; design tronquait en CAS3FL6T...VEAM).
export const COMET_POOL = 'CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM';
// Témoins de cotation read-only, ORDONNÉS par headroom BLND décroissant : on prend le PREMIER dont la
// simulation passe (solde suffisant). Tous ont une trustline USDC (reçoivent la sortie simulée). La sortie
// ne dépend QUE des réserves du pool, pas du user → un témoin suffit, la liste n'est qu'une sécurité si le
// 1ᵉʳ whale bougeait. Lève l'ancien plafond ~2200 BLND (ancien témoin unique épuisé → Contract #10).
export const COMET_WITNESSES: readonly string[] = [
  'GCSNAGYPTFJKWK4424VBMYCCBLJIYZGAT2ZN67GPGAD7FEMIXISDHXVE', // ~7.58M BLND
  'GCA34HBKNLWN3AOXWBRW5Y3HSGHCWF3UDBRJ5YHGU6HWGJZEPO2NSXI3', // ~3.66M BLND
  'GBBF7X4FQ3HGRIDSNQ2HOPS6BP7ZERJN22Y54O5WAOAK4CAA4FV3K3G2', // ~1.5M BLND
];
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
  // Boucle sur les témoins : la sortie est indépendante du user, et le wallet de l'utilisateur ne détient
  // souvent pas de BLND liquide (staké dans Blend) → sinon le transfer_from simulé échouerait.
  // On prend le 1er témoin dont la simulation passe (erreur = solde insuffisant → passer au suivant).
  // Un throw réseau/RPC se propage tel quel (géré par le try/catch amont dans quote()).
  for (const user of COMET_WITNESSES) {
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
    if (rpc.Api.isSimulationError(sim) || !sim.result) continue;
    const grossOut = decodeCometOut(scValToNative(sim.result.retval));
    if (grossOut === null) continue;

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
  setReason('simulation');
  return null;
}
