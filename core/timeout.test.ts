import { describe, it, expect } from 'vitest';
import { withTimeout } from './timeout.js';

describe('withTimeout', () => {
  it('resolves with the value when the promise settles before the timeout', async () => {
    const r = await withTimeout(Promise.resolve(42), 1000, 'fast');
    expect(r).toBe(42);
  });

  it('rejects when the promise exceeds the timeout (a hung call cannot freeze the caller)', async () => {
    const never = new Promise<number>(() => { /* never resolves */ });
    await expect(withTimeout(never, 20, 'hung')).rejects.toThrow(/timeout: hung exceeded 20ms/);
  });

  it('propagates the underlying rejection if it loses the race', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'err')).rejects.toThrow('boom');
  });
});
