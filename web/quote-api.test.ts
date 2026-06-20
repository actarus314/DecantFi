// Tests de web/quote-api.ts — propriétés click-to-select des lignes d'échelle.
// Mock de l'engine pour éviter tout réseau et toute DB.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BLND, USDC } from '../core/assets.js';

// ─── Mock engine ─────────────────────────────────────────────────────────────
// vi.mock doit être en haut du fichier (hoisted par vitest).
vi.mock('../core/engine.js', () => ({
  quote: vi.fn(),
}));
// Mock balance.js (importé par quote-api via walletBalance, pas utilisé ici)
vi.mock('../core/balance.js', () => ({
  readBlndBalance: vi.fn(async () => 0n),
}));
// Mock prices.js (fonctions utilisées pour la ligne via-usdc EURC, pas nécessaires ici)
vi.mock('../core/prices.js', () => ({
  priceImpactPct: vi.fn(() => null),
  targetEvmPerUnit: vi.fn(() => null),
  targetLocalPerUnit: vi.fn(() => null),
  fetchPrices: vi.fn(async () => ({ blndUsd: null, eurcUsd: null, eurcStellarMid: null, xlmUsd: null })),
}));

import { quote as engineQuote } from '../core/engine.js';
import { liveQuote, makeReSimLeg } from './quote-api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construit un NormalizedQuote minimal compatible avec le ranking de l'engine. */
function makeQuote(source: string, netOut: bigint) {
  return {
    source,
    sellAsset: BLND,
    buyAsset: USDC,
    grossOut: netOut,
    gasInTarget: 0n,
    netOut,
    netConfidence: 'exact' as const,
    netRange: undefined,
    route: [],
    priceImpactPct: undefined,
    raw: {},
  };
}

const FAKE_CFG = {
  rpcUrl: 'https://rpc.test',
  horizonUrl: 'https://horizon.test',
  soroswapApiKey: undefined,
  walletAddress: undefined,
  dbPath: ':memory:',
  port: 0,
  timeoutMs: 5000,
};

const AMT = 100_0000000n; // 100 BLND en stroops

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('liveQuote — sourceId / deepLink / executable', () => {
  beforeEach(() => {
    vi.mocked(engineQuote).mockReset();
  });

  it('expose sourceId, deepLink et executable sur chaque ligne', async () => {
    const xbullQ = makeQuote('xbull', 5_2000000n);
    const aquaQ = makeQuote('aquarius', 5_0000000n);

    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: {
        ranked: [xbullQ, aquaQ],
        best: xbullQ,
      },
      errors: [],
    } as any);

    const result = await liveQuote('USDC', AMT, FAKE_CFG as any);

    expect(result.ladder).toHaveLength(2);

    const xbullRow = result.ladder.find((r) => r.sourceId === 'xbull');
    const aquaRow = result.ladder.find((r) => r.sourceId === 'aquarius');

    // sourceId présent et correct
    expect(xbullRow).toBeDefined();
    expect(aquaRow).toBeDefined();

    // executable : xbull = true, aquarius = true (venue d'exécution branchée)
    expect(xbullRow!.executable).toBe(true);
    expect(aquaRow!.executable).toBe(true);

    // deepLink : xbull et aquarius ont des liens connus
    expect(xbullRow!.deepLink).toBe('https://swap.xbull.io/');
    expect(aquaRow!.deepLink).toBe('https://aqua.network/');
  });

  it('soroswap et horizon sont exécutables (horizon sans deep-link)', async () => {
    const soroQ = makeQuote('soroswap', 5_1000000n);
    const horizonQ = makeQuote('horizon', 4_9000000n);

    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: {
        ranked: [soroQ, horizonQ],
        best: soroQ,
      },
      errors: [],
    } as any);

    const result = await liveQuote('USDC', AMT, FAKE_CFG as any);

    const soroRow = result.ladder.find((r) => r.sourceId === 'soroswap');
    const horizonRow = result.ladder.find((r) => r.sourceId === 'horizon');

    expect(soroRow!.executable).toBe(true);
    expect(horizonRow!.executable).toBe(true); // op native PathPaymentStrictSend branchée
    expect(horizonRow!.deepLink).toBeNull(); // exécution intégrée → pas de page de swap dédiée
  });

  it('re-classe Aquarius sur le net simulé (plus bas que find-path) → Aquarius perd contre xBull', async () => {
    // find-path Aquarius sur-cote (4.02 > 4.00 xBull) → doit gagner SANS la sim
    // avec la sim (retourne 3.90 < 4.00), xBull doit être le winner
    const xbullQ = { ...makeQuote('xbull', 4_0000000n) };
    const aquaQ = { ...makeQuote('aquarius', 4_0200000n), raw: { swap_chain_xdr: 'AAAA' } };
    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [aquaQ, xbullQ], best: aquaQ },
      errors: [],
    } as any);

    const fakeSim = vi.fn(async () => 3_9000000n); // net simulé < xBull
    const result = await liveQuote('USDC', AMT, FAKE_CFG as any, { simulateAquariusNet: fakeSim });

    expect(fakeSim).toHaveBeenCalledOnce();
    // xBull doit être winner (index 0), aquarius doit être non-winner
    expect(result.best.display).not.toContain('Aquarius');
    const aquaRow = result.ladder.find((r) => r.sourceId === 'aquarius');
    expect(aquaRow?.winner).toBe(false);
    expect(result.ladder[0]?.sourceId).toBe('xbull');
  });

  it('re-classe xBull sur le net simulé (skim 0.1%) → xBull perd contre Aquarius', async () => {
    // xBull sur-cote (4.02) → gagne SANS la sim ; avec la sim (3.90 < 4.00 Aquarius) → Aquarius winner
    const xbullQ = { ...makeQuote('xbull', 4_0200000n), raw: { route: 'fake-route' } };
    const aquaQ = { ...makeQuote('aquarius', 4_0000000n) };
    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [xbullQ, aquaQ], best: xbullQ },
      errors: [],
    } as any);

    const fakeSimXb = vi.fn(async () => ({ net: 3_9000000n, route: [], transfers: [] })); // net simulé xBull < Aquarius
    const result = await liveQuote('USDC', AMT, FAKE_CFG as any, { simulateXbullNet: fakeSimXb });

    expect(fakeSimXb).toHaveBeenCalledOnce();
    // Aquarius doit être winner (index 0), xBull doit être non-winner
    expect(result.best.display).not.toContain('xBull');
    const xbullRow = result.ladder.find((r) => r.sourceId === 'xbull');
    expect(xbullRow?.winner).toBe(false);
    expect(result.ladder[0]?.sourceId).toBe('aquarius');
  });

  it('id composite (leg1+leg2) → NON exécutable (2 tx non atomiques), deepLink = base', async () => {
    const compositeQ = makeQuote('xbull+ultrastellar', 5_3000000n);

    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: {
        ranked: [compositeQ],
        best: compositeQ,
      },
      errors: [],
    } as any);

    const result = await liveQuote('USDC', AMT, FAKE_CFG as any);
    const row = result.ladder[0];

    expect(row).toBeDefined();
    expect(row!.sourceId).toBe('xbull+ultrastellar');
    expect(row!.executable).toBe(false); // composite = 2 tx → jamais 1-clic (sinon on exécuterait un swap direct ≠ revue)
    expect(row!.deepLink).toBe('https://swap.xbull.io/'); // lien manuel sur la venue de base reste utile
  });
});

describe('makeReSimLeg — Aquarius structural failure exclusion', () => {
  /** Builds a minimal NormalizedQuote compatible with makeReSimLeg (no engine mock needed). */
  function makeAqQuote(overrides: Record<string, unknown> = {}) {
    return {
      source: 'aquarius' as const,
      sellAsset: { ...BLND },
      buyAsset: USDC,
      amountIn: AMT,
      grossOut: 5_0000000n,
      feeBreakdown: [],
      gasXlm: 0n,
      gasInTarget: 0n,
      netOut: 5_0000000n,
      netConfidence: 'exact' as const,
      netRange: undefined,
      route: [],
      priceImpactPct: undefined,
      raw: { swap_chain_xdr: 'FAKE_XDR' },
      ...overrides,
    };
  }

  it('excludes an Aquarius quote when simulateAquariusNet returns null (structural failure)', async () => {
    const aqQ = makeAqQuote();
    const soroQ = makeQuote('soroswap', 4_9000000n);

    const simFn = vi.fn(async () => null); // structural failure
    const reSimLeg = makeReSimLeg({ rpcUrl: 'https://rpc.test' }, { simulateAquariusNet: simFn as any });

    const result = await reSimLeg([aqQ as any, soroQ as any], AMT);
    // Aquarius excluded, soroswap kept
    expect(result.find(q => q.source === 'aquarius')).toBeUndefined();
    expect(result.find(q => q.source === 'soroswap')).toBeDefined();
  });

  it('keeps raw Aquarius quote but downgrades to estimate when simulateAquariusNet throws (transient RPC error)', async () => {
    const aqQ = makeAqQuote();

    const simFn = vi.fn(async () => { throw new Error('RPC timeout'); });
    const reSimLeg = makeReSimLeg({ rpcUrl: 'https://rpc.test' }, { simulateAquariusNet: simFn as any });

    const result = await reSimLeg([aqQ as any], AMT);
    // Kept with raw net value but netConfidence downgraded to 'estimate'
    const kept = result.find(q => q.source === 'aquarius');
    expect(kept).toBeDefined();
    expect(kept!.netOut).toBe(5_0000000n); // raw net, unchanged
    expect(kept!.netConfidence).toBe('estimate'); // downgraded: sim failed
  });
});
