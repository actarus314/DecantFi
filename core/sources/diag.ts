// Per-source diagnostic context (AsyncLocalStorage): http.ts writes the failure cause here
// without changing the adapters' signature. ponytail: ALS is the idiomatic Node way.
import { AsyncLocalStorage } from 'node:async_hooks';
export interface Diag { reason?: string; }
export const diag = new AsyncLocalStorage<Diag>();

/** Classifies a network/RPC error into a short cause for the UI: rate-limit (429) / timeout / rpc. */
export function rpcReason(e: unknown): string {
  const msg = String((e as Error)?.message ?? e ?? '');
  if (/\b429\b|too many requests|rate.?limit/i.test(msg)) return 'rate-limit';
  const name = (e as { name?: string })?.name;
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|timed out|etimedout/i.test(msg)) return 'timeout';
  return 'rpc';
}

/** Sets the cause in the current ALS context if not already set (first failure wins). No-op outside a run. */
export function setReason(reason: string): void {
  const st = diag.getStore();
  if (st) st.reason ??= reason;
}
