import { describe, it, expect } from 'vitest';
import { toStroops, fromStroops, toNumber } from './amount.js';

describe('toStroops', () => {
  it('entier', () => expect(toStroops('1000')).toBe(10_000_000_000n));
  it('decimal court', () => expect(toStroops('0.0512')).toBe(512_000n));
  it('7 decimales pleines', () => expect(toStroops('50.9123456')).toBe(509_123_456n));
  it('nombre JS entier', () => expect(toStroops(1000)).toBe(10_000_000_000n));
  it('tronque au-dela de 7 decimales', () => expect(toStroops('1.123456789')).toBe(11_234_567n));
  it('zero', () => expect(toStroops('0')).toBe(0n));
  it('rejette le vide', () => expect(() => toStroops('')).toThrow());
  it('rejette le non-numerique', () => expect(() => toStroops('abc')).toThrow());
});

describe('fromStroops', () => {
  it('entier', () => expect(fromStroops(10_000_000_000n)).toBe('1000'));
  it('decimal', () => expect(fromStroops(509_123_456n)).toBe('50.9123456'));
  it('retire les zeros de fin', () => expect(fromStroops(512_000n)).toBe('0.0512'));
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
