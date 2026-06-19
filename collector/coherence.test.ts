// Tests unitaires pour collector/coherence.ts — aucun réseau.
// On teste les helpers purs : netFromTransfers et evaluateSoroban.
import { describe, it, expect } from 'vitest';
import { netFromTransfers, evaluateSoroban } from './coherence.js';
import type { Transfer } from '../core/soroban-route.js';

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
