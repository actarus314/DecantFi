// Tests unitaires pour collector/coherence.ts — aucun réseau.
// On teste les helpers purs : netFromTransfers, evaluateSoroban, runCoherenceProbes.
import { describe, it, expect } from 'vitest';
import { netFromTransfers, evaluateSoroban, runCoherenceProbes, type CoherenceResult } from './coherence.js';
import type { Transfer } from '../core/soroban-route.js';
import type { CoherenceProbeInsert } from '../db/index.js';

const SENDER = 'GAAAA';
const ROUTER = 'CBBBB';

/** Construit une chaîne de transfers BLND → USDC (topologie hub-spoke). */
function makeTransfers(blndIn: bigint, usdcOut: bigint): Transfer[] {
  return [
    // BLND : SENDER débite → ROUTER
    { asset: 'BLND', from: SENDER, to: ROUTER, amount: blndIn },
    // USDC : ROUTER → SENDER
    { asset: 'USDC', from: ROUTER, to: SENDER, amount: usdcOut },
  ];
}

// ─── netFromTransfers ────────────────────────────────────────────────────────

describe('netFromTransfers', () => {
  it('somme les crédits de buySymbol vers sender', () => {
    const transfers = makeTransfers(1000n, 480n);
    expect(netFromTransfers(transfers, 'USDC', SENDER)).toBe(480n);
  });

  it('ignore les débits et les autres actifs', () => {
    const transfers: Transfer[] = [
      { asset: 'BLND', from: SENDER, to: ROUTER, amount: 1000n },
      { asset: 'USDC', from: ROUTER, to: SENDER, amount: 480n },
      { asset: 'XLM', from: ROUTER, to: SENDER, amount: 5n }, // intermédiaire ignoré
    ];
    expect(netFromTransfers(transfers, 'USDC', SENDER)).toBe(480n);
  });

  it('retourne 0n si aucun crédit', () => {
    const transfers = makeTransfers(1000n, 480n);
    expect(netFromTransfers(transfers, 'USDC', 'GOTHER')).toBe(0n);
  });

  it('additionne plusieurs crédits', () => {
    const transfers: Transfer[] = [
      { asset: 'USDC', from: ROUTER, to: SENDER, amount: 200n },
      { asset: 'USDC', from: ROUTER, to: SENDER, amount: 280n },
    ];
    expect(netFromTransfers(transfers, 'USDC', SENDER)).toBe(480n);
  });
});

// ─── evaluateSoroban — cas cohérent ──────────────────────────────────────────

describe('evaluateSoroban — cohérent', () => {
  it('delta faible (< 50 bps) → incoherent=false, reason=null', () => {
    const transfers = makeTransfers(1_000_000_000n, 48_000_000n);
    // netQuoted légèrement différent du simulé : +10 bps (simulé 48_000_000, quoted 48_048_000)
    const netQuoted = 48_048_000n; // ~+10 bps sur 48_000_000
    const r = evaluateSoroban(transfers, netQuoted, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(false);
    expect(r.reason).toBeNull();
    expect(r.netSimulated).toBe(48_000_000n);
    expect(r.deltaBps).not.toBeNull();
    expect(r.deltaBps!).toBeLessThan(50);
    expect(r.route).toEqual(['BLND', 'USDC']);
  });

  it('delta nul → deltaBps = 0', () => {
    const transfers = makeTransfers(1_000_000_000n, 48_000_000n);
    const r = evaluateSoroban(transfers, 48_000_000n, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(false);
    expect(r.deltaBps).toBe(0);
  });
});

// ─── evaluateSoroban — écart de prix suspect ─────────────────────────────────

describe('evaluateSoroban — écart prix suspect', () => {
  it('delta > 50 bps → incoherent=true, reason contient "écart"', () => {
    const transfers = makeTransfers(1_000_000_000n, 47_000_000n);
    // netQuoted ≈ simulé + 0,8 % (comme Aquarius sur-cote) → 47_376_000
    const netQuoted = 47_376_000n; // ~+800 bps sur 47_000_000
    const r = evaluateSoroban(transfers, netQuoted, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(true);
    expect(r.reason).not.toBeNull();
    expect(r.reason).toContain('écart');
    expect(r.deltaBps).not.toBeNull();
    expect(r.deltaBps!).toBeGreaterThan(50);
  });

  it('delta juste en-dessous de 50 bps → incoherent=false', () => {
    // simulé = 100_000_000, quoted = 100_049_000 → 49 bps (~< 50)
    const transfers = makeTransfers(1_000_000_000n, 100_000_000n);
    const netQuoted = 100_049_000n;
    const r = evaluateSoroban(transfers, netQuoted, SENDER, 'BLND', 'USDC');
    expect(r.deltaBps).not.toBeNull();
    expect(r.deltaBps!).toBeLessThan(50);
    expect(r.incoherent).toBe(false);
  });
});

// ─── evaluateSoroban — route non chaînée ─────────────────────────────────────

describe('evaluateSoroban — route non chaînée', () => {
  it('transfers insuffisants → incoherent=true, reason depuis verifyChain', () => {
    // Un seul transfer ne suffit pas (verifyChain exige >= 2)
    const transfers: Transfer[] = [
      { asset: 'BLND', from: SENDER, to: ROUTER, amount: 1_000_000_000n },
    ];
    const r = evaluateSoroban(transfers, 0n, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(true);
    expect(r.reason).not.toBeNull();
    // verifyChain retourne 'transferts insuffisants'
    expect(r.reason).toContain('transferts');
  });

  it('actif intermédiaire capté par sender → incoherent=true', () => {
    // SENDER reçoit XLM intermédiaire : route incohérente
    const transfers: Transfer[] = [
      { asset: 'BLND', from: SENDER, to: ROUTER, amount: 1_000_000_000n },
      { asset: 'XLM', from: ROUTER, to: SENDER, amount: 5_000_000n }, // fuite intermédiaire
      { asset: 'USDC', from: ROUTER, to: SENDER, amount: 47_000_000n },
    ];
    const r = evaluateSoroban(transfers, 47_000_000n, SENDER, 'BLND', 'USDC');
    expect(r.incoherent).toBe(true);
    expect(r.reason).not.toBeNull();
    expect(r.reason).toContain('XLM');
  });
});

// ─── runCoherenceProbes ───────────────────────────────────────────────────────

/** DB en mémoire minimale pour les tests. */
function makeDb() {
  const inserted: CoherenceProbeInsert[] = [];
  const probed = new Set<string>(); // venue → true si déjà en base
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

/** Config minimale valide. */
const BASE_CFG = {
  rpcUrl: 'https://rpc.example.com',
  horizonUrl: 'https://horizon.example.com',
  soroswapApiKey: 'test-key',
  timeoutMs: 5000,
  sizesBlnd: [1_000_000_000n, 3_000_000_000n],
  pairs: ['USDC', 'EURC'] as Array<'USDC' | 'EURC'>,
  cadenceSec: 900,
};

/** Résultat cohérent factice. */
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

/** Résultat incohérent factice. */
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
  it('random=0 (déclenchement forcé) → insertion appelée avec les bons champs', async () => {
    const db = makeDb();
    // random séquence : 0 pour la proba (déclenche), puis 0 pour le choix de paire et taille
    let call = 0;
    const random = () => [0, 0, 0][call++] ?? 0;
    const probe = async (venue: string) => cohérentResult(venue);

    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    // Au moins une insertion (xbull est la première venue)
    expect(db.inserted.length).toBeGreaterThan(0);
    const row = db.inserted[0]!;
    expect(row.created_at).toBe('2026-06-19T10:00:00.000Z');
    expect(row.venue).toBe('xbull');
    expect(row.incoherent).toBe(false);
    // trace_json est null si cohérent
    expect(row.trace_json).toBeNull();
    // route_json est présent
    expect(row.route_json).toBe(JSON.stringify(['BLND', 'USDC']));
  });

  it('résultat incohérent → trace_json non null', async () => {
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
    // trace_json doit contenir deltaBps
    const trace = JSON.parse(row.trace_json!);
    expect(trace.deltaBps).toBe(800);
  });

  it("venue deja sondee aujourd'hui -> pas d'insertion", async () => {
    const db = makeDb();
    db.markProbed('xbull');
    const random = () => 0; // déclenchement forcé
    const probe = async (venue: string) => cohérentResult(venue);

    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    // xbull doit être absente des insertions
    const xbullInserts = db.inserted.filter((r) => r.venue === 'xbull');
    expect(xbullInserts.length).toBe(0);
  });

  it('probe retourne null -> pas insertion pour cette venue', async () => {
    const db = makeDb();
    const random = () => 0;
    const probe = async () => null; // toujours null

    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    expect(db.inserted.length).toBe(0);
  });

  it('comet force pair=USDC quel que soit le cfg.pairs', async () => {
    const db = makeDb();
    // Marquer toutes les autres venues pour n'exécuter que comet
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

  it('random=0.99 avec ticksRemaining élevé → pas de déclenchement', async () => {
    const db = makeDb();
    const random = () => 0.99; // jamais inférieur à 1/ticksRemaining si ticksRemaining > 1
    const probe = async (venue: string) => cohérentResult(venue);

    // now très tôt dans la journée → beaucoup de ticks restants (ex: 14h avant minuit, cadence 900s → ~56 ticks)
    const now = new Date('2026-06-19T10:00:00.000Z');
    await runCoherenceProbes(db, BASE_CFG, now, { random, probe: probe as never });

    expect(db.inserted.length).toBe(0);
  });
});
