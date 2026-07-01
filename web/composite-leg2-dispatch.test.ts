// Tests for web/public/composite-leg2-dispatch.js — no DOM, no module coupling.
// The same IIFE the browser runs is evaluated in a sandbox so we cover the real decision logic.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('./public/composite-leg2-dispatch.js', import.meta.url)), 'utf8');
const sandbox: { chooseLeg2Dispatch?: (comp: unknown) => string } = {};
new Function('globalThis', src)(sandbox);
const chooseLeg2Dispatch = sandbox.chooseLeg2Dispatch!;

describe('chooseLeg2Dispatch — composite leg2 execution routing (P4)', () => {
  it('returns stellarbroker when comp.leg2Source is stellarbroker', () => {
    expect(chooseLeg2Dispatch({ leg2Source: 'stellarbroker' })).toBe('stellarbroker');
  });

  it('returns server for a soroswap leg2', () => {
    expect(chooseLeg2Dispatch({ leg2Source: 'soroswap' })).toBe('server');
  });

  it('returns server for an xbull leg2', () => {
    expect(chooseLeg2Dispatch({ leg2Source: 'xbull' })).toBe('server');
  });

  it('returns server for an ultrastellar leg2', () => {
    expect(chooseLeg2Dispatch({ leg2Source: 'ultrastellar' })).toBe('server');
  });

  it('returns server when leg2Source is null (no leg2 captured)', () => {
    expect(chooseLeg2Dispatch({ leg2Source: null })).toBe('server');
  });

  it('returns server when comp is null', () => {
    expect(chooseLeg2Dispatch(null)).toBe('server');
  });

  it('returns server when comp has no leg2Source property', () => {
    expect(chooseLeg2Dispatch({ leg: 1, usdcReceived: 50 })).toBe('server');
  });

  it('reads leg2Source regardless of leg number (leg:2 shape from buildCompositeLeg2)', () => {
    expect(chooseLeg2Dispatch({ leg: 2, leg2Source: 'stellarbroker' })).toBe('stellarbroker');
    expect(chooseLeg2Dispatch({ leg: 2, leg2Source: 'ultrastellar' })).toBe('server');
  });

  it('is strict: only the exact string stellarbroker triggers the Mediator path', () => {
    expect(chooseLeg2Dispatch({ leg2Source: 'StellarBroker' })).toBe('server');
    expect(chooseLeg2Dispatch({ leg2Source: 'stellarbroker ' })).toBe('server'); // trailing space
    expect(chooseLeg2Dispatch({ leg2Source: '' })).toBe('server');
  });
});
