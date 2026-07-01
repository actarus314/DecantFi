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

import { describe, it, expect, vi } from 'vitest';
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
import { makeGuardedTap, executeSbMediatorSwap } from './sb-mediator-flow.js';

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

// ── executeSbMediatorSwap — hermetic wiring tests ─────────────────────────────
//
// These tests exercise the execution flow using injected fakes (_mediatorFactory,
// _clientFactory) so no network, no real Stellar SDK client, and no timers > 0ms.
//
// Key bugs guarded against:
//   EXEC-1 — ephemeralAuth calling tx.sign() on a Buffer (32-byte hash payload)
//   EXEC-2 — guard tap not installed / origOnMessage called for blocked tx
//   EXEC-3 through EXEC-6 — dispose-retry / needsRecovery lifecycle

describe('executeSbMediatorSwap', () => {
  // Flush all pending microtasks (lets async flow advance without real delays).
  async function tick(n = 6): Promise<void> {
    for (let i = 0; i < n; i++) await Promise.resolve();
  }

  // ── Fake WebSocket client ───────────────────────────────────────────────────
  // Stores on() callbacks by event name; fire() dispatches them.
  // connect() resolves immediately and plants origSpy as socket.onmessage.
  // The flow's connect().then() then replaces it with the guard tap.
  function makeFakeClient() {
    const cbs: Record<string, Array<(...args: unknown[]) => void>> = {};
    const origSpy = vi.fn();
    let capturedAuth: ((p: unknown) => unknown) | undefined;

    const client = {
      on(event: string, cb: (...args: unknown[]) => void): void {
        (cbs[event] ??= []).push(cb);
      },
      connect: vi.fn(async (): Promise<void> => {
        client.socket = { onmessage: origSpy as unknown };
      }),
      stop:         vi.fn(),
      quote:        vi.fn(),
      confirmQuote: vi.fn(),
      // socket is mutated by connect() and again by the guard-tap installation.
      socket: { onmessage: origSpy as unknown },
      fire(event: string, payload: unknown): void {
        (cbs[event] ?? []).forEach((cb) => cb(payload));
      },
      origSpy,
    };

    function factory(opts: { authorization: (p: unknown) => unknown }) {
      capturedAuth = opts.authorization;
      return client;
    }

    return { client, factory, getAuth: (): ((p: unknown) => unknown) => capturedAuth! };
  }

  // ── Fake Mediator ───────────────────────────────────────────────────────────
  function makeFakeMediator(opts: {
    initRejects?: boolean;
    disposeFn?:   () => Promise<void>;
  } = {}) {
    const secret          = Keypair.random().secret();
    const mediatorAddress = Keypair.random().publicKey();
    const dispose = vi.fn(opts.disposeFn ?? ((): Promise<void> => Promise.resolve()));
    const init    = vi.fn(async (): Promise<string> => {
      if (opts.initRejects) throw new Error('init failed');
      return secret;
    });
    const mediator = { init, dispose, mediatorAddress };
    function factory() { return mediator; }
    return { factory, mediator, mediatorAddress };
  }

  // ── Base call options ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function baseOpts(cf: (...a: any[]) => any, mf: (...a: any[]) => any) {
    return {
      partnerKey:        'TEST_KEY',
      sourcePub:         Keypair.random().publicKey(),
      sellAsset:         'BLND-GABC',
      buyAsset:          'USDC-GDEF',
      amount:            '1000',
      signXdr:           async (x: string): Promise<string> => x,
      _disposeBackoffMs: 0,
      _clientFactory:    cf,
      _mediatorFactory:  mf,
    };
  }

  // ── EXEC-1 ──────────────────────────────────────────────────────────────────
  // Regression test for the "tx.sign is not a function" bug.
  // The ephemeralAuth callback must handle two payload shapes:
  //   (a) a Transaction-like object (has .sign)  → call .sign(ephemeral) and return it
  //   (b) a 32-byte Buffer hash                  → return a raw signature, never throw
  it('EXEC-1: ephemeralAuth handles Transaction payload and Buffer hash without throwing', async () => {
    const { client, factory: cf, getAuth } = makeFakeClient();
    const { factory: mf } = makeFakeMediator();

    const p = executeSbMediatorSwap(baseOpts(cf, mf));
    // One tick: init() resolves and _clientFactory is called → authorization captured.
    await tick();

    const auth = getAuth();
    expect(auth, 'authorization callback must be captured by _clientFactory').toBeDefined();

    // (a) Transaction-like payload: .sign() must be called, same object returned.
    const signMock = vi.fn();
    const fakeTx   = { sign: signMock };
    const txResult = auth(fakeTx);
    expect(signMock).toHaveBeenCalledOnce();
    expect(txResult).toBe(fakeTx);

    // (b) 32-byte Buffer hash: must NOT throw "tx.sign is not a function",
    //     must return a truthy signature (Buffer / Uint8Array).
    const hash = Buffer.alloc(32, 0xbe);
    let sig: unknown;
    expect(() => { sig = auth(hash); }).not.toThrow();
    expect(sig).toBeTruthy();

    // Settle the pending promise (drive flow to completion via error event).
    client.fire('error', { error: 'cleanup' });
    await p; // resolves as { ok: false, error: 'cleanup' } — does not reject
  });

  // ── EXEC-2 ──────────────────────────────────────────────────────────────────
  // After connect() the flow must replace socket.onmessage with the guard tap.
  // A blocked tx must NOT reach origSpy; the swap must settle as { ok:true, blocked:true }.
  it('EXEC-2: guard tap installed on connect; unparseable XDR blocks without calling origSpy', async () => {
    const { client, factory: cf } = makeFakeClient();
    const { factory: mf } = makeFakeMediator();

    const p = executeSbMediatorSwap(baseOpts(cf, mf));
    await tick(); // init + connect().then() run → tap installed

    // Tap must have replaced the original spy.
    expect(client.socket.onmessage).not.toBe(client.origSpy);
    expect(typeof client.socket.onmessage).toBe('function');

    // Feed unparseable XDR — the tap blocks it and must NOT forward to origSpy.
    const tap = client.socket.onmessage as (ev: { data: string }) => void;
    tap({ data: JSON.stringify({ type: 'tx', xdr: 'not-valid-xdr' }) });
    expect(client.origSpy).not.toHaveBeenCalled();

    // The guard-blocked path resolves the swap as { ok: true, blocked: true }.
    const result = await p;
    expect(result).toMatchObject({ ok: true, blocked: true });
    // client.stop() must be called once — streaming is over, WS must be closed.
    expect(client.stop).toHaveBeenCalledOnce();
  });

  // ── EXEC-3 ──────────────────────────────────────────────────────────────────
  it('EXEC-3: happy path — finished resolves, dispose called once, no needsRecovery', async () => {
    const { client, factory: cf } = makeFakeClient();
    const { factory: mf, mediator } = makeFakeMediator();

    const p = executeSbMediatorSwap(baseOpts(cf, mf));
    await tick();

    client.fire('quote',    {});
    client.fire('finished', { detail: { hash: 'a'.repeat(64) } });

    const result = await p as { ok: boolean; finished?: { hash: string }; needsRecovery?: unknown };
    expect(result.ok).toBe(true);
    expect(result.finished).toEqual({ hash: 'a'.repeat(64) });
    expect(mediator.dispose).toHaveBeenCalledOnce();
    expect(result.needsRecovery).toBeUndefined();
    // client.stop() must be called once — WS must be closed after streaming settles.
    expect(client.stop).toHaveBeenCalledOnce();
  });

  // ── EXEC-4 ──────────────────────────────────────────────────────────────────
  // dispose throws on the 1st attempt, succeeds on the 2nd.
  // Final result must NOT have needsRecovery; dispose must have been called twice.
  it('EXEC-4: dispose retry — 1st call throws, 2nd succeeds, no needsRecovery', async () => {
    let calls = 0;
    const { client, factory: cf } = makeFakeClient();
    const { factory: mf, mediator } = makeFakeMediator({
      disposeFn: async (): Promise<void> => {
        calls += 1;
        if (calls < 2) throw new Error('dispose race');
      },
    });

    const p = executeSbMediatorSwap(baseOpts(cf, mf));
    await tick();

    client.fire('quote',    {});
    client.fire('finished', { detail: { hash: 'b'.repeat(64) } });

    // await processes the two setTimeout(0) macrotasks for the retry backoff.
    const result = await p as { ok: boolean; needsRecovery?: unknown };
    expect(result.ok).toBe(true);
    expect(result.needsRecovery).toBeUndefined();
    expect(mediator.dispose).toHaveBeenCalledTimes(2);
  });

  // ── EXEC-5 ──────────────────────────────────────────────────────────────────
  // dispose always throws (exhausts all 3 attempts).
  // Result must have needsRecovery:true and mediatorAddress set; dispose called 3×.
  it('EXEC-5: dispose exhausted — needsRecovery:true, mediatorAddress set, dispose called 3×', async () => {
    const { client, factory: cf } = makeFakeClient();
    const { factory: mf, mediator, mediatorAddress } = makeFakeMediator({
      disposeFn: async (): Promise<void> => { throw new Error('always fails'); },
    });

    const p = executeSbMediatorSwap(baseOpts(cf, mf));
    await tick();

    client.fire('quote',    {});
    client.fire('finished', { detail: { hash: 'c'.repeat(64) } });

    const result = await p as { ok: boolean; needsRecovery?: boolean; mediatorAddress?: string };
    expect(result.needsRecovery).toBe(true);
    expect(result.mediatorAddress).toBe(mediatorAddress);
    expect(mediator.dispose).toHaveBeenCalledTimes(3);
  });

  // ── EXEC-6 ──────────────────────────────────────────────────────────────────
  // init() throws → result is { ok:false, error } with no dispose and no needsRecovery.
  it('EXEC-6: init failure — ok:false returned, dispose never called, no needsRecovery', async () => {
    const { factory: cf } = makeFakeClient();
    const { factory: mf, mediator } = makeFakeMediator({ initRejects: true });

    const result = await executeSbMediatorSwap(baseOpts(cf, mf)) as {
      ok: boolean; error?: string; needsRecovery?: unknown;
    };
    expect(result.ok).toBe(false);
    expect(result.error).toBe('init failed');
    expect(mediator.dispose).not.toHaveBeenCalled();
    expect(result.needsRecovery).toBeUndefined();
  });

  // ── EXEC-LEG2 ────────────────────────────────────────────────────────────────
  // Proves expected.maxSellAmount = parseFloat(amount) for the USDC→EURC leg2 cap.
  //
  // P4 passes `amount = usdcReceived` to executeSbMediatorSwap for leg2.
  // expected.maxSellAmount must equal that USDC amount — not a BLND amount.
  //
  // Observed indirectly via the installed guard tap:
  //   (a) at-cap tx (sendAmount = amount) passes → origSpy called → maxSellAmount ≥ amount
  //   (b) over-cap tx (sendAmount > amount×TOLERANCE) is blocked → maxSellAmount ≈ amount
  // If maxSellAmount were accidentally e.g. 5000 (a BLND amount), over-cap test (b) would
  // NOT block → origSpy would be called → test fails → bug caught.

  it('EXEC-LEG2a: at-cap self-delivery passes guard (proves maxSellAmount = usdcReceived)', async () => {
    const usdcReceived = '10.66';
    const { client, factory: cf } = makeFakeClient();
    const { factory: mf, mediatorAddress } = makeFakeMediator();

    const p = executeSbMediatorSwap({ ...baseOpts(cf, mf), amount: usdcReceived });
    await tick(); // init() resolves + connect().then() installs the guard tap

    // Self-delivery at exactly the cap: sendAmount === usdcReceived.
    // If maxSellAmount === 10.66: 10.66 ≤ 10.66×1.001=10.6707 → PASS → origSpy called.
    const legitXdr = buildTx({
      sendAsset:   Asset.native(),
      sendAmount:  usdcReceived,    // at cap
      destination: mediatorAddress, // must equal expected.trader
      destAsset:   Asset.native(),
      destMin:     '1',
      path:        [],
    });

    const tap = client.socket.onmessage as (ev: { data: string }) => void;
    tap({ data: JSON.stringify({ type: 'tx', xdr: legitXdr }) });

    // Guard passed → SDK handler (origSpy) must have been called exactly once.
    expect(client.origSpy).toHaveBeenCalledOnce();

    // Settle the swap normally.
    client.fire('finished', { hash: 'leg2-ok' });
    const result = await p;
    expect(result).toMatchObject({ ok: true });
  });

  it('EXEC-LEG2b: over-cap tx blocked — proves cap = usdcReceived, not a BLND amount', async () => {
    const usdcReceived = '10.66';
    const { client, factory: cf } = makeFakeClient();
    const { factory: mf, mediatorAddress } = makeFakeMediator();

    const p = executeSbMediatorSwap({ ...baseOpts(cf, mf), amount: usdcReceived });
    await tick(); // guard tap installed

    // 10.72 > 10.66×1.001 = 10.6707 → blocked if maxSellAmount === 10.66.
    // But if maxSellAmount were 5000: 10.72 ≤ 5000×1.001 → NOT blocked → this test fails → bug caught.
    const overCapXdr = buildTx({
      sendAsset:   Asset.native(),
      sendAmount:  '10.72',
      destination: mediatorAddress,
      destAsset:   Asset.native(),
      destMin:     '1',
      path:        [],
    });

    const tap = client.socket.onmessage as (ev: { data: string }) => void;
    tap({ data: JSON.stringify({ type: 'tx', xdr: overCapXdr }) });

    // Guard blocked → SDK handler must NOT have been called.
    expect(client.origSpy).not.toHaveBeenCalled();

    // Guard-blocked path resolves the swap as { ok: true, blocked: true }.
    const result = await p;
    expect(result).toMatchObject({ ok: true, blocked: true });
  });
});
