// Scheduling: jittered delay (pure, testable) + sequential loop (one tick awaited before the next =
// no overlap). The real delay is delegated to `sleep` (injectable for tests).

/** Delay in ms = cadence ± random jitter. random() ∈ [0,1). Never negative (guard: min 0). */
export function jitteredDelayMs(cadenceSec: number, jitterSec: number, random: () => number = Math.random): number {
  const offset = (random() * 2 - 1) * jitterSec; // [-jitter, +jitter]
  return Math.max(0, Math.round((cadenceSec + offset) * 1000));
}

export interface LoopDeps {
  /** undefined = infinite loop (prod); number = stop after N iterations (tests). */
  iterations?: number;
  delayMs: () => number;
  sleep: (ms: number) => Promise<void>;
  onTick: () => Promise<void>;
  shouldStop?: () => boolean;
}

/** Loop: sleep(delay) → onTick (awaited) → repeat. Sequential = anti-overlap by construction. */
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

/** Interruptible sleep: resolves after `ms`, OR immediately once `signal` is aborted (clean stop). */
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
