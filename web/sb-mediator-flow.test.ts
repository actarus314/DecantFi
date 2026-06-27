// Hermetic security tests for makeGuardedTap — the socket TAP that is the SOLE
// safety net preventing a malicious StellarBroker tx from reaching the SDK
// (and thus the ephemeral signing key).
//
// WHAT IS TESTED: makeGuardedTap (synchronous, no network, no SDK client).
// WHAT IS NOT TESTED: executeSbMediatorSwap live path (init / stream / dispose).
//   That path requires a live Stellar mainnet + StellarBroker WS; validation is S4.
//
// Test names correspond to the four key properties of the guard:
//   TAP-1: legitimate tx passes through to origOnMessage
//   TAP-2: drain tx is blocked — origOnMessage is NEVER called
//   TAP-3: non-tx control frame always passes through
//   TAP-4: unparseable XDR is blocked (safe default)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  TransactionBuilder,
  Networks,
  Keypair,
  Operation,
  Asset,
  Account,
} from '@stellar/stellar-sdk';
import { SB_ROUTER_CONTRACT } from '../core/sources/stellarbroker-guard.js';
import { makeGuardedTap } from './sb-mediator-flow.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Resolve a fixture relative to the spike directory. */
function fixturePath(name: string): string {
  return fileURLToPath(
    new URL(`../spike/sb-mediator/fixtures/${name}`, import.meta.url),
  );
}

/** Read a raw XDR fixture (base64 string). */
function fixtureXdr(name: string): string {
  return readFileSync(fixturePath(name), 'utf8').trim();
}

/** Build a minimal Transaction containing the given ops. */
function buildTx(...ops: Parameters<typeof Operation.pathPaymentStrictSend>[0][]): string {
  const src = new Account(
    Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0xab)).publicKey(),
    '0',
  );
  let builder = new TransactionBuilder(src, {
    fee: '100',
    networkPassphrase: Networks.PUBLIC,
  });
  for (const op of ops) {
    builder = builder.addOperation(
      Operation.pathPaymentStrictSend(op as Parameters<typeof Operation.pathPaymentStrictSend>[0]),
    );
  }
  return builder.setTimeout(0).build().toXDR();
}

/** Build a plain spy: { fn, calls }. */
function spy() {
  const calls: unknown[][] = [];
  const fn = (...args: unknown[]) => { calls.push(args); };
  return { fn, calls };
}

/** Build a fake WS event from a plain object. */
function wsEvent(payload: unknown): MessageEvent {
  return { data: JSON.stringify(payload) } as MessageEvent;
}

// ── Ground-truth addresses (from the guard test — verified by decoding fixtures) ──

/** Real trader from blnd-usdc-5000-0.xdr (the mediator ephemeral account). */
const TRADER_BLND = 'GCA34HBKNLWN3AOXWBRW5Y3HSGHCWF3UDBRJ5YHGU6HWGJZEPO2NSXI3';

/** Deterministic attacker address — not the trader, not a fee account. */
const DRAIN_DEST = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0x99)).publicKey();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('makeGuardedTap', () => {
  /**
   * TAP-1: positive control.
   * blnd-usdc-5000-0.xdr is a LEGIT StellarBroker invokeHostFunction swap to
   * TRADER_BLND selling 4875 BLND — well within maxSellAmount=5000.
   * The guard should pass it; origOnMessage must be called; onBlocked must NOT be.
   */
  it('TAP-1: legitimate tx (blnd-usdc-5000-0.xdr) passes to origOnMessage', () => {
    const orig = spy();
    const blocked = spy();

    const expected = {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    };

    const tap = makeGuardedTap({
      origOnMessage: orig.fn,
      expected,
      onBlocked: blocked.fn,
    });

    tap(wsEvent({ type: 'tx', xdr: fixtureXdr('blnd-usdc-5000-0.xdr') }));

    expect(orig.calls).toHaveLength(1);
    expect(blocked.calls).toHaveLength(0);
  });

  /**
   * TAP-2: drain attempt — the critical security assertion.
   * A pathPaymentStrictSend to an arbitrary attacker address (DRAIN_DEST) that
   * is neither the trader nor a fee account must be blocked.
   *
   * PROPERTY: origOnMessage is NEVER called → the SDK never receives the tx →
   * the SDK never invokes its authorization callback → the ephemeral key
   * NEVER signs the malicious tx.
   */
  it('TAP-2: drain tx to attacker address — onBlocked called, origOnMessage NOT called', () => {
    const orig = spy();
    const blocked = spy();

    // Build a tx that sends funds to an attacker (not the trader or fee account).
    const drainXdr = buildTx({
      sendAsset: Asset.native(),
      sendAmount: '100',
      destination: DRAIN_DEST,
      destAsset: Asset.native(),
      destMin: '1',
      path: [],
    });

    const expected = {
      trader: TRADER_BLND,          // different from DRAIN_DEST → DRAIN DETECTED
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    };

    const tap = makeGuardedTap({
      origOnMessage: orig.fn,
      expected,
      onBlocked: blocked.fn,
    });

    tap(wsEvent({ type: 'tx', xdr: drainXdr }));

    // origOnMessage must NOT have been called — the tx never reached the SDK.
    expect(orig.calls).toHaveLength(0);

    // onBlocked must have been called with a DRAIN-related reason.
    expect(blocked.calls).toHaveLength(1);
    const verdict = blocked.calls[0]![0] as { ok: boolean; reason: string };
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/DRAIN DETECTED/);
  });

  /**
   * TAP-3: non-tx control frame (e.g. 'quote') always passes through unchanged.
   * The guard must not interfere with the SDK's quote/progress/finished protocol.
   */
  it('TAP-3: non-tx control frame (type=quote) passes to origOnMessage', () => {
    const orig = spy();
    const blocked = spy();

    const tap = makeGuardedTap({
      origOnMessage: orig.fn,
      expected: {
        trader: TRADER_BLND,
        maxSellAmount: 5000,
        routerContractId: SB_ROUTER_CONTRACT,
      },
      onBlocked: blocked.fn,
    });

    tap(wsEvent({ type: 'quote', data: { someField: 1 } }));

    expect(orig.calls).toHaveLength(1);
    expect(blocked.calls).toHaveLength(0);
  });

  /**
   * TAP-4: unparseable XDR — safe default is to block, never to forward.
   * Corrupted or spoofed XDR frames must not reach the SDK.
   */
  it('TAP-4: unparseable XDR — onBlocked called (safe default), origOnMessage NOT called', () => {
    const orig = spy();
    const blocked = spy();

    const tap = makeGuardedTap({
      origOnMessage: orig.fn,
      expected: {
        trader: TRADER_BLND,
        maxSellAmount: 5000,
        routerContractId: SB_ROUTER_CONTRACT,
      },
      onBlocked: blocked.fn,
    });

    tap(wsEvent({ type: 'tx', xdr: 'not-valid-xdr' }));

    expect(orig.calls).toHaveLength(0);
    expect(blocked.calls).toHaveLength(1);
    const verdict = blocked.calls[0]![0] as { ok: boolean; reason: string };
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('unparseable tx');
  });
});
