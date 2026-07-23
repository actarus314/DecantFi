// Comet: direct probe of the Blend 80/20 backstop pool (BLND<->USDC ONLY). Price cross-check.
// Simulates swap_exact_amount_in via Soroban RPC (READ ONLY). The output depends ONLY on the pool's
// reserves, not on the `user` identity; the user only serves the internal transfer_from (balance check).
// We simulate with an ordered list of witnesses (COMET_WITNESSES) — each holds BLND + a USDC trustline.
// We take the first whose simulation succeeds (sufficient balance). If the pool is absent => null (source drops out).
import type { SourceAdapter, NormalizedQuote, QuoteRequest, SourceConfig } from './types.js';
import { DEFAULT_GAS_XLM } from '../gas.js';
import { hops, cached } from './util.js';
import { setReason, rpcReason } from './diag.js';
import { bumpRpc } from '../rpc-meter.js';

// Blend 80/20 backstop pool BLND/USDC (resolved on-chain; some UIs truncate it as CAS3FL6T...VEAM).
export const COMET_POOL = 'CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM';
// Read-only quoting witnesses, ORDERED by decreasing BLND headroom: we take the FIRST whose
// simulation succeeds (sufficient balance). All hold a USDC trustline (receive the simulated output). The
// output depends ONLY on the pool's reserves, not on the user → a single witness would suffice, the list
// is just a safety net in case the 1st whale moves. Raises the previous ~2200 BLND cap that came from
// relying on a single witness (regression: Contract #10).
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
  available: () => true, // pool probe: no need for the user's wallet
  supports: (req) => isBlndUsdc(req), // BLND/USDC pool only: not listed as a "failure" elsewhere
  async quote(req, cfg) {
    if (!isBlndUsdc(req)) return null; // safety net (the supports() filter already excludes other pairs)
    // Memoized by (direction, amount): the BLND->USDC leg of an EURC probe duplicates the main USDC probe.
    return cached(cfg.rpcCache, `comet:swap:${req.sellAsset.sac}:${req.amountIn}:${req.buyAsset.sac}`, async () => {
      try {
        return await liveComet(req, cfg);
      } catch (e) {
        setReason(rpcReason(e)); // 429 / timeout / rpc — for the health display
        return null;
      }
    });
  },
};

async function liveComet(req: QuoteRequest, cfg: SourceConfig): Promise<NormalizedQuote | null> {
  const sdk = await import('@stellar/stellar-sdk');
  const { rpc, Address, TransactionBuilder, Networks, Account, Contract, scValToNative, nativeToScVal } = sdk;

  const server = new rpc.Server(cfg.rpcUrl || 'https://mainnet.sorobanrpc.com');
  // Loop over the witnesses: the output is independent of the user, and the user's wallet often doesn't
  // hold liquid BLND (staked in Blend) → otherwise the simulated transfer_from would fail.
  // We take the first witness whose simulation succeeds (error = insufficient balance → move to the next).
  // A network/RPC throw propagates as-is (handled by the try/catch upstream in quote()).
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

    bumpRpc();
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
