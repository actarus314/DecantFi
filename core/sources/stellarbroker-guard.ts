// Anti-drain guard for StellarBroker streamed transactions.
// validateStreamedTx(tx, expected) — synchronous, returns { ok, reason }.
//
// This guard is a defense-in-depth validation on the fund-custody path.
// It does NOT inspect the BUY/output side (not a drain vector):
//   the output amount is not under our control and is not a custody risk.
// It caps per-streamed-tx with tx-level aggregate caps on sold and fee amounts.
//   All invokeHostFunction ops in a single tx count toward one shared budget.
//
// ponytail: assumes 7-decimal Stellar assets (BLND/USDC/EURC);
//   a non-7-dec token would need per-asset decimals.

import type { Transaction } from '@stellar/stellar-sdk';
import { StrKey, scValToNative } from '@stellar/stellar-sdk';
import { SB_FEE_ACCOUNT } from './stellarbroker.js';

export { SB_FEE_ACCOUNT };

/** Verified StellarBroker router contract id. */
export const SB_ROUTER_CONTRACT = 'CBWP275BNGLHWFTQVB6QHA67MLX7WTX6YZ5LNSUVOK7W2TMKWX7OPYOJ';

/** Allow 0.1% rounding slack on amounts. */
export const TOLERANCE = 1.001;

/** Received-side floor: reject a self-delivery whose destMin/sendAmount rate falls
 *  below this fraction of SB's declared floor rate. Loose by design — blocks only
 *  egregious shortfalls (destMin set well under SB's own committed floor), never
 *  honest ~1% slippage. Tunable at the live gate. Applied only when
 *  expected.minReceivedRate is provided (fail-open otherwise). */
export const RECEIVED_TOLERANCE = 0.9;

/** Stroops per human unit for 7-decimal Stellar assets (BLND/USDC/EURC). */
const STROOP_SCALE = 10_000_000;

export interface ValidateExpected {
  /** Mediator ephemeral account (the only allowed recipient of swap proceeds). */
  trader: string;
  /** Maximum total sold per tx in human units (e.g. 5000 for 5000 BLND). */
  maxSellAmount: number;
  /** Allowed Soroban router contract id (C… StrKey). No routerContractId → reject. */
  routerContractId: string;
  /** Optional: the only allowed non-trader destination (StellarBroker fee account). */
  feeAccount?: string;
  /** Max fee op amount in human units. */
  maxFeeAmount?: number;
  /** Optional received-side floor rate (buy-units per sell-unit) = SB's declared floor
   *  (directTrade.buying / soldAmount, human units). When set, a pathPaymentStrictSend
   *  self-delivery whose destMin/sendAmount < minReceivedRate × RECEIVED_TOLERANCE is
   *  rejected. Undefined → check skipped (fail-open). */
  minReceivedRate?: number;
}

/**
 * Validate a StellarBroker-streamed transaction against a strict allowlist.
 *
 * Rules:
 *   1. Op-type allowlist: pathPaymentStrictSend | pathPaymentStrictReceive | invokeHostFunction only.
 *   2. invokeHostFunction (hardened):
 *      (a) contract id must === expected.routerContractId
 *      (b) functionName must === 'swap' — pins the verified 6-arg layout
 *      (c) sold raw stroops <= ceil(maxSellAmount × TOLERANCE × STROOP_SCALE)
 *      (d) decoded trader === expected.trader
 *      Any decode failure → reject (safe default, never throw).
 *   3. pathPayment:
 *      - dest === trader → sold amount (sendAmount|sendMax) <= maxSellAmount × TOLERANCE
 *      - dest === feeAccount → must be pathPaymentStrictSend AND sendAmount <= maxFeeAmount
 *      - any other dest → DRAIN DETECTED, reject.
 */
export function validateStreamedTx(
  tx: Transaction,
  expected: ValidateExpected,
): { ok: boolean; reason: string } {
  const { trader, maxSellAmount, routerContractId, feeAccount, maxFeeAmount, minReceivedRate } = expected;
  const ops = tx.operations;

  if (!ops || ops.length === 0) {
    return { ok: false, reason: 'tx has no operations' };
  }

  // FIX: tx-level aggregate sold cap — all Soroban ops in this tx share one budget.
  const capRaw = BigInt(Math.ceil(maxSellAmount * TOLERANCE * STROOP_SCALE));
  let totalSoldRaw = 0n;
  // FIX: cumulative fee accounting — multiple fee ops must not exceed cap in aggregate.
  let totalFeeAmount = 0;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;

    // ── Rule 1: op-type allowlist ───────────────────────────────────────────
    if (
      op.type !== 'pathPaymentStrictSend' &&
      op.type !== 'pathPaymentStrictReceive' &&
      op.type !== 'invokeHostFunction'
    ) {
      return {
        ok: false,
        reason: `op[${i}] type '${op.type}' is not allowed (only pathPaymentStrictSend/Receive or invokeHostFunction)`,
      };
    }

    // ── Rule 2: invokeHostFunction (hardened) ───────────────────────────────
    if (op.type === 'invokeHostFunction') {
      if (!routerContractId) {
        return {
          ok: false,
          reason: `op[${i}] invokeHostFunction: no routerContractId configured — rejecting`,
        };
      }

      try {
        // XDR union types from stellar-base use runtime-generated shapes not fully modelled
        // by TypeScript. Mirror of the pattern in core/soroban-route.ts.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = op.func as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ic = fn.invokeContract() as any;

        // (a) contract id — safe decode or reject
        const contractId: string = StrKey.encodeContract(ic.contractAddress().contractId());
        if (contractId !== routerContractId) {
          return {
            ok: false,
            reason: `op[${i}] invokeHostFunction: contract ${contractId} !== allowed router ${routerContractId}`,
          };
        }

        // (b) function name — must be 'swap' (pins the verified 6-arg layout)
        const fname: string = String(ic.functionName());
        if (fname !== 'swap') {
          return {
            ok: false,
            reason: `op[${i}] invokeHostFunction: function '${fname}' !== 'swap' — unexpected arg layout`,
          };
        }

        // (c) sold amount cap
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawArgs: any[] = ic.args();
        if (!Array.isArray(rawArgs) || rawArgs.length < 3) {
          return {
            ok: false,
            reason: `op[${i}] invokeHostFunction: expected >=3 args, got ${Array.isArray(rawArgs) ? rawArgs.length : 'non-array'}`,
          };
        }

        let routes: Array<{ amount: bigint | string | number }>;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decoded = scValToNative(rawArgs[1] as any);
          if (!Array.isArray(decoded)) {
            return { ok: false, reason: `op[${i}] invokeHostFunction: routes (args[1]) is not an array` };
          }
          routes = decoded as Array<{ amount: bigint | string | number }>;
        } catch {
          return { ok: false, reason: `op[${i}] invokeHostFunction: could not decode routes (args[1])` };
        }

        // FIX: reject any route with a negative amount — a negative i128 can cancel a large
        // positive route so the sum appears within cap while the on-chain call processes
        // the full positive amount.
        for (const r of routes) {
          if (BigInt(r.amount) < 0n) {
            return {
              ok: false,
              reason: `op[${i}] invokeHostFunction: route has negative amount (${r.amount}) — rejecting`,
            };
          }
        }

        // FIX: aggregate cap — every Soroban op in this tx counts toward the shared budget.
        const soldRaw = routes.reduce((acc, r) => acc + BigInt(r.amount), 0n);
        totalSoldRaw += soldRaw;
        if (totalSoldRaw > capRaw) {
          return {
            ok: false,
            reason: `op[${i}] invokeHostFunction: aggregate sold ${totalSoldRaw} stroops > cap ${capRaw} (maxSellAmount=${maxSellAmount} × TOLERANCE)`,
          };
        }

        // (d) trader check
        let txTrader: string;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decodedTrader = scValToNative(rawArgs[2] as any);
          if (typeof decodedTrader !== 'string') {
            return { ok: false, reason: `op[${i}] invokeHostFunction: trader (args[2]) decoded to non-string` };
          }
          txTrader = decodedTrader;
        } catch {
          return { ok: false, reason: `op[${i}] invokeHostFunction: could not decode trader (args[2])` };
        }

        if (txTrader !== trader) {
          return {
            ok: false,
            reason: `op[${i}] invokeHostFunction: trader ${txTrader} !== expected ${trader}`,
          };
        }
      } catch {
        return {
          ok: false,
          reason: `op[${i}] invokeHostFunction: decode failed — rejecting (safe default)`,
        };
      }

      continue;
    }

    // ── Rule 3: pathPaymentStrictSend / pathPaymentStrictReceive ───────────
    // TypeScript narrows op to PathPaymentStrictSendResult | PathPaymentStrictReceiveResult here.
    const dest = op.destination;

    if (dest === trader) {
      // Self-delivery: swap paying out proceeds to the trader's account. Cap on sell side.
      let amount: number;
      if (op.type === 'pathPaymentStrictSend') {
        amount = parseFloat(op.sendAmount ?? '0');
      } else {
        // pathPaymentStrictReceive: the sell cap is sendMax (what we're allowed to spend)
        amount = parseFloat(op.sendMax ?? '0');
      }
      if (amount > maxSellAmount * TOLERANCE) {
        return {
          ok: false,
          reason: `op[${i}] self-delivery amount ${amount} exceeds maxSellAmount ${maxSellAmount}`,
        };
      }
      // Received-side floor (P5b): reject a dishonestly-low destMin. Only strictSend
      // carries a variable destMin; strictReceive delivers a fixed destAmount (no risk).
      // amount === sendAmount here for strictSend. Fail-open when minReceivedRate unset.
      if (op.type === 'pathPaymentStrictSend' && minReceivedRate !== undefined && amount > 0) {
        const destMin = parseFloat(op.destMin ?? '0');
        const actualRate = destMin / amount;
        if (actualRate < minReceivedRate * RECEIVED_TOLERANCE) {
          return {
            ok: false,
            reason: `op[${i}] self-delivery received floor: destMin/sold rate ${actualRate} < declared ${minReceivedRate} × ${RECEIVED_TOLERANCE} — degraded fill rejected`,
          };
        }
      }
      continue;
    }

    if (feeAccount && dest === feeAccount) {
      if (op.type !== 'pathPaymentStrictSend') {
        return {
          ok: false,
          reason: `op[${i}] fee payment must use pathPaymentStrictSend, got ${op.type}`,
        };
      }
      // op is narrowed to PathPaymentStrictSendResult here
      const amount = parseFloat(op.sendAmount ?? '0');
      // FIX: maxFeeAmount is required when feeAccount is configured — omitting it means
      // no cap at all, allowing unlimited drain to the fee account.
      if (maxFeeAmount === undefined) {
        return {
          ok: false,
          reason: `op[${i}] fee payment to ${dest}: maxFeeAmount is required when feeAccount is set — rejecting`,
        };
      }
      // FIX: cumulative cap — multiple fee ops must not exceed maxFeeAmount in aggregate.
      totalFeeAmount += amount;
      if (totalFeeAmount > maxFeeAmount) {
        return {
          ok: false,
          reason: `fee payments cumulative total ${totalFeeAmount} exceeds maxFeeAmount ${maxFeeAmount}`,
        };
      }
      continue;
    }

    // Any other destination is a drain attempt.
    return {
      ok: false,
      reason: `op[${i}] pathPayment destination ${dest} is neither the trader (${trader}) nor the feeAccount — DRAIN DETECTED`,
    };
  }

  return { ok: true, reason: 'all operations passed validation' };
}
