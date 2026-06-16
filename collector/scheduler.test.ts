import { describe, it, expect } from 'vitest';
import { jitteredDelayMs, runLoop, interruptibleSleep } from './scheduler.js';

describe('jitteredDelayMs', () => {
  it('reste dans [cadence-jitter, cadence+jitter]', () => {
    for (const r of [0, 0.5, 0.999]) {
      const ms = jitteredDelayMs(900, 60, () => r);
      expect(ms).toBeGreaterThanOrEqual((900 - 60) * 1000);
      expect(ms).toBeLessThanOrEqual((900 + 60) * 1000);
    }
  });
  it('jitter 0 → cadence exacte', () => {
    expect(jitteredDelayMs(900, 0, () => 0.7)).toBe(900_000);
  });
});

describe('runLoop (anti-recouvrement + arrêt)', () => {
  it('exécute N itérations puis s arrête, sans recouvrement', async () => {
    let running = 0; let maxConcurrent = 0; let runs = 0;
    await runLoop({
      iterations: 3,
      delayMs: () => 0,
      sleep: async () => {},
      onTick: async () => {
        running++; maxConcurrent = Math.max(maxConcurrent, running);
        await Promise.resolve(); running--; runs++;
      },
    });
    expect(runs).toBe(3);
    expect(maxConcurrent).toBe(1);
  });
});

describe('interruptibleSleep (arrêt propre)', () => {
  it('résout tôt quand le signal est abort (ne bloque pas la durée)', async () => {
    const ac = new AbortController();
    const start = Date.now();
    const p = interruptibleSleep(60_000, ac.signal);
    ac.abort();
    await p;
    expect(Date.now() - start).toBeLessThan(1000);
  });
  it('signal déjà abort → résout immédiatement', async () => {
    const ac = new AbortController();
    ac.abort();
    await interruptibleSleep(60_000, ac.signal);
    expect(ac.signal.aborted).toBe(true);
  });
});
