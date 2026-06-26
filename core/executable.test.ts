import { describe, it, expect } from 'vitest';
import { isExecutableSource, EXECUTABLE_SOURCES } from './executable.js';

describe('isExecutableSource', () => {
  it('returns true for every declared executable source', () => {
    for (const src of EXECUTABLE_SOURCES) {
      expect(isExecutableSource(src), src).toBe(true);
    }
  });

  it('returns false for stellarbroker (not yet wired for execution)', () => {
    expect(isExecutableSource('stellarbroker')).toBe(false);
  });

  it('returns false for composite rows (contain "+")', () => {
    expect(isExecutableSource('xbull+soroswap')).toBe(false);
    expect(isExecutableSource('aquarius+xbull')).toBe(false);
  });

  it('trims whitespace before matching', () => {
    expect(isExecutableSource(' xbull ')).toBe(true);
    expect(isExecutableSource(' stellarbroker ')).toBe(false);
  });

  it('returns false for unknown sources', () => {
    expect(isExecutableSource('phoenix')).toBe(false);
    expect(isExecutableSource('')).toBe(false);
  });
});
