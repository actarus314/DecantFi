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
