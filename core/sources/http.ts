// Fault-tolerant HTTP helpers: return null (never throw) on timeout / !ok / network error,
// so an unavailable source never blocks ranking.
import { diag } from './diag.js';

const DEFAULT_TIMEOUT = 8000;
// Some endpoints (xBull) block the default Node UA: we present as a browser client.
const UA = 'Mozilla/5.0 (compatible; DecantFi/0.1; +read-only-quote)';

export async function getJson(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT,
  headers: Record<string, string> = {},
): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
    });
    if (!res.ok) {
      const st = diag.getStore(); if (st) st.reason = 'http';
      return null;
    }
    return await res.json();
  } catch (e) {
    const st = diag.getStore();
    if (st) st.reason = (e as Error)?.name === 'TimeoutError' ? 'timeout' : 'indisponible';
    return null;
  }
}

export async function postJson(
  url: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT,
  headers: Record<string, string> = {},
): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const st = diag.getStore(); if (st) st.reason = 'http';
      return null;
    }
    return await res.json();
  } catch (e) {
    const st = diag.getStore();
    if (st) st.reason = (e as Error)?.name === 'TimeoutError' ? 'timeout' : 'indisponible';
    return null;
  }
}

/** Safe access by dotted path ("a.b.0.c") into an unknown object. */
export function pick(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
