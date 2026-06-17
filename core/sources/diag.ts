// Contexte de diagnostic par source (AsyncLocalStorage) : http.ts y écrit la cause d'un échec
// sans changer la signature des adaptateurs. ponytail: ALS = le moyen idiomatique Node.
import { AsyncLocalStorage } from 'node:async_hooks';
export interface Diag { reason?: string; }
export const diag = new AsyncLocalStorage<Diag>();

/** Classe une erreur réseau/RPC en cause courte pour l'UI : rate-limit (429) / timeout / rpc. */
export function rpcReason(e: unknown): string {
  const msg = String((e as Error)?.message ?? e ?? '');
  if (/\b429\b|too many requests|rate.?limit/i.test(msg)) return 'rate-limit';
  const name = (e as { name?: string })?.name;
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|timed out|etimedout/i.test(msg)) return 'timeout';
  return 'rpc';
}

/** Pose la cause dans le contexte ALS courant si pas déjà posée (premier échec gagne). No-op hors run. */
export function setReason(reason: string): void {
  const st = diag.getStore();
  if (st) st.reason ??= reason;
}
