// Unit tests for collector/coherence.ts — no network.
// Tests the pure helpers: netFromTransfers, evaluateSoroban, runCoherenceProbes.
import { describe, it, expect } from 'vitest';
import { netFromTransfers, evaluateSoroban, runCoherenceProbes, type CoherenceResult } from './coherence.js';
import type { Transfer } from '../core/soroban-route.js';
import type { CoherenceProbeInsert } from '../db/index.js';

const SENDER = 'GAAAA';
const ROUTER = 'CBBBB';

/** Builds a chain of BLND → USDC transfers (hub-spoke topology). */
function makeTransfers(blndIn: bigint, usdcOut: bigint): Transfer[] {
  return [
    // BLND: SENDER debits → ROUTER
    { asset: 'BLND', from: SENDER, to: ROUTER, amount: blndIn },
    // USDC: ROUTER → SENDER
    { asset: 'USDC', from: ROUTER, to: SENDER, amount: usdcOut },
  ];
}

// ─── netFromTransfers ────────────────────────────────────────────────────────

describe('netFromTransfers', () => {
  it('sums buySymbol credits to sender', () => {
    const transfers = makeTransfers(1000n, 480n);
    expect(netFromTransfers(transfers, 'USDC', SENDER)).toBe(480n);
  });

  it('ignores debits and other assets', () => {
    const transfers: Transfer[] = [
      { asset: 'BLND', from: SENDER, to: ROUTER, amount: 1000n },
      { asset: 'USDC', from: ROUTER, to: SENDER, amount: 480n },
      { asset: 'XLM', from: ROUTER, to: SENDER, amount: 5n }, // intermediate, ignored
    ];
    expect(netFromTransfers(transfers, 'USDC', SENDER)).toBe(480n);
  });

  it('returns 0n when there are no credits', () => {
    const transfers = makeTransfers(1000n, 480n);
    expect(netFromTransfers(transfers, 'USDC', 'GOTHER')).toBe(0n);
  });

  it('sums multiple credits', () => {
    const transfers: Transfer[] = [
      { asset: 'USDC', from: ROUTER, to: SENDER, amount: 200n },
      { asset: 'USDC', from: ROUTER, to: SENDER, amount: 280n },
    ];
    expect(netFromTransfers(transfers, 'USDC', SENDER)).toBe(480n);
  });
});

// ─── evaluateSoroban — coherent case ──────────────────────────────────────────

describe('evaluateSoroban — coherent', () => {
  it('small delta (< 50 bps) → incoherent=false, reason=null', () => {
    const transfers = makeTransfers(1_000_000_000n, 48_000_000n);
    // netQuoted slightly different from simulated: +10 bps (simulated 48_000_000, quoted 48_048_000)
    const netQuoted = 48_048_000n; // ~+10 bps on 48_000_000
    const r = evaluateSoroban(transfers, netQuoted, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(false);
    expect(r.reason).toBeNull();
    expect(r.netSimulated).toBe(48_000_000n);
    expect(r.deltaBps).not.toBeNull();
    expect(r.deltaBps!).toBeLessThan(50);
    expect(r.route).toEqual(['BLND', 'USDC']);
  });

  it('zero delta → deltaBps = 0', () => {
    const transfers = makeTransfers(1_000_000_000n, 48_000_000n);
    const r = evaluateSoroban(transfers, 48_000_000n, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(false);
    expect(r.deltaBps).toBe(0);
  });
});

// ─── evaluateSoroban — suspect price gap ─────────────────────────────────

describe('evaluateSoroban — suspect price gap', () => {
  it('delta > 50 bps → incoherent=true, reason contains "écart"', () => {
    const transfers = makeTransfers(1_000_000_000n, 47_000_000n);
    // netQuoted ≈ simulated + 0.8% (like Aquarius over-quotes) → 47_376_000
    const netQuoted = 47_376_000n; // ~+800 bps on 47_000_000
    const r = evaluateSoroban(transfers, netQuoted, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(true);
    expect(r.reason).not.toBeNull();
    expect(r.reason).toContain('écart');
    expect(r.deltaBps).not.toBeNull();
    expect(r.deltaBps!).toBeGreaterThan(50);
  });

  it('delta just below 50 bps → incoherent=false', () => {
    // simulated = 100_000_000, quoted = 100_049_000 → 49 bps (~< 50)
    const transfers = makeTransfers(1_000_000_000n, 100_000_000n);
    const netQuoted = 100_049_000n;
    const r = evaluateSoroban(transfers, netQuoted, SENDER, 'BLND', 'USDC');
    expect(r.deltaBps).not.toBeNull();
    expect(r.deltaBps!).toBeLessThan(50);
    expect(r.incoherent).toBe(false);
  });
});

// ─── evaluateSoroban — unchained route ─────────────────────────────────────

describe('evaluateSoroban — unchained route', () => {
  it('insufficient transfers → incoherent=true, reason from verifyChain', () => {
    // A single transfer isn't enough (verifyChain requires >= 2)
    const transfers: Transfer[] = [
      { asset: 'BLND', from: SENDER, to: ROUTER, amount: 1_000_000_000n },
    ];
    const r = evaluateSoroban(transfers, 0n, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(true);
    expect(r.reason).not.toBeNull();
    // verifyChain returns 'transferts insuffisants'
    expect(r.reason).toContain('transferts');
  });

  it('sender captures an intermediate asset → incoherent=true', () => {
    // SENDER receives intermediate XLM: incoherent route
    const transfers: Transfer[] = [
      { asset: 'BLND', from: SENDER, to: ROUTER, amount: 1_000_000_000n },
      { asset: 'XLM', from: ROUTER, to: SENDER, amount: 5_000_000n }, // intermediate leak
      { asset: 'USDC', from: ROUTER, to: SENDER, amount: 47_000_000n },
    ];
    const r = evaluateSoroban(transfers, 47_000_000n, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(true);
    expect(r.reason).not.toBeNull();
    expect(r.reason).toContain('XLM');
  });
});

// ─── runCoherenceProbes ───────────────────────────────────────────────────────

/** Minimal in-memory DB for tests. */
function makeDb() {
  const inserted: CoherenceProbeInsert[] = [];
  const probed = new Set<string>(); // venue → true if already in the DB
  return {
    inserted,
    hasCoherenceProbeSince(venue: string, _sinceIso: string): boolean {
      return probed.has(venue);
    },
    insertCoherenceProbe(row: CoherenceProbeInsert): void {
      inserted.push(row);
      probed.add(row.venue);
    },
    markProbed(venue: string) { probed.add(venue); },
  };
}

/** Minimal valid config. */
const BASE_CFG = {
  rpcUrl: 'https://rpc.example.com',
  horizonUrl: 'https://horizon.example.com',
  soroswapApiKey: 'test-key',
  timeoutMs: 5000,
  sizesBlnd: [1_000_000_000n, 3_000_000_000n],
  pairs: ['USDC', 'EURC'] as Array<'USDC' | 'EURC'>,
  cadenceSec: 900,
};

/** Fake coherent result. */
function cohérentResult(venue: string): CoherenceResult {
  return {
    venue: venue as never,
    incoherent: false,
    reason: null,
    netQuoted: 48_000_000n,
    netSimulated: 48_000_000n,
    deltaBps: 0,
    route: ['BLND', 'USDC'],
    transfers: [],
  };
}

/** Fake incoherent result. */
function incohérentResult(venue: string): CoherenceResult {
  return {
    venue: venue as never,
    incoherent: true,
    reason: 'écart prix 800 bps',
    netQuoted: 48_000_000n,
    netSimulated: 44_000_000n,
    deltaBps: 800,
    route: ['BLND', 'USDC'],
    transfers: [{ asset: 'BLND', from: SENDER, to: ROUTER, amount: 1_000_000_000n }],
  };
}

describe('runCoherenceProbes', () => {
  it('random=0 (forced trigger) → insertion called with the right fields', async () => {
    const db = makeDb();
    // random sequence: 0 for the probability (triggers), then 0 for the pair and size choice
    let call = 0;
    const random = () => [0, 0, 0][call++] ?? 0;
    const probe = async (venue: string) => cohérentResult(venue);

    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    // At least one insertion (xbull is the first venue)
    expect(db.inserted.length).toBeGreaterThan(0);
    const row = db.inserted[0]!;
    expect(row.created_at).toBe('2026-06-19T10:00:00.000Z');
    expect(row.venue).toBe('xbull');
    expect(row.incoherent).toBe(false);
    // trace_json is null when coherent
    expect(row.trace_json).toBeNull();
    // route_json is present
    expect(row.route_json).toBe(JSON.stringify(['BLND', 'USDC']));
  });

  it('incoherent result → trace_json not null', async () => {
    const db = makeDb();
    let call = 0;
    const random = () => [0, 0, 0][call++] ?? 0;
    const probe = async (venue: string) => incohérentResult(venue);

    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    expect(db.inserted.length).toBeGreaterThan(0);
    const row = db.inserted[0]!;
    expect(row.incoherent).toBe(true);
    expect(row.trace_json).not.toBeNull();
    // trace_json must contain deltaBps
    const trace = JSON.parse(row.trace_json!);
    expect(trace.deltaBps).toBe(800);
  });

  it("venue already probed today -> no insertion", async () => {
    const db = makeDb();
    db.markProbed('xbull');
    const random = () => 0; // forced trigger
    const probe = async (venue: string) => cohérentResult(venue);

    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    // xbull must be absent from insertions
    const xbullInserts = db.inserted.filter((r) => r.venue === 'xbull');
    expect(xbullInserts.length).toBe(0);
  });

  it('probe returns null -> no insertion for that venue', async () => {
    const db = makeDb();
    const random = () => 0;
    const probe = async () => null; // always null

    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    expect(db.inserted.length).toBe(0);
  });

  it('comet forces pair=USDC regardless of cfg.pairs', async () => {
    const db = makeDb();
    // Mark all other venues so only comet runs
    for (const v of ['xbull', 'aquarius', 'soroswap', 'horizon', 'ultrastellar']) {
      db.markProbed(v);
    }
    const random = () => 0;
    const capturedArgs: Array<{ venue: string; buy: { symbol: string } }> = [];
    const probe = async (venue: string, buy: { symbol: string }) => {
      capturedArgs.push({ venue, buy });
      return cohérentResult(venue);
    };

    const cfgEurcOnly = { ...BASE_CFG, pairs: ['EURC'] as Array<'USDC' | 'EURC'> };
    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, cfgEurcOnly, now, { random, probe: probe as never });

    const cometCall = capturedArgs.find((a) => a.venue === 'comet');
    expect(cometCall).toBeDefined();
    expect(cometCall!.buy.symbol).toBe('USDC');

    const cometInsert = db.inserted.find((r) => r.venue === 'comet');
    expect(cometInsert?.pair).toBe('USDC');
  });

  it('random=0.99 with high ticksRemaining → no trigger', async () => {
    const db = makeDb();
    const random = () => 0.99; // never below 1/ticksRemaining when ticksRemaining > 1
    const probe = async (venue: string) => cohérentResult(venue);

    // now very early in the day → many ticks remaining (e.g. 14h before midnight, 900s cadence → ~56 ticks)
    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    expect(db.inserted.length).toBe(0);
  });
});
