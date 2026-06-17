// Contexte de diagnostic par source (AsyncLocalStorage) : http.ts y écrit la cause d'un échec
// sans changer la signature des adaptateurs. ponytail: ALS = le moyen idiomatique Node.
import { AsyncLocalStorage } from 'node:async_hooks';
export interface Diag { reason?: string; }
export const diag = new AsyncLocalStorage<Diag>();
