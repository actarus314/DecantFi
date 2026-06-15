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

/** Construit des hops a partir d'une suite de symboles. */
export function hops(venue: string, symbols: string[]): RouteHop[] {
  const out: RouteHop[] = [];
  for (let i = 0; i < symbols.length - 1; i++) {
    out.push({ venue, sell: symbols[i]!, buy: symbols[i + 1]! });
  }
  return out;
}
