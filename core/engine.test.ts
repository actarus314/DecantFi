import { describe, it, expect } from 'vitest';
import { quote, finalize, type EngineConfig } from './engine.js';
import type { SourceAdapter, NormalizedQuote } from './sources/types.js';
import { BLND, USDC, EURC } from './assets.js';
import { toStroops } from './amount.js';
import { quote as mk } from '../test/factory.js';

const prices = { blndUsd: 0.0512, xlmUsd: 0.11, eurUsd: 1.08 };

function fakeAdapter(id: string, net: bigint, available = true): SourceAdapter {
  return {
    id,
    available: () => available,
    async quote(req) {
      return mk(id, net, {
        sellAsset: req.sellAsset,
        buyAsset: req.buyAsset,
        amountIn: req.amountIn,
        grossOut: net,
      });
    },
  };
}

const cfg = (adapters: SourceAdapter[]): EngineConfig => ({ rpcUrl: '', horizonUrl: '', prices, adapters });

describe('finalize', () => {
  it('soustrait le gas et calcule l impact vs spot', () => {
    const q = mk('x', toStroops('50.9'), { grossOut: toStroops('50.9'), gasXlm: 450_000n }) as NormalizedQuote;
    const f = finalize(q, prices);
    expect(f.gasInTarget).toBeGreaterThan(0n);
    expect(f.netOut).toBeLessThan(toStroops('50.9'));
    expect(f.priceImpactPct).toBeDefined();
  });
});

describe('quote vers USDC', () => {
  it('classe les sources, remonte le meilleur net + le plancher Horizon', async () => {
    const adapters = [
      fakeAdapter('a', toStroops('50.5')),
      fakeAdapter('b', toStroops('50.9')),
      fakeAdapter('horizon', toStroops('45.6')),
    ];
    const r = await quote({ sell: BLND, buy: USDC, amountIn: toStroops('1000'), cfg: cfg(adapters) });
    expect(r.ranking.best?.source).toBe('b');
    expect(r.ranking.floor?.source).toBe('horizon');
    expect(r.errors).toEqual([]);
  });

  it('tolere une source qui jette (non bloquant)', async () => {
    const boom: SourceAdapter = {
      id: 'boom',
      available: () => true,
      async quote() {
        throw new Error('down');
      },
    };
    const r = await quote({
      sell: BLND,
      buy: USDC,
      amountIn: toStroops('1000'),
      cfg: cfg([fakeAdapter('a', toStroops('50.5')), boom]),
    });
    expect(r.ranking.best?.source).toBe('a');
    expect(r.errors).toContain('boom');
  });

  it('exclut une source qui ne supporte pas la paire (pas listee comme echec)', async () => {
    const na: SourceAdapter = {
      id: 'na',
      available: () => true,
      supports: () => false,
      async quote() {
        return null;
      },
    };
    const r = await quote({
      sell: BLND,
      buy: USDC,
      amountIn: toStroops('1000'),
      cfg: cfg([fakeAdapter('a', toStroops('50.5')), na]),
    });
    expect(r.errors).not.toContain('na');
    expect(r.ranking.ranked.map((q) => q.source)).toEqual(['a']);
  });

  it('ignore les sources non disponibles', async () => {
    const r = await quote({
      sell: BLND,
      buy: USDC,
      amountIn: toStroops('1000'),
      cfg: cfg([fakeAdapter('a', toStroops('50.5')), fakeAdapter('off', toStroops('99'), false)]),
    });
    expect(r.ranking.ranked.map((q) => q.source)).toEqual(['a']);
  });
});

describe('quote vers EURC', () => {
  it('compare direct vs via-USDC et choisit le meilleur net EURC', async () => {
    const dynamic: SourceAdapter = {
      id: 'dyn',
      available: () => true,
      async quote(req) {
        const pair = `${req.sellAsset.symbol}->${req.buyAsset.symbol}`;
        const map: Record<string, string> = { 'BLND->EURC': '43.6', 'BLND->USDC': '50.8', 'USDC->EURC': '46.7' };
        const v = map[pair];
        if (!v) return null;
        return mk('dyn', toStroops(v), {
          sellAsset: req.sellAsset,
          buyAsset: req.buyAsset,
          amountIn: req.amountIn,
          grossOut: toStroops(v),
        });
      },
    };
    const r = await quote({ sell: BLND, buy: EURC, amountIn: toStroops('1000'), cfg: cfg([dynamic]) });
    expect(r.eurc).toBeDefined();
    expect(r.eurc!.winner).toBe('via-usdc');
  });
});
