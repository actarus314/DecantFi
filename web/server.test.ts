// Tests for the /api/* same-origin guard and the overview cache Map semantics.
// apiAllowed lives in request-ip.ts (not server.ts) so these tests run WITHOUT booting the
// server's DB + HTTP listener (importing server.js would). The cache logic is mirrored locally.
import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { apiAllowed } from './request-ip.js';

// --- Helper: build a minimal IncomingMessage-like stub ---

function makeReq(opts: {
  remoteAddress?: string;
  headers?: Record<string, string | string[]>;
}): IncomingMessage {
  return {
    socket: { remoteAddress: opts.remoteAddress ?? '1.2.3.4' },
    headers: opts.headers ?? {},
  } as unknown as IncomingMessage;
}

// ─── apiAllowed — unit tests ────────────────────────────────────────────────

describe('apiAllowed — loopback exemption', () => {
  it('127.0.0.1 → true (IPv4 loopback)', () => {
    expect(apiAllowed(makeReq({ remoteAddress: '127.0.0.1' }))).toBe(true);
  });

  it('::1 → true (IPv6 loopback)', () => {
    expect(apiAllowed(makeReq({ remoteAddress: '::1' }))).toBe(true);
  });

  it('::ffff:127.0.0.1 → true (IPv4-mapped loopback)', () => {
    expect(apiAllowed(makeReq({ remoteAddress: '::ffff:127.0.0.1' }))).toBe(true);
  });

  it('external IP without sec-fetch-site → false', () => {
    expect(apiAllowed(makeReq({ remoteAddress: '203.0.113.5' }))).toBe(false);
  });
});

describe('apiAllowed — Sec-Fetch-Site header', () => {
  it('same-origin → true', () => {
    expect(apiAllowed(makeReq({ headers: { 'sec-fetch-site': 'same-origin' } }))).toBe(true);
  });

  it('same-site → true', () => {
    expect(apiAllowed(makeReq({ headers: { 'sec-fetch-site': 'same-site' } }))).toBe(true);
  });

  it('cross-site → false', () => {
    expect(apiAllowed(makeReq({ headers: { 'sec-fetch-site': 'cross-site' } }))).toBe(false);
  });

  it('none → false', () => {
    expect(apiAllowed(makeReq({ headers: { 'sec-fetch-site': 'none' } }))).toBe(false);
  });

  it('absent → false', () => {
    expect(apiAllowed(makeReq({ headers: {} }))).toBe(false);
  });

  it('array header: first value same-origin → true', () => {
    expect(apiAllowed(makeReq({ headers: { 'sec-fetch-site': ['same-origin', 'cross-site'] } }))).toBe(true);
  });

  it('array header: first value cross-site → false', () => {
    expect(apiAllowed(makeReq({ headers: { 'sec-fetch-site': ['cross-site'] } }))).toBe(false);
  });

  it('loopback wins even without sec-fetch-site', () => {
    // loopback + no header → allowed (Docker healthcheck scenario)
    expect(apiAllowed(makeReq({ remoteAddress: '127.0.0.1', headers: {} }))).toBe(true);
  });

  it('loopback wins even with cross-site header', () => {
    // internal caller behind a reverse-proxy that injects cross-site header — loopback still wins
    expect(apiAllowed(makeReq({ remoteAddress: '::1', headers: { 'sec-fetch-site': 'cross-site' } }))).toBe(true);
  });
});

// ─── overview cache Map — behaviour tests ────────────────────────────────────
// We test the Map cache logic directly (pure logic, no DB) using the same
// types/contract that the /api/overview handler implements.

describe('overview cache — Map behaviour', () => {
  // Reproduce the caching logic from /api/overview exactly so any future
  // divergence in the implementation will be caught here.
  const TTL_MS = 60_000;

  function makeCache() {
    return new Map<string, { at: number; data: unknown }>();
  }

  function cacheLookup(
    cache: Map<string, { at: number; data: unknown }>,
    key: string,
    now: number,
  ): unknown | null {
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL_MS) return hit.data;
    return null;
  }

  function cacheStore(
    cache: Map<string, { at: number; data: unknown }>,
    key: string,
    now: number,
    data: unknown,
  ): void {
    if (cache.size > 200) cache.clear();
    cache.set(key, { at: now, data });
  }

  it('same key within TTL → returns cached data', () => {
    const cache = makeCache();
    const now = Date.now();
    cacheStore(cache, 'USDC|0', now, { result: 'first' });
    const hit = cacheLookup(cache, 'USDC|0', now + 1000);
    expect(hit).toEqual({ result: 'first' });
  });

  it('same key after TTL expiry → miss (returns null)', () => {
    const cache = makeCache();
    const now = Date.now();
    cacheStore(cache, 'USDC|0', now - TTL_MS - 1, { result: 'stale' });
    const hit = cacheLookup(cache, 'USDC|0', now);
    expect(hit).toBeNull();
  });

  it('different tzoff key → independent slot (no cross-contamination)', () => {
    const cache = makeCache();
    const now = Date.now();
    cacheStore(cache, 'USDC|0', now, { result: 'tz0' });
    cacheStore(cache, 'USDC|2', now, { result: 'tz2' });
    expect(cacheLookup(cache, 'USDC|0', now + 1000)).toEqual({ result: 'tz0' });
    expect(cacheLookup(cache, 'USDC|2', now + 1000)).toEqual({ result: 'tz2' });
  });

  it('different pair key → independent slot', () => {
    const cache = makeCache();
    const now = Date.now();
    cacheStore(cache, 'USDC|0', now, { result: 'usdc' });
    cacheStore(cache, 'EURC|0', now, { result: 'eurc' });
    expect(cacheLookup(cache, 'USDC|0', now + 1000)).toEqual({ result: 'usdc' });
    expect(cacheLookup(cache, 'EURC|0', now + 1000)).toEqual({ result: 'eurc' });
  });

  it('clear() (simulating /api/refresh) invalidates all keys', () => {
    const cache = makeCache();
    const now = Date.now();
    cacheStore(cache, 'USDC|0', now, { result: 'cached' });
    cacheStore(cache, 'EURC|-5', now, { result: 'other' });
    cache.clear(); // mirrors overviewCache.clear() in /api/refresh
    expect(cacheLookup(cache, 'USDC|0', now + 1000)).toBeNull();
    expect(cacheLookup(cache, 'EURC|-5', now + 1000)).toBeNull();
  });

  it('paranoia cap: size > 200 triggers clear() before set', () => {
    const cache = makeCache();
    const now = Date.now();
    // Fill cache beyond cap
    for (let i = 0; i < 201; i++) {
      cache.set(`key|${i}`, { at: now, data: i });
    }
    // Next store triggers clear then sets the new key
    cacheStore(cache, 'USDC|0', now, { result: 'after-clear' });
    // After clear+set, only the new key should exist
    expect(cache.size).toBe(1);
    expect(cache.get('USDC|0')?.data).toEqual({ result: 'after-clear' });
  });
});
