import { describe, it, expect } from 'vitest';
import { isExecutableSource, EXECUTABLE_SOURCES } from './executable.js';

describe('isExecutableSource', () => {
  it('returns true for every declared executable source', () => {
    for (const src of EXECUTABLE_SOURCES) {
      expect(isExecutableSource(src), src).toBe(true);
    }
  });

  it('returns true for stellarbroker (wired for direct Mediator execution, P3)', () => {
    expect(isExecutableSource('stellarbroker')).toBe(true);
  });

  it('returns false for composite rows (contain "+")', () => {
    expect(isExecutableSource('xbull+soroswap')).toBe(false);
    expect(isExecutableSource('aquarius+xbull')).toBe(false);
    // composite with SB is still false (+ present)
    expect(isExecutableSource('comet+stellarbroker')).toBe(false);
  });

  it('trims whitespace before matching', () => {
    expect(isExecutableSource(' xbull ')).toBe(true);
    expect(isExecutableSource(' stellarbroker ')).toBe(true);
  });

  it('returns false for unknown sources', () => {
    expect(isExecutableSource('phoenix')).toBe(false);
    expect(isExecutableSource('')).toBe(false);
  });

  it('engine composite-leg predicate: isExecutableSource(s) && s !== stellarbroker', () => {
    // This is the predicate engine.ts passes to compareEurc (P3: SB excluded from composite legs
    // until leg2-via-SB is wired in P4, preserving the displayed==executed invariant).
    const compositeFilter = (s: string) => isExecutableSource(s) && s !== 'stellarbroker';
    expect(compositeFilter('xbull')).toBe(true);
    expect(compositeFilter('soroswap')).toBe(true);
    expect(compositeFilter('stellarbroker')).toBe(false);
    expect(compositeFilter('phoenix')).toBe(false);
  });
});
