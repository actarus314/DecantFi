// Helpers shared by the adapters.
import type { RouteHop } from './types.js';
import { toStroops } from '../amount.js';

/** bigint from an integer/integer string (raw stroops), or null. */
export function bigintOrNull(v: unknown): bigint | null {
  if (v == null) return null;
  try {
    return BigInt(v as string | number);
  } catch {
    return null;
  }
}

/** Stroops from a HUMAN decimal string ("45.6531063"), or null. */
export function stroopsOrNull(v: unknown): bigint | null {
  if (v == null) return null;
  try {
    return toStroops(String(v));
  } catch {
    return null;
  }
}

/**
 * Coalesces an async call by key into a shared cache (per tick / request).
 * Two concurrent callers with the same key share the SAME promise → a single RPC read.
 * Without a cache (undefined): runs directly. ponytail: no eviction, the cache lives for the tick's duration.
 */
export function cached<T>(
  cache: Map<string, Promise<unknown>> | undefined,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!cache) return fn();
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const p = fn();
  cache.set(key, p);
  return p;
}

/** Builds hops from a sequence of symbols. */
export function hops(venue: string, symbols: string[]): RouteHop[] {
  const out: RouteHop[] = [];
  for (let i = 0; i < symbols.length - 1; i++) {
    out.push({ venue, sell: symbols[i]!, buy: symbols[i + 1]! });
  }
  return out;
}
