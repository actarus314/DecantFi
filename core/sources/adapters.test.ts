// Tests des adapters sur des reponses REELLES capturees en live le 2026-06-15 (fixtures).
// Figent le parsing/normalisation des 7 sources (contrats d'API verifies).
import { describe, it, expect } from 'vitest';
import { xdr, scValToNative } from '@stellar/stellar-sdk';
import type { QuoteRequest } from './types.js';
import { BLND, USDC, EURC } from '../assets.js';
import { toStroops } from '../amount.js';
import { loadFixture } from '../../test/loadFixture.js';
import { parseXbull } from './xbull.js';
import { parseAquarius } from './aquarius.js';
import { parseHorizon } from './horizon.js';
import { parseStellarbroker } from './stellarbroker.js';
import { parseUltrastellar } from './ultrastellar.js';
import { parseSoroswapRoute } from './soroswap.js';
import { decodeCometOut } from './comet.js';
import { decodePhoenixOut } from './phoenix.js';

const req: QuoteRequest = { sellAsset: BLND, buyAsset: USDC, amountIn: toStroops('1000'), slippageBps: 50 };

describe('xbull', () => {
  it('toAmount = net (stroops)', () => {
    const q = parseXbull(loadFixture('xbull.blnd-usdc.json'), req)!;
    expect(q.source).toBe('xbull');
    expect(q.netOut).toBe(509187563n);
    expect(q.netConfidence).toBe('exact');
    expect(q.feeBreakdown[0]?.amount).toBe(509187n);
  });
  it('shape .app (fee = string ratio) : netOut exact, feeBreakdown vide', () => {
    // Shape renvoyée par swap.apis.xbull.app (endpoint exécutable, vérité actuelle)
    const raw = { route: 'abc123', fromAmount: '300000000', fromAsset: 'C...', toAsset: 'C...', toAmount: '14493322', fee: '0.001' };
    const q = parseXbull(raw, req)!;
    expect(q.netOut).toBe(14493322n);
    expect(q.netConfidence).toBe('exact');
    expect(q.feeBreakdown).toHaveLength(0);
  });
  it('null si toAmount absent', () => {
    expect(parseXbull({}, req)).toBeNull();
  });
});

describe('aquarius', () => {
  it('amount_with_fee = net (stroops), route via sUSD', () => {
    const q = parseAquarius(loadFixture('aquarius.blnd-usdc.json'), req)!;
    expect(q.source).toBe('aquarius');
    expect(q.netOut).toBe(505220384n);
    expect(q.route.map((h) => h.buy)).toContain('sUSD');
  });
  it('raw find-path quote defaults to estimate confidence (over-quotes ~0.2% via-XLM routes)', () => {
    const q = parseAquarius(loadFixture('aquarius.blnd-usdc.json'), req)!;
    // find-path API over-quotes; confidence is promoted to 'exact' only after a successful on-chain re-sim
    expect(q.netConfidence).toBe('estimate');
  });
  it('null si success=false', () => {
    expect(parseAquarius({ success: false }, req)).toBeNull();
  });
});

describe('horizon', () => {
  it('prend le meilleur destination_amount (humain -> stroops)', () => {
    const q = parseHorizon(loadFixture('horizon.blnd-usdc.json'), req)!;
    expect(q.source).toBe('horizon');
    expect(q.netOut).toBe(toStroops('45.6531063'));
  });
  it('null si aucun record', () => {
    expect(parseHorizon({ _embedded: { records: [] } }, req)).toBeNull();
  });
});

describe('stellarbroker', () => {
  it('classe sur le plancher, expose la fourchette', () => {
    const q = parseStellarbroker(loadFixture('stellarbroker.blnd-usdc.json'), req)!;
    expect(q.netConfidence).toBe('floor');
    expect(q.netOut).toBe(toStroops('45.653111'));
    expect(q.netRange?.high).toBe(toStroops('47.9822629'));
    expect(q.netRange!.high).toBeGreaterThan(q.netRange!.low);
  });
  it('null si status != success', () => {
    expect(parseStellarbroker({ status: 'error' }, req)).toBeNull();
  });
});

describe('ultrastellar', () => {
  it('optimized_sum = net (humain -> stroops)', () => {
    const q = parseUltrastellar(loadFixture('ultrastellar.blnd-usdc.json'), req)!;
    expect(q.netOut).toBe(toStroops('48.1573592'));
    expect(q.netConfidence).toBe('exact');
  });
});

describe('soroswap', () => {
  it('quoteCurrency = sortie nette (stroops)', () => {
    const f = loadFixture('soroswap.blnd-usdc.json') as {
      quoteCurrency: { raw: string };
      trade: { path: string[] };
    };
    const route = { quoteCurrency: { quotient: f.quoteCurrency.raw }, trade: { path: f.trade.path } };
    const q = parseSoroswapRoute(route, req)!;
    expect(q.source).toBe('soroswap');
    expect(q.netOut).toBe(506342052n);
    expect(q.route.map((h) => h.sell)).toContain('BLND');
  });

  it('multi-hop : path 3 noeuds -> 2 hops BLND->USDC->EURC', () => {
    const route = { quoteCurrency: { quotient: '439000000' }, trade: { path: [BLND.sac, USDC.sac, EURC.sac] } };
    const reqE: QuoteRequest = { sellAsset: BLND, buyAsset: EURC, amountIn: toStroops('1000'), slippageBps: 50 };
    const q = parseSoroswapRoute(route, reqE)!;
    expect(q.route).toHaveLength(2);
    expect(q.route[0]).toMatchObject({ sell: 'BLND', buy: 'USDC' });
    expect(q.route[1]).toMatchObject({ sell: 'USDC', buy: 'EURC' });
    expect(q.netOut).toBe(439000000n);
  });
});

describe('phoenix', () => {
  it('decodePhoenixOut → ask_amount (déjà net de commission)', () => {
    expect(decodePhoenixOut({ ask_amount: 194227186n, commission_amount: 976016n, spread_amount: 4980n, total_return: 195208182n })).toBe(194227186n);
  });
  it('decodePhoenixOut → null si absent / ≤0 / non-objet', () => {
    expect(decodePhoenixOut(null)).toBeNull();
    expect(decodePhoenixOut({})).toBeNull();
    expect(decodePhoenixOut({ ask_amount: 0n })).toBeNull();
    expect(decodePhoenixOut('nope')).toBeNull();
  });
});

describe('comet', () => {
  it('decode le retval simule (vec [amount_out, prix]) -> ~50,9156 USDC', () => {
    const f = loadFixture('comet.blnd-usdc.json') as {
      result: { results: { xdr: string }[] };
    };
    const native = scValToNative(xdr.ScVal.fromXDR(f.result.results[0]!.xdr, 'base64'));
    expect(decodeCometOut(native)).toBe(509156322n);
  });
  it('decode direct depuis un tableau', () => {
    expect(decodeCometOut([509156322n, 196540873n])).toBe(509156322n);
    expect(decodeCometOut([])).toBeNull();
  });
});
