import { describe, it, expect } from 'vitest';
import { convertXlmToTarget, DEFAULT_GAS_XLM } from './gas.js';
import { toNumber } from './amount.js';

describe('convertXlmToTarget', () => {
  it('converts to USDC via xlmUsd', () => {
    // 450000 stroops = 0.045 XLM; @$0.11 = $0.00495 -> 0.00495 USDC
    expect(toNumber(convertXlmToTarget(DEFAULT_GAS_XLM.soroban, 0.11, 1))).toBeCloseTo(0.00495, 5);
  });

  it('EURC: divides by eurUsd', () => {
    expect(toNumber(convertXlmToTarget(DEFAULT_GAS_XLM.soroban, 0.11, 1.1))).toBeCloseTo(0.0045, 5);
  });

  it('returns 0 if a price is missing', () => {
    expect(convertXlmToTarget(DEFAULT_GAS_XLM.soroban, null, 1)).toBe(0n);
    expect(convertXlmToTarget(DEFAULT_GAS_XLM.soroban, 0.11, null)).toBe(0n);
  });

  it('classic gas stays negligible', () => {
    expect(toNumber(convertXlmToTarget(DEFAULT_GAS_XLM.classic, 0.11, 1))).toBeLessThan(0.0001);
  });
});
