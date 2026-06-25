import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// choose-exec.js is the SAME classic script the page loads (it attaches chooseExec to
// its global). We evaluate its exact bytes in a sandbox so this test covers the real
// decision the UI runs — no DOM, no module-format coupling.
const src = readFileSync(fileURLToPath(new URL('./public/choose-exec.js', import.meta.url)), 'utf8');
const sandbox: { chooseExec?: Function } = {};
// The IIFE's root resolves to `globalThis`; bind that name to our sandbox.
new Function('globalThis', src)(sandbox);
const chooseExec = sandbox.chooseExec as (
  selectedSource: string | null,
  simResult: unknown,
) => { row: any; selRow: any; winRow: any; isComposite: boolean };

// EURC ladder shape: the composite via-USDC row is the displayed winner (best net),
// atomic venues rank below. This is the exact configuration that produced the bug
// "every selected tool opens the 2-tx popup for BLND->EURC".
const eurc = {
  ladder: [
    { sourceId: 'comet+soroswap', winner: true, executable: false, legs: [{}, {}] },
    { sourceId: 'xbull', winner: false, executable: true },
    { sourceId: 'soroswap', winner: false, executable: true },
  ],
};

describe('chooseExec — displayed target must equal executed target', () => {
  it('selecting an atomic venue executes THAT venue, never the composite (the bug)', () => {
    const r = chooseExec('soroswap', eurc);
    expect(r.isComposite).toBe(false);
    expect(r.row.sourceId).toBe('soroswap');
  });

  it('selecting another atomic venue is also single-tx', () => {
    const r = chooseExec('xbull', eurc);
    expect(r.isComposite).toBe(false);
    expect(r.row.sourceId).toBe('xbull');
  });

  it('no selection falls back to the displayed winner (composite here)', () => {
    const r = chooseExec(null, eurc);
    expect(r.isComposite).toBe(true);
    expect(r.row.sourceId).toBe('comet+soroswap');
  });

  it('explicitly selecting the composite winner stays composite', () => {
    const r = chooseExec('comet+soroswap', eurc);
    expect(r.isComposite).toBe(true);
    expect(r.row.sourceId).toBe('comet+soroswap');
  });

  it('USDC-style ladder (atomic winner, no composite) is single-tx', () => {
    const usdc = {
      ladder: [
        { sourceId: 'comet', winner: true, executable: true },
        { sourceId: 'xbull', winner: false, executable: true },
      ],
    };
    expect(chooseExec(null, usdc).isComposite).toBe(false);
    expect(chooseExec('xbull', usdc).row.sourceId).toBe('xbull');
  });

  it('empty / loading simResult does not throw', () => {
    expect(chooseExec(null, null).row).toBe(null);
    expect(chooseExec('x', { ladder: [] }).row).toBe(null);
  });
});
