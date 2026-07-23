import { describe, it, expect } from 'vitest';
import { toStroops, fromStroops, toNumber } from './amount.js';

describe('toStroops', () => {
  it('integer', () => expect(toStroops('1000')).toBe(10_000_000_000n));
  it('short decimal', () => expect(toStroops('0.0512')).toBe(512_000n));
  it('full 7 decimals', () => expect(toStroops('50.9123456')).toBe(509_123_456n));
  it('JS integer number', () => expect(toStroops(1000)).toBe(10_000_000_000n));
  it('truncates beyond 7 decimals', () => expect(toStroops('1.123456789')).toBe(11_234_567n));
  it('zero', () => expect(toStroops('0')).toBe(0n));
  it('rejects empty', () => expect(() => toStroops('')).toThrow());
  it('rejects non-numeric', () => expect(() => toStroops('abc')).toThrow());
});

describe('fromStroops', () => {
  it('integer', () => expect(fromStroops(10_000_000_000n)).toBe('1000'));
  it('decimal', () => expect(fromStroops(509_123_456n)).toBe('50.9123456'));
  it('strips trailing zeros', () => expect(fromStroops(512_000n)).toBe('0.0512'));
  it('zero', () => expect(fromStroops(0n)).toBe('0'));
});

describe('round-trip', () => {
  it.each(['1000', '0.0512', '50.9123456', '46.7', '0.0000001'])('%s', (v) => {
    expect(fromStroops(toStroops(v))).toBe(v);
  });
});

describe('toNumber', () => {
  it('approximation', () => expect(toNumber(509_123_456n)).toBeCloseTo(50.9123456, 6));
});
