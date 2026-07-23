import { describe, it, expect } from 'vitest';
import { jitteredDelayMs, runLoop, interruptibleSleep } from './scheduler.js';

describe('jitteredDelayMs', () => {
  it('stays within [cadence-jitter, cadence+jitter]', () => {
    for (const r of [0, 0.5, 0.999]) {
      const ms = jitteredDelayMs(900, 60, () => r);
      expect(ms).toBeGreaterThanOrEqual((900 - 60) * 1000);
      expect(ms).toBeLessThanOrEqual((900 + 60) * 1000);
    }
  });
  it('jitter 0 → exact cadence', () => {
    expect(jitteredDelayMs(900, 0, () => 0.7)).toBe(900_000);
  });
  it('never negative even if jitter > cadence (Math.max guard)', () => {
    // random()=0 → offset=-jitter → cadence+offset could be negative without the guard
    expect(jitteredDelayMs(10, 100, () => 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('runLoop (anti-overlap + stop)', () => {
  it('runs N iterations then stops, without overlap', async () => {
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

describe('interruptibleSleep (clean stop)', () => {
  it('resolves early when the signal is aborted (does not block for the full duration)', async () => {
    const ac = new AbortController();
    const start = Date.now();
    const p = interruptibleSleep(60_000, ac.signal);
    ac.abort();
    await p;
    expect(Date.now() - start).toBeLessThan(1000);
  });
  it('signal already aborted → resolves immediately', async () => {
    const ac = new AbortController();
    ac.abort();
    await interruptibleSleep(60_000, ac.signal);
    expect(ac.signal.aborted).toBe(true);
  });
});
