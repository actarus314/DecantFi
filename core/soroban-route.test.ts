import { describe, it, expect } from 'vitest';
import { routeFromTransfers, verifyChain, type Transfer } from './soroban-route.js';

// Comptes fictifs calqués sur les captures réelles.
const G_SENDER = 'G_SENDER';
const C_HUB = 'C_HUB';
const C_A = 'C_A';
const C_B = 'C_B';
const C_C = 'C_C';
const C_P = 'C_P';
const C_Q = 'C_Q';

// ─── Captures réelles ────────────────────────────────────────────────────────

/** xBull BLND→EURC hub-spoke avec skim (dernier transfert < avant-dernier). */
const xbullBlndEurc: Transfer[] = [
  { asset: 'BLND', from: G_SENDER, to: C_HUB, amount: 7500000000n },
  { asset: 'BLND', from: C_HUB,    to: C_A,   amount: 7500000000n },
  { asset: 'USDC', from: C_A,      to: C_HUB, amount: 359553000n  },
  { asset: 'USDC', from: C_HUB,    to: C_B,   amount: 359553000n  },
  { asset: 'XLM',  from: C_B,      to: C_HUB, amount: 1671590000n },
  { asset: 'XLM',  from: C_HUB,    to: C_C,   amount: 1671590000n },
  { asset: 'EURC', from: C_C,      to: C_HUB, amount: 313912000n  },
  { asset: 'EURC', from: C_HUB,    to: G_SENDER, amount: 313598000n }, // skim ~0,1%
];

/** Aquarius BLND→USDC hub-spoke sans skim. */
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

/** Soroswap BLND→EURC linéaire (pool→pool direct). */
const soroswapBlndEurc: Transfer[] = [
  { asset: 'BLND', from: G_SENDER, to: C_P,      amount: 7500000000n },
  { asset: 'USDC', from: C_P,      to: C_Q,      amount: 358131000n  },
  { asset: 'EURC', from: C_Q,      to: G_SENDER, amount: 311025000n  },
];

/** Aquarius + reward AQUA renvoyé au signataire (route parasite). */
const aquariusWithReward: Transfer[] = [
  ...aquariusBlndUsdc,
  { asset: 'AQUA', from: C_HUB, to: G_SENDER, amount: 50000000n }, // reward inatendu
];

// ─── routeFromTransfers ──────────────────────────────────────────────────────

describe('routeFromTransfers', () => {
  it('hub-spoke xBull → déduplique les paires', () => {
    expect(routeFromTransfers(xbullBlndEurc)).toEqual(['BLND', 'USDC', 'XLM', 'EURC']);
  });

  it('hub-spoke Aquarius → déduplique les paires', () => {
    expect(routeFromTransfers(aquariusBlndUsdc)).toEqual(['BLND', 'AQUA', 'XLM', 'USDC']);
  });

  it('linéaire Soroswap → passe tel quel', () => {
    expect(routeFromTransfers(soroswapBlndEurc)).toEqual(['BLND', 'USDC', 'EURC']);
  });

  it('vide → []', () => {
    expect(routeFromTransfers([])).toEqual([]);
  });
});

// ─── verifyChain ─────────────────────────────────────────────────────────────

describe('verifyChain', () => {
  it('xBull BLND→EURC avec skim → chained', () => {
    const r = verifyChain(xbullBlndEurc, 'BLND', 'EURC');
    expect(r.chained).toBe(true);
  });

  it('Aquarius BLND→USDC → chained', () => {
    const r = verifyChain(aquariusBlndUsdc, 'BLND', 'USDC');
    expect(r.chained).toBe(true);
  });

  it('Soroswap BLND→EURC linéaire → chained', () => {
    const r = verifyChain(soroswapBlndEurc, 'BLND', 'EURC');
    expect(r.chained).toBe(true);
  });

  it('Aquarius + reward AQUA → pas chained, reason contient AQUA', () => {
    const r = verifyChain(aquariusWithReward, 'BLND', 'USDC');
    expect(r.chained).toBe(false);
    expect(r.reason).toMatch(/AQUA/);
  });

  it('liste vide → pas chained', () => {
    const r = verifyChain([], 'BLND', 'USDC');
    expect(r.chained).toBe(false);
  });
});
