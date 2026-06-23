// Ordonnancement : délai jitté (pur, testable) + boucle séquentielle (un tick attendu avant le suivant =
// pas de recouvrement). Le délai réel est délégué à `sleep` (injectable pour les tests).

/** Délai en ms = cadence ± jitter aléatoire. random() ∈ [0,1). Never negative (guard: min 0). */
export function jitteredDelayMs(cadenceSec: number, jitterSec: number, random: () => number = Math.random): number {
  const offset = (random() * 2 - 1) * jitterSec; // [-jitter, +jitter]
  return Math.max(0, Math.round((cadenceSec + offset) * 1000));
}

export interface LoopDeps {
  /** undefined = boucle infinie (prod) ; nombre = arrêt après N itérations (tests). */
  iterations?: number;
  delayMs: () => number;
  sleep: (ms: number) => Promise<void>;
  onTick: () => Promise<void>;
  shouldStop?: () => boolean;
}

/** Boucle : sleep(delay) → onTick (attendu) → recommence. Séquentielle = anti-recouvrement par construction. */
export async function runLoop(deps: LoopDeps): Promise<void> {
  let i = 0;
  while (deps.iterations === undefined || i < deps.iterations) {
    if (deps.shouldStop?.()) return;
    await deps.sleep(deps.delayMs());
    if (deps.shouldStop?.()) return;
    await deps.onTick();
    i++;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sleep interruptible : résout après `ms`, OU immédiatement dès que `signal` est abort (arrêt propre). */
export function interruptibleSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
