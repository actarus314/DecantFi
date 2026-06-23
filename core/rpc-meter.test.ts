import { describe, it, expect, beforeEach } from 'vitest';
import { bumpRpc, readRpc, resetRpc, rpcAls } from './rpc-meter.js';

beforeEach(() => { resetRpc(); });

describe('rpc-meter', () => {
  it('bump×3 → read=3 → reset → read=0', () => {
    bumpRpc(); bumpRpc(); bumpRpc();
    expect(readRpc()).toBe(3);
    resetRpc();
    expect(readRpc()).toBe(0);
  });

  it('ALS store is isolated from global counter', async () => {
    // Bump global once before entering ALS scope
    bumpRpc();
    expect(readRpc()).toBe(1);

    await rpcAls.run({ n: 0 }, async () => {
      // Inside ALS: counter starts at 0, independent of global
      expect(readRpc()).toBe(0);
      bumpRpc(); bumpRpc();
      expect(readRpc()).toBe(2);
    });

    // Global counter unchanged by ALS bumps
    expect(readRpc()).toBe(1);
  });

  it('two concurrent ALS scopes do not interfere', async () => {
    const storeA = { n: 0 };
    const storeB = { n: 0 };

    await Promise.all([
      rpcAls.run(storeA, async () => {
        bumpRpc(); bumpRpc(); bumpRpc();
        await new Promise(r => setTimeout(r, 0));
        expect(readRpc()).toBe(3);
      }),
      rpcAls.run(storeB, async () => {
        bumpRpc();
        await new Promise(r => setTimeout(r, 0));
        expect(readRpc()).toBe(1);
      }),
    ]);

    expect(storeA.n).toBe(3);
    expect(storeB.n).toBe(1);
  });

  it('resetRpc() inside ALS resets the store, not the global', () => {
    bumpRpc(); // global = 1
    rpcAls.run({ n: 5 }, () => {
      expect(readRpc()).toBe(5);
      resetRpc();
      expect(readRpc()).toBe(0);
    });
    // global untouched
    expect(readRpc()).toBe(1);
  });
});
