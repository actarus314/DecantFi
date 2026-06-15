import { describe, it, expect } from 'vitest';
import { convertXlmToTarget, DEFAULT_GAS_XLM } from './gas.js';
import { toNumber } from './amount.js';

describe('convertXlmToTarget', () => {
  it('convertit vers USDC via xlmUsd', () => {
    // 450000 stroops = 0,045 XLM ; @0,11 $ = 0,00495 $ -> 0,00495 USDC
    expect(toNumber(convertXlmToTarget(DEFAULT_GAS_XLM.soroban, 0.11, 1))).toBeCloseTo(0.00495, 5);
  });

  it('EURC : divise par eurUsd', () => {
    expect(toNumber(convertXlmToTarget(DEFAULT_GAS_XLM.soroban, 0.11, 1.1))).toBeCloseTo(0.0045, 5);
  });

  it('rend 0 si un prix manque', () => {
    expect(convertXlmToTarget(DEFAULT_GAS_XLM.soroban, null, 1)).toBe(0n);
    expect(convertXlmToTarget(DEFAULT_GAS_XLM.soroban, 0.11, null)).toBe(0n);
  });

  it('gas classique reste negligeable', () => {
    expect(toNumber(convertXlmToTarget(DEFAULT_GAS_XLM.classic, 0.11, 1))).toBeLessThan(0.0001);
  });
});
