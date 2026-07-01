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
import { priceImpactPct } from '../core/prices.js';
import { liveQuote, makeReSimLeg, resimAquariusXbull } from './quote-api.js';

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

describe('liveQuote — sourceId / executable', () => {
  beforeEach(() => {
    vi.mocked(engineQuote).mockReset();
  });

  it('expose sourceId et executable sur chaque ligne', async () => {
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
  });

  it('soroswap et horizon sont exécutables', async () => {
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

  it('id composite (leg1+leg2) → NON exécutable (2 tx non atomiques)', async () => {
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
  });
});

describe('resimAquariusXbull — netConfidence promotion', () => {
  it('promotes Aquarius netConfidence to exact after successful re-sim', async () => {
    // Start with 'estimate' (the new default from parseAquarius)
    const aquaQ = {
      ...makeQuote('aquarius', 4_0200000n),
      netConfidence: 'estimate' as const,
      raw: { swap_chain_xdr: 'FAKE_XDR' },
    };
    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [aquaQ], best: aquaQ },
      errors: [],
    } as any);

    // Sim returns a different (lower) net → triggers update including netConfidence promotion
    const fakeSim = vi.fn(async () => 3_9000000n);
    const result = await liveQuote('USDC', AMT, FAKE_CFG as any, { simulateAquariusNet: fakeSim });

    const aquaRow = result.ladder.find((r) => r.sourceId === 'aquarius');
    expect(aquaRow).toBeDefined();
    // After successful re-sim, chip should reflect 'exact' confidence (chipFor('exact') = 'obs')
    expect(aquaRow!.chip).toBe('obs');
  });

  it('a hung Aquarius re-sim does not block the quote — Aquarius degrades to estimate, others unaffected', async () => {
    const aquaQ = {
      ...makeQuote('aquarius', 4_0200000n),
      netConfidence: 'estimate' as const,
      raw: { swap_chain_xdr: 'FAKE_XDR' },
    };
    const soroQ = makeQuote('soroswap', 4_0000000n);

    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [aquaQ, soroQ], best: aquaQ },
      errors: [],
    } as any);

    // Never resolves — simulates a hung RPC call
    const hung = () => new Promise<never>(() => {});

    const result = await liveQuote('USDC', AMT, FAKE_CFG as any, {
      simulateAquariusNet: hung as any,
      simTimeoutMs: 30,
    });

    // Aquarius must be degraded to 'est' (timeout → null → aquariusSimFailed → 'estimate')
    const aquaRow = result.ladder.find((r) => r.sourceId === 'aquarius');
    expect(aquaRow).toBeDefined();
    expect(aquaRow!.chip).toBe('est');

    // Soroswap must still be present and unaffected ('obs' = chipFor('exact'))
    const soroRow = result.ladder.find((r) => r.sourceId === 'soroswap');
    expect(soroRow).toBeDefined();
    expect(soroRow!.chip).toBe('obs');
  });
});

describe('resimAquariusXbull — priceImpact recalculation on corrected net', () => {
  beforeEach(() => {
    vi.mocked(engineQuote).mockReset();
    vi.mocked(priceImpactPct).mockReset();
  });

  it('recalculates priceImpactPct for xBull when re-sim corrects the net', async () => {
    // xBull over-quotes 4.10 → real fill is 4.00 → impact must be recalculated on 4.00, not 4.10
    const xbullQ = {
      ...makeQuote('xbull', 4_1000000n),
      amountIn: AMT,
      priceImpactPct: -5,    // stale value computed on the over-quoted 4.10
      priceImpactLocalPct: -5,
      raw: { route: 'fake-route' },
    };

    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [xbullQ], best: xbullQ },
      errors: [],
    } as any);

    // Make priceImpactPct return a fresh value (simulating a lower impact on the real net)
    vi.mocked(priceImpactPct).mockReturnValue(2.5);

    const fakeSimXb = vi.fn(async () => ({ net: 4_0000000n, route: [], transfers: [] }));
    const result = await liveQuote('USDC', AMT, FAKE_CFG as any, { simulateXbullNet: fakeSimXb });

    const xbullRow = result.ladder.find((r) => r.sourceId === 'xbull');
    expect(xbullRow).toBeDefined();
    // net must be the corrected value
    expect(xbullRow!.net).toBeCloseTo(4.0, 5);
    // impact must be the recalculated value (2.5), not the stale -5
    expect(xbullRow!.impactPct).toBe(2.5);
  });

  it('recalculates priceImpactPct for Aquarius when re-sim corrects the net', async () => {
    // Aquarius over-quotes 4.10 → real fill is 3.90 → impact must be recalculated on 3.90
    const aquaQ = {
      ...makeQuote('aquarius', 4_1000000n),
      amountIn: AMT,
      priceImpactPct: -5,    // stale value computed on the over-quoted 4.10
      priceImpactLocalPct: -5,
      netConfidence: 'estimate' as const,
      raw: { swap_chain_xdr: 'FAKE_XDR' },
    };

    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [aquaQ], best: aquaQ },
      errors: [],
    } as any);

    // Make priceImpactPct return a fresh value (higher impact = more slippage on the lower real net)
    vi.mocked(priceImpactPct).mockReturnValue(4.88);

    const fakeSim = vi.fn(async () => 3_9000000n); // corrected net < over-quoted
    const result = await liveQuote('USDC', AMT, FAKE_CFG as any, { simulateAquariusNet: fakeSim });

    const aquaRow = result.ladder.find((r) => r.sourceId === 'aquarius');
    expect(aquaRow).toBeDefined();
    // net must be the corrected value
    expect(aquaRow!.net).toBeCloseTo(3.9, 5);
    // impact must be the recalculated value (4.88), not the stale -5
    expect(aquaRow!.impactPct).toBe(4.88);
  });

  it('keeps original priceImpactPct for xBull when only route (hops) changes, not the net', async () => {
    // Re-sim decodes route but net is unchanged → impact must NOT be recalculated
    const xbullQ = {
      ...makeQuote('xbull', 4_0000000n),
      amountIn: AMT,
      priceImpactPct: 3.0,    // original impact (on the correct net — no over-quote here)
      priceImpactLocalPct: 3.0,
      raw: { route: 'fake-route' },
    };

    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [xbullQ], best: xbullQ },
      errors: [],
    } as any);

    // Re-sim returns same net but decoded route
    const fakeSimXb = vi.fn(async () => ({
      net: 4_0000000n, // same net → xbullSimNet stays undefined (line: net !== q.netOut)
      route: ['BLND', 'USDC'],
      transfers: [],
    }));
    const result = await liveQuote('USDC', AMT, FAKE_CFG as any, { simulateXbullNet: fakeSimXb });

    // priceImpactPct should NOT have been called (net unchanged → no impact recalc)
    expect(vi.mocked(priceImpactPct)).not.toHaveBeenCalled();

    const xbullRow = result.ladder.find((r) => r.sourceId === 'xbull');
    expect(xbullRow).toBeDefined();
    // impact unchanged
    expect(xbullRow!.impactPct).toBe(3.0);
  });
});

describe('makeReSimLeg — StellarBroker re-sim', () => {
  function makeSbQuote(overrides: Record<string, unknown> = {}) {
    return {
      source: 'stellarbroker' as const,
      sellAsset: BLND,
      buyAsset: USDC,
      amountIn: AMT,
      grossOut: 5_0000000n,
      feeBreakdown: [{ kind: 'aggregator' as const, note: 'opaque' }],
      gasXlm: 0n,
      gasInTarget: 0n,
      netOut: 5_0000000n,
      netConfidence: 'estimate' as const,
      netRange: { low: 4_8000000n, high: 5_0000000n },
      route: [],
      priceImpactPct: undefined,
      raw: {},
      ...overrides,
    };
  }

  it('promotes StellarBroker quote to exact with collapsed netRange when sim succeeds (all-Soroban, exact)', async () => {
    const sbQ = makeSbQuote();
    const fakeSimSb = vi.fn(async () => ({ net: 4_9500000n, route: ['BLND', 'USDC'], exact: true }));
    const reSimLeg = makeReSimLeg(
      { rpcUrl: 'https://rpc.test', stellarBrokerApiKey: 'key' },
      { simulateStellarBrokerNet: fakeSimSb as any },
    );
    const result = await reSimLeg([sbQ as any], AMT);
    expect(result).toHaveLength(1);
    const updated = result[0]!;
    expect(updated.netConfidence).toBe('exact');
    expect(updated.netOut).toBe(4_9500000n);
    expect(updated.netRange).toEqual({ low: 4_9500000n, high: 4_9500000n });
    expect((updated.feeBreakdown as Array<{ note?: string }>)[0]?.note).toMatch(/empty-auth/);
  });

  it('does NOT promote a mixed (exact=false) StellarBroker net — leaves the estimate untouched', async () => {
    const sbQ = makeSbQuote();
    // Mixed burst: net is a conservative lower bound (a classic destMin floor contributed)
    const fakeSimSb = vi.fn(async () => ({ net: 4_9500000n, route: ['BLND', 'USDC'], exact: false }));
    const reSimLeg = makeReSimLeg(
      { rpcUrl: 'https://rpc.test', stellarBrokerApiKey: 'key' },
      { simulateStellarBrokerNet: fakeSimSb as any },
    );
    const result = await reSimLeg([sbQ as any], AMT);
    expect(result).toHaveLength(1);
    const updated = result[0]!;
    expect(updated.netConfidence).toBe('estimate');             // NOT promoted
    expect(updated.netOut).toBe(5_0000000n);                    // original net, unchanged
    expect(updated.netRange).toEqual({ low: 4_8000000n, high: 5_0000000n }); // original range kept
  });

  it('keeps original StellarBroker quote (no downgrade) when sim returns null', async () => {
    const sbQ = makeSbQuote();
    const fakeSimSb = vi.fn(async () => null);
    const reSimLeg = makeReSimLeg(
      { rpcUrl: 'https://rpc.test', stellarBrokerApiKey: 'key' },
      { simulateStellarBrokerNet: fakeSimSb as any },
    );
    const result = await reSimLeg([sbQ as any], AMT);
    expect(result).toHaveLength(1);
    expect(result[0]!.netConfidence).toBe('estimate'); // original, not downgraded
    expect(result[0]!.netOut).toBe(5_0000000n);        // original net
  });

  it('skips StellarBroker re-sim when no stellarBrokerApiKey', async () => {
    const sbQ = makeSbQuote();
    const fakeSimSb = vi.fn(async () => ({ net: 4_9000000n, route: [] }));
    const reSimLeg = makeReSimLeg(
      { rpcUrl: 'https://rpc.test' }, // no key
      { simulateStellarBrokerNet: fakeSimSb as any },
    );
    await reSimLeg([sbQ as any], AMT);
    expect(fakeSimSb).not.toHaveBeenCalled();
  });

  // ─── P2: route threading + priceImpact neutralization ────────────────────────

  it('P2: threads decoded multi-hop route into StellarBroker composite leg promotion', async () => {
    const sbQ = makeSbQuote();
    // Decoded route with an intermediate hop: BLND → XLM → USDC
    const fakeSimSb = vi.fn(async () => ({ net: 4_9500000n, route: ['BLND', 'XLM', 'USDC'], exact: true }));
    const reSimLeg = makeReSimLeg(
      { rpcUrl: 'https://rpc.test', stellarBrokerApiKey: 'key' },
      { simulateStellarBrokerNet: fakeSimSb as any },
    );
    const result = await reSimLeg([sbQ as any], AMT);
    expect(result).toHaveLength(1);
    const updated = result[0]!;
    expect(updated.route).toEqual([
      { venue: 'stellarbroker', sell: 'BLND', buy: 'XLM' },
      { venue: 'stellarbroker', sell: 'XLM', buy: 'USDC' },
    ]);
  });

  it('P2: neutralizes stale priceImpact on StellarBroker composite leg promotion (no price context in makeReSimLeg)', async () => {
    // makeReSimLeg has no access to result.prices → cannot recalculate priceImpact on the new net.
    // Honesty: drop the stale value rather than leaving an impact computed on the old (overquoted) net.
    const sbQ = makeSbQuote({ priceImpactPct: -5, priceImpactLocalPct: -5 } as any);
    const fakeSimSb = vi.fn(async () => ({ net: 4_9500000n, route: ['BLND', 'USDC'], exact: true }));
    const reSimLeg = makeReSimLeg(
      { rpcUrl: 'https://rpc.test', stellarBrokerApiKey: 'key' },
      { simulateStellarBrokerNet: fakeSimSb as any },
    );
    const result = await reSimLeg([sbQ as any], AMT);
    expect(result).toHaveLength(1);
    const updated = result[0]!;
    expect(updated.priceImpactPct).toBeUndefined();      // neutralized, not stale
    expect((updated as any).priceImpactLocalPct).toBeUndefined(); // neutralized
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

describe('resimAquariusXbull — StellarBroker branch', () => {
  beforeEach(() => {
    vi.mocked(engineQuote).mockReset();
    vi.mocked(priceImpactPct).mockReset();
  });

  it('promotes StellarBroker to exact, collapses netRange, recalculates priceImpact', async () => {
    vi.mocked(priceImpactPct).mockReturnValue(1.5);

    const sbQ = {
      source: 'stellarbroker' as const,
      sellAsset: BLND,
      buyAsset: USDC,
      amountIn: AMT,
      grossOut: 5_0000000n,
      feeBreakdown: [{ kind: 'aggregator' as const, note: 'opaque' }],
      gasXlm: 0n,
      gasInTarget: 0n,
      netOut: 5_0000000n,
      netConfidence: 'estimate' as const,
      netRange: { low: 4_8000000n, high: 5_0000000n },
      route: [],
      priceImpactPct: -1,
      priceImpactLocalPct: -1,
      raw: {},
    };

    const fakeResult = {
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [sbQ as any], best: sbQ as any },
      errors: [],
    } as any;

    const fakeSimSb = vi.fn(async () => ({ net: 4_9200000n, route: ['BLND', 'USDC'], exact: true }));
    await resimAquariusXbull(
      fakeResult, 'USDC', AMT,
      { rpcUrl: 'https://rpc.test', stellarBrokerApiKey: 'key' },
      { simulateStellarBrokerNet: fakeSimSb as any },
    );

    const sbRow = fakeResult.ranking.ranked.find((q: any) => q.source === 'stellarbroker');
    expect(sbRow).toBeDefined();
    expect(sbRow!.netConfidence).toBe('exact');
    expect(sbRow!.netOut).toBe(4_9200000n);
    expect(sbRow!.netRange).toEqual({ low: 4_9200000n, high: 4_9200000n });
    expect(vi.mocked(priceImpactPct)).toHaveBeenCalled();
    expect(sbRow!.priceImpactPct).toBe(1.5);
    expect((sbRow!.feeBreakdown as Array<{ note?: string }>)[0]?.note).toMatch(/empty-auth/);
  });

  it('does NOT promote a mixed (exact=false) StellarBroker net — leaves the estimate untouched', async () => {
    const sbQ = {
      source: 'stellarbroker' as const,
      sellAsset: BLND, buyAsset: USDC, amountIn: AMT,
      grossOut: 5_0000000n, feeBreakdown: [{ kind: 'aggregator' as const, note: 'opaque' }],
      gasXlm: 0n, gasInTarget: 0n, netOut: 5_0000000n,
      netConfidence: 'estimate' as const, netRange: { low: 4_8000000n, high: 5_0000000n },
      route: [], priceImpactPct: -1, priceImpactLocalPct: -1, raw: {},
    };
    const fakeResult = {
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [sbQ as any], best: sbQ as any },
      errors: [],
    } as any;
    // Mixed burst: net is a conservative lower bound, not fully observed
    const fakeSimSb = vi.fn(async () => ({ net: 4_9200000n, route: ['BLND', 'USDC'], exact: false }));
    await resimAquariusXbull(
      fakeResult, 'USDC', AMT,
      { rpcUrl: 'https://rpc.test', stellarBrokerApiKey: 'key' },
      { simulateStellarBrokerNet: fakeSimSb as any },
    );
    const sbRow = fakeResult.ranking.ranked.find((q: any) => q.source === 'stellarbroker');
    expect(sbRow).toBeDefined();
    expect(sbRow!.netConfidence).toBe('estimate'); // NOT promoted
    expect(sbRow!.netOut).toBe(5_0000000n);        // original net, unchanged
    expect(sbRow!.netRange).toEqual({ low: 4_8000000n, high: 5_0000000n }); // original range kept
  });

  it('does not re-rank when SB sim fails (no stellarBrokerApiKey)', async () => {
    const sbQ = {
      source: 'stellarbroker' as const,
      sellAsset: BLND, buyAsset: USDC, amountIn: AMT,
      grossOut: 5_0000000n, gasXlm: 0n, gasInTarget: 0n, netOut: 5_0000000n,
      netConfidence: 'estimate' as const, netRange: undefined,
      feeBreakdown: [], route: [], raw: {},
    };
    const fakeResult = {
      request: {}, prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [sbQ as any], best: sbQ as any }, errors: [],
    } as any;
    const fakeSimSb = vi.fn(async () => ({ net: 4_9000000n, route: [] }));
    await resimAquariusXbull(
      fakeResult, 'USDC', AMT,
      { rpcUrl: 'https://rpc.test' }, // no key → SB branch skipped
      { simulateStellarBrokerNet: fakeSimSb as any },
    );
    expect(fakeSimSb).not.toHaveBeenCalled();
    // netConfidence unchanged
    expect(fakeResult.ranking.ranked[0].netConfidence).toBe('estimate');
  });

  // ─── P2: route threading ───────────────────────────────────────────────────

  it('P2: threads decoded multi-hop SB route into promoted row (resimAquariusXbull)', async () => {
    vi.mocked(priceImpactPct).mockReturnValue(1.5);

    const sbQ = {
      source: 'stellarbroker' as const,
      sellAsset: BLND, buyAsset: USDC, amountIn: AMT,
      grossOut: 5_0000000n, feeBreakdown: [{ kind: 'aggregator' as const, note: 'opaque' }],
      gasXlm: 0n, gasInTarget: 0n, netOut: 5_0000000n,
      netConfidence: 'estimate' as const, netRange: { low: 4_8000000n, high: 5_0000000n },
      route: [], priceImpactPct: -1, priceImpactLocalPct: -1, raw: {},
    };
    const fakeResult = {
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [sbQ as any], best: sbQ as any },
      errors: [],
    } as any;

    // Multi-hop decoded route: BLND → XLM → USDC (3 symbols → 2 hops)
    const fakeSimSb = vi.fn(async () => ({ net: 4_9200000n, route: ['BLND', 'XLM', 'USDC'], exact: true }));
    await resimAquariusXbull(
      fakeResult, 'USDC', AMT,
      { rpcUrl: 'https://rpc.test', stellarBrokerApiKey: 'key' },
      { simulateStellarBrokerNet: fakeSimSb as any },
    );

    const sbRow = fakeResult.ranking.ranked.find((q: any) => q.source === 'stellarbroker');
    expect(sbRow).toBeDefined();
    expect(sbRow!.route).toEqual([
      { venue: 'stellarbroker', sell: 'BLND', buy: 'XLM' },
      { venue: 'stellarbroker', sell: 'XLM', buy: 'USDC' },
    ]);
  });
});

describe('liveQuote — StellarBroker chip after re-sim', () => {
  beforeEach(() => {
    vi.mocked(engineQuote).mockReset();
    vi.mocked(priceImpactPct).mockReset();
  });

  it('shows "obs" chip for StellarBroker after successful re-sim', async () => {
    const sbQ = {
      ...makeQuote('stellarbroker', 5_0000000n),
      netConfidence: 'estimate' as const,
    };
    vi.mocked(engineQuote).mockResolvedValue({
      request: { sell: 'BLND', buy: 'USDC', amountIn: AMT, slippageBps: 50 },
      prices: { blndUsd: 0.05, eurcUsd: 1.08, eurcStellarMid: null, xlmUsd: 0.12 },
      ranking: { ranked: [sbQ], best: sbQ },
      errors: [],
    } as any);

    const fakeSimSb = vi.fn(async () => ({ net: 4_9500000n, route: ['BLND', 'USDC'], exact: true }));
    const result = await liveQuote(
      'USDC', AMT,
      { ...FAKE_CFG, stellarBrokerApiKey: 'test-key' } as any,
      { simulateStellarBrokerNet: fakeSimSb as any },
    );

    const sbRow = result.ladder.find(r => r.sourceId === 'stellarbroker');
    expect(sbRow).toBeDefined();
    expect(sbRow!.chip).toBe('obs');
    expect(sbRow!.net).toBeCloseTo(4.95, 5);
  });
});
