// RPC call counter — global for CLI/collector (sequential by design), per-request via ALS in the
// web server (two concurrent /api/quote calls would otherwise pollute each other's logged count).
import { AsyncLocalStorage } from 'node:async_hooks';

// Per-request store: { n: number } when inside a als.run() scope.
export const rpcAls = new AsyncLocalStorage<{ n: number }>();

// Global counter (fallback for CLI / collector — sequential, safe without ALS).
let n = 0;

export function bumpRpc(): void {
  const store = rpcAls.getStore();
  if (store) { store.n++; } else { n++; }
}

export function readRpc(): number {
  const store = rpcAls.getStore();
  return store ? store.n : n;
}

export function resetRpc(): void {
  const store = rpcAls.getStore();
  if (store) { store.n = 0; } else { n = 0; }
}
