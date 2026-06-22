// Helpers HTTP tolerants aux pannes : rendent null (jamais d'exception) sur timeout / !ok / erreur reseau,
// pour qu'une source indisponible ne bloque jamais le classement.
import { diag } from './diag.js';

const DEFAULT_TIMEOUT = 8000;
// Certains endpoints (xBull) bloquent l'UA Node par defaut : on se presente comme un client navigateur.
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

/** Acces sur par chemin pointe ("a.b.0.c") dans un objet inconnu. */
export function pick(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
