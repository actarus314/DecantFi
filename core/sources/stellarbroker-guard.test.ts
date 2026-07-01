// Hermetic tests for the StellarBroker anti-drain guard.
// Decodes REAL fixture XDRs from spike/sb-mediator/fixtures/ to verify rule enforcement
// against ground-truth values (verified by decoding the fixtures independently).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Transaction } from '@stellar/stellar-sdk';
import {
  TransactionBuilder,
  Networks,
  Keypair,
  StrKey,
  Operation,
  Asset,
  Account,
  xdr,
  Address,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import {
  validateStreamedTx,
  SB_ROUTER_CONTRACT,
  SB_FEE_ACCOUNT,
  RECEIVED_TOLERANCE,
  type ValidateExpected,
} from './stellarbroker-guard.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Resolve a fixture file relative to the spike directory (from this test's location). */
function fixture(name: string): string {
  return fileURLToPath(
    new URL(`../../spike/sb-mediator/fixtures/${name}`, import.meta.url),
  );
}

/** Decode a real StellarBroker-streamed XDR fixture. */
function decodeTx(name: string): Transaction {
  const xdr = readFileSync(fixture(name), 'utf8').trim();
  return TransactionBuilder.fromXDR(xdr, Networks.PUBLIC) as Transaction;
}

/** Build a minimal hand-crafted Transaction for edge-case tests. */
function buildTx(...ops: ReturnType<typeof Operation.pathPaymentStrictSend>[]): Transaction {
  const src = new Account(
    Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0xab)).publicKey(),
    '0',
  );
  let builder = new TransactionBuilder(src, {
    fee: '100',
    networkPassphrase: Networks.PUBLIC,
  });
  for (const op of ops) builder = builder.addOperation(op);
  return builder.setTimeout(0).build();
}

// ── Ground-truth addresses (verified by decoding fixtures) ─────────────────────

/** Real trader account from the blnd-usdc burst. Decoded from blnd-usdc-5000-0.xdr. */
const TRADER_BLND = 'GCA34HBKNLWN3AOXWBRW5Y3HSGHCWF3UDBRJ5YHGU6HWGJZEPO2NSXI3';

/** Real trader account from the usdc-eurc burst. Decoded from usdc-eurc-1000-0.xdr. */
const TRADER_EURC = 'GA6CCEOTOLYBDZ4KUQ4HYB75QVDWZQXU2CFDTG6FPGZRG5U7JLWML2FE';

// Deterministic dummy addresses for negative tests (no randomness → stable across runs)
const WRONG_TRADER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0x42)).publicKey();
const WRONG_CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 0x01));
const DRAIN_DEST = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0x99)).publicKey();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validateStreamedTx — blnd-usdc-5000-0.xdr (invokeHostFunction, 4875 BLND)', () => {
  const tx0 = decodeTx('blnd-usdc-5000-0.xdr');

  it('1. passes when sold (4875) is within maxSellAmount (5000)', () => {
    const result = validateStreamedTx(tx0, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('2. rejects when maxSellAmount (4000) is below sold (4875) — over-pull', () => {
    const result = validateStreamedTx(tx0, {
      trader: TRADER_BLND,
      maxSellAmount: 4000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/sold.*stroops.*cap/);
  });

  it('3. rejects when trader does not match — wrong recipient', () => {
    const result = validateStreamedTx(tx0, {
      trader: WRONG_TRADER,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/trader.*!==.*expected/);
  });

  it('4. rejects when routerContractId does not match — wrong router', () => {
    const result = validateStreamedTx(tx0, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: WRONG_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/contract.*!==.*allowed router/);
  });
});

describe('validateStreamedTx — blnd-usdc-5000-1.xdr (invokeHostFunction, 125 BLND)', () => {
  it('5. passes for the second split leg (125 BLND sold, maxSellAmount 5000)', () => {
    const tx1 = decodeTx('blnd-usdc-5000-1.xdr');
    const result = validateStreamedTx(tx1, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: true });
  });
});

describe('validateStreamedTx — usdc-eurc-1000-0.xdr (classic pathPayment, 2 ops)', () => {
  const txClassic = decodeTx('usdc-eurc-1000-0.xdr');

  it('6. passes: self-delivery op + fee op both within cap', () => {
    const result = validateStreamedTx(txClassic, {
      trader: TRADER_EURC,
      maxSellAmount: 1000,
      feeAccount: SB_FEE_ACCOUNT,
      maxFeeAmount: 5,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('7. rejects when maxFeeAmount (0.0001) is below fee sent (0.1527977)', () => {
    const result = validateStreamedTx(txClassic, {
      trader: TRADER_EURC,
      maxSellAmount: 1000,
      feeAccount: SB_FEE_ACCOUNT,
      maxFeeAmount: 0.0001,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/fee payment.*exceeds maxFeeAmount/);
  });
});

describe('validateStreamedTx — hand-built txs (edge cases)', () => {
  it('8. rejects pathPayment to arbitrary dest (neither trader nor feeAccount) — DRAIN DETECTED', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '100',
        destination: DRAIN_DEST,
        destAsset: Asset.native(),
        destMin: '1',
        path: [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/DRAIN DETECTED/);
  });

  it('9. rejects forbidden op type (payment)', () => {
    const src = new Account(
      Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0xab)).publicKey(),
      '0',
    );
    const tx = new TransactionBuilder(src, {
      fee: '100',
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(
        Operation.payment({
          destination: TRADER_BLND,
          asset: Asset.native(),
          amount: '100',
        }),
      )
      .setTimeout(0)
      .build();

    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/not allowed/);
  });
});

// ── Regression tests for confirmed holes ──────────────────────────────────────

/**
 * Build an invokeHostFunction 'swap' op against SB_ROUTER_CONTRACT.
 * routeAmounts: each element becomes one route entry with that `amount` (i128).
 * trader: the address encoded as args[2].
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeSwapOp(routeAmounts: bigint[], trader: string): any {
  const scAddr = new Address(SB_ROUTER_CONTRACT).toScAddress();
  // type spec format for objects: { fieldName: [keyType, valType] }
  // key encoded as scvSymbol so scValToNative returns string key 'amount';
  // value encoded as scvI128 so scValToNative returns bigint.
  const routes = routeAmounts.map((amount) =>
    nativeToScVal({ amount }, { type: { amount: ['symbol', 'i128'] } }),
  );
  const routesScVal = xdr.ScVal.scvVec(routes);
  const traderScVal = new Address(trader).toScVal();
  const dummyArg = nativeToScVal(0, { type: 'u32' });
  const hostFn = xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: scAddr,
      functionName: 'swap',
      args: [dummyArg, routesScVal, traderScVal],
    }),
  );
  return Operation.invokeHostFunction({ func: hostFn, auth: [] });
}

/** Build a tx containing any mix of operations. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMixedTx(...ops: any[]): Transaction {
  const src = new Account(
    Keypair.fromRawEd25519Seed(Buffer.alloc(32, 0xcd)).publicKey(),
    '0',
  );
  let builder = new TransactionBuilder(src, {
    fee: '100',
    networkPassphrase: Networks.PUBLIC,
  });
  for (const op of ops) builder = builder.addOperation(op);
  return builder.setTimeout(0).build();
}

describe('validateStreamedTx — regression tests for confirmed holes', () => {
  // ── capRaw for maxSellAmount=5000: ceil(5000 × 1.001 × 10_000_000) ─────────
  const capRaw = BigInt(Math.ceil(5000 * 1.001 * 10_000_000)); // 50_050_000_000n

  // ── HOLE 1: multi-op double-spend ─────────────────────────────────────────
  it('HOLE-1: two invokeHostFunction ops each at capRaw are rejected (tx-level aggregate)', () => {
    // Each op sells exactly capRaw stroops → total = 2 × capRaw > capRaw.
    const tx = buildMixedTx(
      makeSwapOp([capRaw], TRADER_BLND),
      makeSwapOp([capRaw], TRADER_BLND),
    );
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/aggregate sold.*stroops.*cap/);
  });

  it('HOLE-1b: a single op within cap passes (positive control for aggregate fix)', () => {
    const tx = buildMixedTx(makeSwapOp([capRaw], TRADER_BLND));
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: true });
  });

  // ── HOLE 2 & 6: negative i128 route amounts ───────────────────────────────
  it('HOLE-2: negative route amount (large positive + large negative = net within cap) is rejected', () => {
    // route[0]: +50050 BLND (10× over cap), route[1]: −49,550 BLND (cancels to ~1 BLND net)
    // without fix, sum = 500_000_000n ≤ capRaw so guard passed
    const bigPositive = 500_500_000_010n;
    const bigNegative = -(bigPositive - capRaw + 1n);
    const tx = buildMixedTx(makeSwapOp([bigPositive, bigNegative], TRADER_BLND));
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/negative amount/);
  });

  it('HOLE-6: routes [+10000 BLND, -9000 BLND] summing to under cap are rejected', () => {
    // sum = 10_000_000_000n ≤ capRaw, but route[0] alone = 10000 BLND = 2× budget
    const pos = 100_000_000_000n; // 10000 BLND
    const neg = -90_000_000_000n; //  9000 BLND (negative)
    const tx = buildMixedTx(makeSwapOp([pos, neg], TRADER_BLND));
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/negative amount/);
  });

  // ── HOLE 3 & 5: maxFeeAmount undefined = uncapped fee drain ──────────────
  it('HOLE-3: pathPaymentStrictSend of full budget to feeAccount passes when maxFeeAmount is undefined', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '5000',
        destination: SB_FEE_ACCOUNT,
        destAsset: Asset.native(),
        destMin: '0.0000001',
        path: [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 5000,
      routerContractId: SB_ROUTER_CONTRACT,
      feeAccount: SB_FEE_ACCOUNT,
      // maxFeeAmount intentionally omitted
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/maxFeeAmount is required/);
  });

  it('HOLE-5: tiny swap to trader + large pathPayment to feeAccount, maxFeeAmount undefined, is rejected', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '0.0000001',
        destination: TRADER_BLND,
        destAsset: Asset.native(),
        destMin: '0.0000001',
        path: [],
      }),
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '999',
        destination: SB_FEE_ACCOUNT,
        destAsset: Asset.native(),
        destMin: '0.0000001',
        path: [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 1000,
      routerContractId: SB_ROUTER_CONTRACT,
      feeAccount: SB_FEE_ACCOUNT,
      // maxFeeAmount intentionally omitted
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/maxFeeAmount is required/);
  });

  // ── HOLE 4: multiple fee ops bypass per-op cap (no cumulative accounting) ──
  it('HOLE-4: two fee ops each individually under cap but cumulative over are rejected', () => {
    // maxFeeAmount=5, each fee op = 4.99 → total = 9.98 > 5
    const feeOp = Operation.pathPaymentStrictSend({
      sendAsset: Asset.native(),
      sendAmount: '4.9900000',
      destination: SB_FEE_ACCOUNT,
      destAsset: Asset.native(),
      destMin: '0.0000001',
      path: [],
    });
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '0.01',
        destination: TRADER_BLND,
        destAsset: Asset.native(),
        destMin: '0.0000001',
        path: [],
      }),
      feeOp,
      feeOp,
    );
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 1000,
      routerContractId: SB_ROUTER_CONTRACT,
      feeAccount: SB_FEE_ACCOUNT,
      maxFeeAmount: 5,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/cumulative.*exceeds.*maxFeeAmount/);
  });

  it('HOLE-4b: single fee op at exactly maxFeeAmount passes (positive control)', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: '5',
        destination: SB_FEE_ACCOUNT,
        destAsset: Asset.native(),
        destMin: '0.0000001',
        path: [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader: TRADER_BLND,
      maxSellAmount: 1000,
      routerContractId: SB_ROUTER_CONTRACT,
      feeAccount: SB_FEE_ACCOUNT,
      maxFeeAmount: 5,
    });
    // 5 > 5 is false → should pass (no tolerance on fees by design)
    expect(result).toMatchObject({ ok: true });
  });
});

// ── P5a: USDC→EURC leg2 shape hermetic coverage ───────────────────────────────
//
// Proves validateStreamedTx is correct for the composite EURC leg2 shape where:
//   expected.maxSellAmount = usdcReceived  (USDC from leg1, e.g. 10.66)
//   trader                 = mediator ephemeral account (TRADER_EURC from fixture)
//   feeAccount / maxFeeAmount wired as for any SB swap (0.5% of sell amount)
//
// The guard is asset-agnostic: hand-crafted ops use Asset.native() for simplicity;
// the guard only inspects destinations and amounts, never asset codes.
// TRADER_EURC is decoded from usdc-eurc-1000-0.xdr (same fixture used in tests 6–7).

describe('validateStreamedTx — P5a USDC→EURC leg2 shape hermetic coverage', () => {
  // USDC amount received from leg1 — the cap for leg2.
  const LEG2_AMOUNT = 10.66;
  const LEG2_FEE   = LEG2_AMOUNT * 0.005; // 0.053 (StellarBroker fee ceiling at 0.5%)
  // capRaw reference (stroops): ceil(10.66 × 1.001 × 10_000_000) = 106_710_660n

  /** Baseline expected for leg2 with optional per-test overrides. */
  function leg2Expected(override: Partial<ValidateExpected> = {}): ValidateExpected {
    return {
      trader:           TRADER_EURC,
      maxSellAmount:    LEG2_AMOUNT,
      routerContractId: SB_ROUTER_CONTRACT,
      feeAccount:       SB_FEE_ACCOUNT,
      maxFeeAmount:     LEG2_FEE,
      ...override,
    };
  }

  // ── L2-1: ACCEPT — classic USDC→EURC self-delivery ──────────────────────
  it('L2-1: ACCEPT — pathPaymentStrictSend self-delivery (dest=trader, sendAmount at cap) → ok:true', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  String(LEG2_AMOUNT), // '10.66' — exactly at cap; 10.66 ≤ 10.66×1.001=10.6707
        destination: TRADER_EURC,
        destAsset:   Asset.native(),
        destMin:     '1',
        path:        [],
      }),
    );
    expect(validateStreamedTx(tx, leg2Expected())).toMatchObject({ ok: true });
  });

  // ── L2-2: ACCEPT — self-delivery + fee leg ──────────────────────────────
  it('L2-2: ACCEPT — self-delivery op + fee-leg op (both within caps) → ok:true', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '10',
        destination: TRADER_EURC,
        destAsset:   Asset.native(),
        destMin:     '1',
        path:        [],
      }),
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '0.05',         // < LEG2_FEE (0.053) → within cap
        destination: SB_FEE_ACCOUNT,
        destAsset:   Asset.native(),
        destMin:     '0.0000001',
        path:        [],
      }),
    );
    expect(validateStreamedTx(tx, leg2Expected())).toMatchObject({ ok: true });
  });

  // ── L2-3: ACCEPT — Soroban USDC→EURC ────────────────────────────────────
  it('L2-3: ACCEPT — invokeHostFunction swap on SB_ROUTER, routes within cap, trader matches → ok:true', () => {
    // 10 USDC = 100_000_000 stroops; capRaw = 106_710_660 → within budget.
    const tx = buildMixedTx(makeSwapOp([100_000_000n], TRADER_EURC));
    expect(validateStreamedTx(tx, leg2Expected())).toMatchObject({ ok: true });
  });

  // ── L2-4: REJECT — drain to third party ─────────────────────────────────
  it('L2-4: REJECT — pathPaymentStrictSend to third-party dest (≠ trader, ≠ feeAccount) → DRAIN DETECTED', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '10',
        destination: DRAIN_DEST,    // attacker address — neither trader nor fee account
        destAsset:   Asset.native(),
        destMin:     '1',
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, leg2Expected());
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/DRAIN DETECTED/);
  });

  // ── L2-5: REJECT — sold over cap ─────────────────────────────────────────
  it('L2-5: REJECT — self-delivery sendAmount 10.72 > maxSellAmount × TOLERANCE (10.6707) → ok:false', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '10.72',       // > 10.66 × 1.001 = 10.6707 → over cap
        destination: TRADER_EURC,
        destAsset:   Asset.native(),
        destMin:     '1',
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, leg2Expected());
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/exceeds maxSellAmount/);
  });

  // ── L2-6: REJECT — fee leg without maxFeeAmount ──────────────────────────
  it('L2-6: REJECT — fee payment to feeAccount with maxFeeAmount omitted → ok:false', () => {
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '0.05',
        destination: SB_FEE_ACCOUNT,
        destAsset:   Asset.native(),
        destMin:     '0.0000001',
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, leg2Expected({ maxFeeAmount: undefined }));
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/maxFeeAmount is required/);
  });

  // ── L2-7: MIXED burst — Soroban + classic in the same tx ─────────────────
  it('L2-7a: ACCEPT — mixed burst (Soroban within cap + classic self-delivery within cap) → ok:true', () => {
    // Soroban leg:  5 USDC = 50_000_000 stroops < capRaw (106_710_660).
    // Classic leg:  sendAmount '5' ≤ 10.66 × 1.001 (per-op cap).
    const tx = buildMixedTx(
      makeSwapOp([50_000_000n], TRADER_EURC),
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '5',
        destination: TRADER_EURC,
        destAsset:   Asset.native(),
        destMin:     '1',
        path:        [],
      }),
    );
    expect(validateStreamedTx(tx, leg2Expected())).toMatchObject({ ok: true });
  });

  it('L2-7b: REJECT — mixed burst where classic self-delivery (10.72) exceeds per-op cap → ok:false', () => {
    // Soroban op (5 USDC) passes its aggregate check; classic op then fails its per-op check.
    // 10.72 > 10.66 × 1.001 = 10.6707 → guard rejects before the tx can be signed.
    const tx = buildMixedTx(
      makeSwapOp([50_000_000n], TRADER_EURC),
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '10.72',
        destination: TRADER_EURC,
        destAsset:   Asset.native(),
        destMin:     '1',
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, leg2Expected());
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/exceeds maxSellAmount/);
  });
});

// ── P5b: received-side floor check ────────────────────────────────────────────
//
// The guard is asset-agnostic; Asset.native() is used for all ops here.
// Trader = TRADER_BLND (self-delivery destination).
// RECEIVED_TOLERANCE = 0.9 → floor threshold = minReceivedRate × 0.9.
// Existing tests never set minReceivedRate → they remain fail-open (no regression).

describe('validateStreamedTx — P5b received-side floor', () => {
  // ── P5b-1: ACCEPT — honest fill ────────────────────────────────────────────
  it('P5b-1: ACCEPT — destMin/sendAmount rate equals declared floor (0.5 ≥ 0.5×0.9=0.45) → ok:true', () => {
    // sendAmount 5000, destMin 2500 → actualRate = 0.5; threshold = 0.5 × 0.9 = 0.45
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '5000',
        destination: TRADER_BLND,
        destAsset:   Asset.native(),
        destMin:     '2500',
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader:          TRADER_BLND,
      maxSellAmount:   5000,
      routerContractId: SB_ROUTER_CONTRACT,
      minReceivedRate: 0.5,
    });
    expect(result).toMatchObject({ ok: true });
  });

  // ── P5b-2: REJECT — egregiously low destMin ────────────────────────────────
  it('P5b-2: REJECT — destMin 100 vs sendAmount 5000 (rate 0.02 < 0.45 threshold) → ok:false, reason "received floor"', () => {
    // actualRate = 100/5000 = 0.02; threshold = 0.5 × 0.9 = 0.45 → blocked
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '5000',
        destination: TRADER_BLND,
        destAsset:   Asset.native(),
        destMin:     '100',
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader:          TRADER_BLND,
      maxSellAmount:   5000,
      routerContractId: SB_ROUTER_CONTRACT,
      minReceivedRate: 0.5,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/received floor/);
  });

  // ── P5b-3: ACCEPT (fail-open) — minReceivedRate absent ───────────────────
  it('P5b-3: ACCEPT (fail-open) — minReceivedRate undefined, destMin egregiously low → ok:true (check skipped)', () => {
    // Low destMin but minReceivedRate is NOT set → guard skips the floor check entirely.
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '5000',
        destination: TRADER_BLND,
        destAsset:   Asset.native(),
        destMin:     '100',
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader:          TRADER_BLND,
      maxSellAmount:   5000,
      routerContractId: SB_ROUTER_CONTRACT,
      // minReceivedRate intentionally omitted → fail-open
    });
    expect(result).toMatchObject({ ok: true });
  });

  // ── P5b-4: ACCEPT — slippage within the 0.9 tolerance margin ──────────────
  it('P5b-4: ACCEPT — destMin 2340 vs sendAmount 5000 (rate 0.468 ≥ threshold 0.45) → ok:true', () => {
    // actualRate = 2340/5000 = 0.468; threshold = 0.5 × 0.9 = 0.45 → passes
    // Proves honest ~6% slippage below the declared floor is accepted by the loose tolerance.
    const tx = buildTx(
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '5000',
        destination: TRADER_BLND,
        destAsset:   Asset.native(),
        destMin:     '2340',
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader:          TRADER_BLND,
      maxSellAmount:   5000,
      routerContractId: SB_ROUTER_CONTRACT,
      minReceivedRate: 0.5,
    });
    expect(result).toMatchObject({ ok: true });
  });

  // ── P5b-5: NOT-APPLIED to pathPaymentStrictReceive ────────────────────────
  it('P5b-5: NOT-APPLIED to strictReceive — floor check only runs on strictSend; strictReceive passes → ok:true', () => {
    // pathPaymentStrictReceive has no destMin (has destAmount instead); the P5b check
    // must be skipped entirely for this op type even when minReceivedRate is set.
    // sendMax 5000 ≤ maxSellAmount×TOLERANCE → sell cap also passes.
    const tx = buildMixedTx(
      Operation.pathPaymentStrictReceive({
        sendAsset:   Asset.native(),
        sendMax:     '5000',
        destination: TRADER_BLND,
        destAsset:   Asset.native(),
        destAmount:  '1',    // low, but P5b does not inspect destAmount for strictReceive
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader:          TRADER_BLND,
      maxSellAmount:   5000,
      routerContractId: SB_ROUTER_CONTRACT,
      minReceivedRate: 0.5,  // set, but must NOT trigger for strictReceive
    });
    expect(result).toMatchObject({ ok: true });
  });

  // ── P5b-6: NOT-APPLIED to fee op ──────────────────────────────────────────
  it('P5b-6: NOT-APPLIED to fee op — feeAccount pathPaymentStrictSend with low destMin not rejected by floor → ok:true', () => {
    // The fee op goes to SB_FEE_ACCOUNT (feeAccount branch), NOT the self-delivery branch.
    // The P5b floor check lives ONLY inside the self-delivery (dest===trader) block.
    // A low destMin on the fee op must NOT trigger the received-floor rejection.
    const tx = buildTx(
      // Valid self-delivery (sendAmount within cap, normal destMin)
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '5000',
        destination: TRADER_BLND,
        destAsset:   Asset.native(),
        destMin:     '2500',
        path:        [],
      }),
      // Fee op to feeAccount: within maxFeeAmount but destMin extremely low
      Operation.pathPaymentStrictSend({
        sendAsset:   Asset.native(),
        sendAmount:  '0.05',
        destination: SB_FEE_ACCOUNT,
        destAsset:   Asset.native(),
        destMin:     '0.0000001', // egregiously low, but P5b must NOT apply here
        path:        [],
      }),
    );
    const result = validateStreamedTx(tx, {
      trader:          TRADER_BLND,
      maxSellAmount:   5000,
      routerContractId: SB_ROUTER_CONTRACT,
      feeAccount:      SB_FEE_ACCOUNT,
      maxFeeAmount:    1,
      minReceivedRate: 0.5,  // set, but must NOT trigger for the fee op
    });
    expect(result).toMatchObject({ ok: true });
  });
});
