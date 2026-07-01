// StellarBroker Mediator execution flow — browser bundle module.
// All SDK objects stay inside this bundle; only XDR strings + plain data + callbacks
// cross the bundle boundary into app.js (two stellar-sdk copies in the page would break instanceof).
//
// ⚠ SECURITY: This file contains the SOLE safety-net guard against fund drain.
//   makeGuardedTap() must be reviewed before every SDK upgrade.
//   See: advisory DECANT-SB-2026-001, core/sources/stellarbroker-guard.ts.

import { StellarBrokerClient, Mediator } from '@stellar-broker/client/src/index.js';
import { TransactionBuilder, Networks, Keypair } from '@stellar/stellar-sdk';
import { validateStreamedTx, SB_ROUTER_CONTRACT, SB_FEE_ACCOUNT } from '../core/sources/stellarbroker-guard';

/**
 * Build a guarded onmessage tap that intercepts tx frames from the WS and validates
 * them via validateStreamedTx before forwarding to the SDK.
 *
 * SECURITY PROPERTY: a blocked tx NEVER reaches origOnMessage → the SDK never invokes
 * the authorization callback → the ephemeral key NEVER signs a malicious tx.
 *
 * @param {{ origOnMessage: function, expected: object, onBlocked: function }} opts
 * @returns {function} onmessage handler to assign to client.socket.onmessage
 */
export function makeGuardedTap({ origOnMessage, expected, onBlocked }) {
  return function guardedOnMessage(ev) {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch {
      // Non-JSON frame (or binary control frame) — pass through unchanged.
      return origOnMessage(ev);
    }

    if (m.type === 'tx') {
      let tx;
      try {
        tx = TransactionBuilder.fromXDR(m.xdr, Networks.PUBLIC);
      } catch {
        // Unparseable XDR — safe default is to block, never to forward.
        onBlocked({ ok: false, reason: 'unparseable tx' });
        return;
      }

      const verdict = validateStreamedTx(tx, expected);
      if (!verdict.ok) {
        // Guard blocked — DO NOT call origOnMessage.
        // The SDK never sees this tx, so it never triggers its authorization
        // callback, so the ephemeral key never signs.
        onBlocked(verdict);
        return;
      }

      // Tx passed all guard checks — forward to SDK.
      return origOnMessage(ev);
    }

    // Non-tx frame (quote, progress, finished, …) — always pass through.
    return origOnMessage(ev);
  };
}

/**
 * Execute a StellarBroker Mediator swap.
 * Returns a plain object — no SDK types cross the bundle boundary.
 *
 * @param {object} opts
 * @param {string}    opts.partnerKey           StellarBroker partner API key
 * @param {string}    opts.sourcePub            Source account public key
 * @param {string}    opts.sellAsset            Asset to sell (e.g. 'BLND-GABC...')
 * @param {string}    opts.buyAsset             Asset to buy  (e.g. 'USDC-GA5...')
 * @param {string}    opts.amount               Amount to sell as string (e.g. '5000')
 * @param {function}  opts.signXdr              async (xdr: string, desc: string) => signedXdr: string
 * @param {function}  [opts.onProgress]         Optional: called with plain-object progress events
 * @param {string}    [opts.networkPassphrase]  Default: Networks.PUBLIC
 * @param {function}  [opts._mediatorFactory]   Test injection: replaces `new Mediator(...args)`
 * @param {function}  [opts._clientFactory]     Test injection: replaces `new StellarBrokerClient(opts)`
 * @returns {Promise<{ok: boolean, blocked?: boolean, finished?: object, error?: string, needsRecovery?: boolean, mediatorAddress?: string}>}
 */
export async function executeSbMediatorSwap({
  partnerKey,
  sourcePub,
  sellAsset,
  buyAsset,
  amount,
  signXdr,
  onProgress,
  networkPassphrase = Networks.PUBLIC,
  _mediatorFactory,
  _clientFactory,
  _disposeBackoffMs = 3000,
}) {
  // signTx wraps signXdr so the wallet can sign a raw XDR string while this
  // bundle's TransactionBuilder re-parses the result — guaranteeing that the
  // returned object is an instanceof THIS bundle's Transaction (not app.js's copy).
  const signTx = async (tx) => {
    const s = await signXdr(tx.toXDR(), 'StellarBroker funding');
    return TransactionBuilder.fromXDR(s, networkPassphrase);
  };

  const mediator = (_mediatorFactory ?? ((...a) => new Mediator(...a)))(
    sourcePub, sellAsset, buyAsset, amount, signTx,
  );

  let inited = false;
  let result;
  try {
    onProgress?.({ step: 'init', msg: 'Initialising mediator account (funds ephemeral)' });
    const secret = await mediator.init();
    inited = true;
    const ephemeral = Keypair.fromSecret(secret);
    const mediatorAddress = mediator.mediatorAddress;
    onProgress?.({ step: 'funding', msg: `Mediator account: ${mediatorAddress}` });

    // ephemeralAuth: the SDK calls this to authorize with the ephemeral key. The payload is a
    // Transaction (has .sign) for full-tx / fee-bump signing, or a 32-byte Buffer hash for
    // Soroban auth entries (blind-signed). Mirrors AuthorizationWrapper's Keypair branch.
    // Only ever invoked on txs that already passed makeGuardedTap.
    const ephemeralAuth = (payload) => {
      if (payload.sign) { payload.sign(ephemeral); return payload; } // Transaction → sign & return
      return ephemeral.sign(payload); // Buffer auth-entry hash → return raw signature
    };

    // expected: what the guard considers acceptable for this specific swap session.
    // maxSellAmount = exact user amount; the guard adds its own 1.001 dust tolerance.
    // maxFeeAmount  = 0.5% of sell amount (~20× the observed ~0.025% StellarBroker fee).
    const expected = {
      trader: mediatorAddress,
      maxSellAmount: parseFloat(amount),
      routerContractId: SB_ROUTER_CONTRACT,
      feeAccount: SB_FEE_ACCOUNT,
      maxFeeAmount: parseFloat(amount) * 0.005,
    };

    const client = (_clientFactory ?? ((o) => new StellarBrokerClient(o)))({
      partnerKey,
      account: mediatorAddress,
      authorization: ephemeralAuth,
    });

    try {
      onProgress?.({ step: 'streaming', msg: 'Connecting to StellarBroker' });
      const finished = await new Promise((resolve, reject) => {
        let settled = false;
        const done = (r) => { if (!settled) { settled = true; resolve(r); } };
        const fail = (e) => { if (!settled) { settled = true; reject(e); } };

        client.on('error',    (e) => fail(new Error(String(e?.error ?? e?.message ?? e))));
        client.on('finished', (e) => done(e.detail ?? e));
        client.on('progress', (e) => onProgress?.({ step: 'streaming', detail: e.detail ?? e }));
        client.on('quote', (e) => {
          try {
            // Received-side floor (P5b): capture SB's DECLARED floor (directTrade.buying,
            // human buy-asset units) → rate vs sold amount, stored on `expected` (same ref
            // the guard TAP reads). NEVER estimatedBuyingAmount (optimistic → false-block).
            // Defensive: any parse miss leaves minReceivedRate undefined → guard fail-open.
            // The quote event precedes the tx burst, so the guard sees the rate in time.
            const q = (e && e.detail) ? e.detail : e;
            const buying = q && (q.directTrade && q.directTrade.buying !== undefined
              ? q.directTrade.buying
              : (q.quote && q.quote.directTrade ? q.quote.directTrade.buying : undefined));
            const floor = parseFloat(buying);
            const sold = parseFloat(amount);
            if (Number.isFinite(floor) && floor > 0 && Number.isFinite(sold) && sold > 0) {
              expected.minReceivedRate = floor / sold;
            }
          } catch { /* fail-open: leave minReceivedRate undefined */ }
          try { client.confirmQuote(mediatorAddress, ephemeralAuth); }
          catch (err) { fail(err); }
        });

        client.connect().then(() => {
          // Wrap the SDK's socket handler with our guard tap.
          // Any tx that fails validation is blocked here; the SDK never sees it.
          const orig = client.socket.onmessage.bind(client.socket);
          client.socket.onmessage = makeGuardedTap({
            origOnMessage: orig,
            expected,
            onBlocked: (v) => {
              onProgress?.({ step: 'guard', blocked: true, reason: v.reason });
              fail(new Error('guard-blocked'));
            },
          });

          client.quote({
            sellingAsset: sellAsset,
            buyingAsset: buyAsset,
            sellingAmount: amount,
            slippageTolerance: 0.01,
          });
        }).catch(fail);

        // Hard timeout: 60 s, same as the spike.
        setTimeout(() => fail(new Error('swap timeout')), 60_000);
      });
      onProgress?.({ step: 'finished', detail: finished });
      result = { ok: true, finished };
    } catch (e) {
      result = e.message === 'guard-blocked' ? { ok: true, blocked: true } : { ok: false, error: e.message };
    } finally {
      // Streaming is over (blocked / error / finished): close the SB session so it stops
      // emitting progress events (which would otherwise flip the UI back to "streaming"),
      // and to close the WS cleanly server-side (design §8: avoid ban/rate-limit).
      try { client.stop(); } catch { /* socket already closing — ignore */ }
    }
  } catch (e) {
    // init/funding failed — nothing was funded, nothing to recover.
    result = { ok: false, error: e.message };
  } finally {
    if (inited) {
      // Retry dispose to survive the post-swap sequence/ledger settle race.
      // dispose() reloads the account each call, so a later attempt gets a fresh sequence.
      let disposed = false;
      for (let attempt = 1; attempt <= 3 && !disposed; attempt++) {
        try {
          onProgress?.({ step: 'dispose', msg: 'Returning funds and merging mediator account' });
          await mediator.dispose();
          disposed = true;
        } catch {
          if (attempt < 3) await new Promise((r) => setTimeout(r, _disposeBackoffMs * attempt));
        }
      }
      if (!disposed) {
        // Swap may have completed but funds are still in the mediator — surface honestly.
        result = { ...result, needsRecovery: true, mediatorAddress: mediator.mediatorAddress };
      }
    }
  }
  return result;
}

/**
 * Check if there are orphaned mediator accounts in localStorage for this source.
 * Call before starting a new swap to detect interrupted sessions.
 *
 * @param {string} sourcePub - Source account public key
 * @returns {boolean}
 */
export function hasObsoleteMediators(sourcePub) {
  return Mediator.hasObsoleteMediators(sourcePub);
}

/**
 * Recover funds from mediator accounts orphaned by an interrupted swap session.
 * The SDK stores active mediator secrets in localStorage under `msb_<address>`;
 * this reads those entries and calls dispose() on each.
 *
 * Static signature (from mediator.js):
 *   Mediator.disposeObsoleteMediators(source: string, authorization: function, storagePrefix?: string)
 *
 * @param {object} opts
 * @param {string}    opts.sourcePub           Source account public key
 * @param {function}  opts.signXdr             async (xdr: string, desc: string) => signedXdr: string
 * @param {string}    [opts.networkPassphrase] Default: Networks.PUBLIC
 * @param {function}  [opts.onProgress]        Optional progress callback
 */
export async function disposeObsoleteMediators({ sourcePub, signXdr, networkPassphrase = Networks.PUBLIC, onProgress }) {
  const signTx = async (tx) => {
    const s = await signXdr(tx.toXDR(), 'StellarBroker mediator dispose');
    return TransactionBuilder.fromXDR(s, networkPassphrase);
  };

  onProgress?.({ step: 'dispose-obsolete', msg: 'Disposing orphaned mediator accounts' });
  await Mediator.disposeObsoleteMediators(sourcePub, signTx);
  onProgress?.({ step: 'dispose-obsolete-done', msg: 'Done' });
}
