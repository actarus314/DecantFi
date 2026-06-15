import { describe, it, expect } from 'vitest';
import { rankQuotes } from './rank.js';
import { quote } from '../test/factory.js';

describe('rankQuotes', () => {
  it('trie par netOut decroissant', () => {
    const r = rankQuotes([
      quote('a', 500_000_000n),
      quote('b', 509_000_000n),
      quote('c', 459_000_000n),
    ]);
    expect(r.ranked.map((q) => q.source)).toEqual(['b', 'a', 'c']);
    expect(r.best?.source).toBe('b');
    expect(r.ranked.map((q) => q.rank)).toEqual([1, 2, 3]);
  });

  it('best a deltaVsBestPct = 0 ; les autres negatifs', () => {
    const r = rankQuotes([quote('b', 509_000_000n), quote('c', 459_000_000n)]);
    expect(r.ranked[0]!.deltaVsBestPct).toBe(0);
    expect(r.ranked[1]!.deltaVsBestPct).toBeCloseTo(((459 - 509) / 509) * 100, 4);
  });

  it('ignore les netOut <= 0', () => {
    const r = rankQuotes([quote('a', 0n), quote('b', 100n), quote('c', -5n)]);
    expect(r.ranked.map((q) => q.source)).toEqual(['b']);
  });

  it('expose Horizon comme plancher', () => {
    const r = rankQuotes([quote('xbull', 509_000_000n), quote('horizon', 459_000_000n)]);
    expect(r.floor?.source).toBe('horizon');
  });

  it('liste vide', () => {
    const r = rankQuotes([]);
    expect(r.ranked).toEqual([]);
    expect(r.best).toBeUndefined();
  });
});
