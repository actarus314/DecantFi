import { describe, it, expect, beforeEach } from 'vitest';
import { bumpRpc, readRpc, resetRpc } from './rpc-meter.js';

beforeEach(() => { resetRpc(); });

describe('rpc-meter', () => {
  it('bump×3 → read=3 → reset → read=0', () => {
    bumpRpc(); bumpRpc(); bumpRpc();
    expect(readRpc()).toBe(3);
    resetRpc();
    expect(readRpc()).toBe(0);
  });
});
