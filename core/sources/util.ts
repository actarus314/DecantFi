// Helpers partages par les adapters.
import type { RouteHop } from './types.js';
import { toStroops } from '../amount.js';

/** bigint depuis un entier/chaine d'entier (stroops bruts), ou null. */
export function bigintOrNull(v: unknown): bigint | null {
  if (v == null) return null;
  try {
    return BigInt(v as string | number);
  } catch {
    return null;
  }
}

/** Stroops depuis une chaine decimale HUMAINE ("45.6531063"), ou null. */
export function stroopsOrNull(v: unknown): bigint | null {
  if (v == null) return null;
  try {
    return toStroops(String(v));
  } catch {
    return null;
  }
}

/**
 * Coalesce un appel async par clé dans un cache partagé (par tick / requête).
 * Deux appelants concurrents avec la même clé partagent la MÊME promesse → une seule lecture RPC.
 * Sans cache (undefined) : exécute directement. ponytail: pas d'éviction, le cache vit le temps du tick.
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

/** Construit des hops a partir d'une suite de symboles. */
export function hops(venue: string, symbols: string[]): RouteHop[] {
  const out: RouteHop[] = [];
  for (let i = 0; i < symbols.length - 1; i++) {
    out.push({ venue, sell: symbols[i]!, buy: symbols[i + 1]! });
  }
  return out;
}
