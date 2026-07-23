import { describe, it, expect } from 'vitest';
import { routeFromTransfers, verifyChain, type Transfer } from './soroban-route.js';

// Fictitious accounts modeled on real captures.
const G_SENDER = 'G_SENDER';
const C_HUB = 'C_HUB';
const C_A = 'C_A';
const C_B = 'C_B';
const C_C = 'C_C';
const C_P = 'C_P';
const C_Q = 'C_Q';

// ─── Real captures ────────────────────────────────────────────────────────

/** xBull BLND->EURC hub-spoke with skim (last transfer < second-to-last). */
const xbullBlndEurc: Transfer[] = [
  { asset: 'BLND', from: G_SENDER, to: C_HUB, amount: 7500000000n },
  { asset: 'BLND', from: C_HUB,    to: C_A,   amount: 7500000000n },
  { asset: 'USDC', from: C_A,      to: C_HUB, amount: 359553000n  },
  { asset: 'USDC', from: C_HUB,    to: C_B,   amount: 359553000n  },
  { asset: 'XLM',  from: C_B,      to: C_HUB, amount: 1671590000n },
  { asset: 'XLM',  from: C_HUB,    to: C_C,   amount: 1671590000n },
  { asset: 'EURC', from: C_C,      to: C_HUB, amount: 313912000n  },
  { asset: 'EURC', from: C_HUB,    to: G_SENDER, amount: 313598000n }, // skim ~0.1%
];

/** Aquarius BLND->USDC hub-spoke without skim. */
const aquariusBlndUsdc: Transfer[] = [
  { asset: 'BLND', from: G_SENDER, to: C_HUB, amount: 7500000000n    },
  { asset: 'BLND', from: C_HUB,    to: C_A,   amount: 7500000000n    },
  { asset: 'AQUA', from: C_A,      to: C_HUB, amount: 880387775000n  },
  { asset: 'AQUA', from: C_HUB,    to: C_B,   amount: 880387775000n  },
  { asset: 'XLM',  from: C_B,      to: C_HUB, amount: 1647297000n    },
  { asset: 'XLM',  from: C_HUB,    to: C_C,   amount: 1647297000n    },
  { asset: 'USDC', from: C_C,      to: C_HUB, amount: 359697000n     },
  { asset: 'USDC', from: C_HUB,    to: G_SENDER, amount: 359697000n  },
];

/** Soroswap BLND->EURC linear (direct pool-to-pool). */
const soroswapBlndEurc: Transfer[] = [
  { asset: 'BLND', from: G_SENDER, to: C_P,      amount: 7500000000n },
  { asset: 'USDC', from: C_P,      to: C_Q,      amount: 358131000n  },
  { asset: 'EURC', from: C_Q,      to: G_SENDER, amount: 311025000n  },
];

/** Aquarius + AQUA reward sent back to the signer (parasitic route). */
const aquariusWithReward: Transfer[] = [
  ...aquariusBlndUsdc,
  { asset: 'AQUA', from: C_HUB, to: G_SENDER, amount: 50000000n }, // unexpected reward
];

// ─── routeFromTransfers ──────────────────────────────────────────────────────

describe('routeFromTransfers', () => {
  it('hub-spoke xBull -> deduplicates pairs', () => {
    expect(routeFromTransfers(xbullBlndEurc)).toEqual(['BLND', 'USDC', 'XLM', 'EURC']);
  });

  it('hub-spoke Aquarius -> deduplicates pairs', () => {
    expect(routeFromTransfers(aquariusBlndUsdc)).toEqual(['BLND', 'AQUA', 'XLM', 'USDC']);
  });

  it('linear Soroswap -> passes through unchanged', () => {
    expect(routeFromTransfers(soroswapBlndEurc)).toEqual(['BLND', 'USDC', 'EURC']);
  });

  it('empty -> []', () => {
    expect(routeFromTransfers([])).toEqual([]);
  });
});

// ─── verifyChain ─────────────────────────────────────────────────────────────

describe('verifyChain', () => {
  it('xBull BLND->EURC with skim -> chained', () => {
    const r = verifyChain(xbullBlndEurc, 'BLND', 'EURC');
    expect(r.chained).toBe(true);
  });

  it('Aquarius BLND->USDC -> chained', () => {
    const r = verifyChain(aquariusBlndUsdc, 'BLND', 'USDC');
    expect(r.chained).toBe(true);
  });

  it('Soroswap BLND->EURC linear -> chained', () => {
    const r = verifyChain(soroswapBlndEurc, 'BLND', 'EURC');
    expect(r.chained).toBe(true);
  });

  it('Aquarius + AQUA reward -> not chained, reason contains AQUA', () => {
    const r = verifyChain(aquariusWithReward, 'BLND', 'USDC');
    expect(r.chained).toBe(false);
    expect(r.reason).toMatch(/AQUA/);
  });

  it('empty list -> not chained', () => {
    const r = verifyChain([], 'BLND', 'USDC');
    expect(r.chained).toBe(false);
  });
});
