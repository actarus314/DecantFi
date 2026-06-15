import { describe, it, expect } from 'vitest';
import { fetchPrices, targetUsdPerUnit, priceImpactPct } from './prices.js';
import { toStroops } from './amount.js';

const fakeFetch = (body: unknown, ok = true): typeof fetch =>
  (async () => ({ ok, json: async () => body }) as Response) as unknown as typeof fetch;

const llama = (blnd?: number, xlm?: number, eur?: number) => ({
  coins: {
    ...(blnd !== undefined ? { 'coingecko:blend': { price: blnd } } : {}),
    ...(xlm !== undefined ? { 'coingecko:stellar': { price: xlm } } : {}),
    ...(eur !== undefined ? { 'coingecko:euro-coin': { price: eur } } : {}),
  },
});

describe('fetchPrices', () => {
  it('parse la reponse DefiLlama', async () => {
    const p = await fetchPrices({ fetcher: fakeFetch(llama(0.0512, 0.22, 1.158)) });
    expect(p.blndUsd).toBe(0.0512);
    expect(p.xlmUsd).toBe(0.22);
    expect(p.eurUsd).toBe(1.158);
  });

  it('tolere les champs manquants', async () => {
    const p = await fetchPrices({ fetcher: fakeFetch(llama(undefined, 0.22)) });
    expect(p.blndUsd).toBeNull();
    expect(p.eurUsd).toBeNull();
  });

  it('tolere un echec reseau', async () => {
    const p = await fetchPrices({
      fetcher: (async () => {
        throw new Error('net');
      }) as unknown as typeof fetch,
    });
    expect(p).toEqual({ blndUsd: null, xlmUsd: null, eurUsd: null });
  });

  it('tolere une reponse !ok', async () => {
    const p = await fetchPrices({ fetcher: fakeFetch({}, false) });
    expect(p.blndUsd).toBeNull();
  });
});

describe('targetUsdPerUnit', () => {
  it('USDC = 1', () =>
    expect(targetUsdPerUnit('USDC', { blndUsd: null, xlmUsd: null, eurUsd: 1.1 })).toBe(1));
  it('EURC = eurUsd', () =>
    expect(targetUsdPerUnit('EURC', { blndUsd: null, xlmUsd: null, eurUsd: 1.1 })).toBe(1.1));
  it('inconnu = null', () =>
    expect(targetUsdPerUnit('XYZ', { blndUsd: null, xlmUsd: null, eurUsd: 1.1 })).toBeNull());
});

describe('priceImpactPct', () => {
  it('~1 % si on recoit 1 % de moins que la valeur spot', () => {
    // 1000 BLND @0.0512 = 51.2 USD ; net 50.688 USDC -> impact 1 %
    expect(priceImpactPct(toStroops('1000'), toStroops('50.688'), 0.0512, 1)).toBeCloseTo(1, 3);
  });
  it('undefined sans prix', () => {
    expect(priceImpactPct(toStroops('1000'), toStroops('50'), null, 1)).toBeUndefined();
  });
});
