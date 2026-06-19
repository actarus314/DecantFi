import { describe, it, expect } from 'vitest';
import { fetchPrices, fetchEurcStellarMid, targetEvmPerUnit, targetLocalPerUnit, priceImpactPct } from './prices.js';
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

/** Fake fetcher qui répond à n'importe quelle URL avec le body fourni (ignore Horizon). */
function fakeFetchAll(llamaBody: unknown, horizonBody: unknown, ok = true): typeof fetch {
  return (async (url: string) => {
    const body = String(url).includes('horizon') || String(url).includes('order_book')
      ? horizonBody
      : llamaBody;
    return { ok, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

const orderBook = (bid?: string, ask?: string) => ({
  bids: bid !== undefined ? [{ price: bid }] : [],
  asks: ask !== undefined ? [{ price: ask }] : [],
});

describe('fetchPrices', () => {
  it('parse la reponse DefiLlama', async () => {
    const p = await fetchPrices({ fetcher: fakeFetchAll(llama(0.0512, 0.22, 1.158), orderBook('1.14', '1.16')) });
    expect(p.blndUsd).toBe(0.0512);
    expect(p.xlmUsd).toBe(0.22);
    expect(p.eurcUsd).toBe(1.158);
    expect(p.eurcStellarMid).toBeCloseTo(1.15, 5);
  });

  it('tolere les champs manquants', async () => {
    const p = await fetchPrices({ fetcher: fakeFetchAll(llama(undefined, 0.22), orderBook()) });
    expect(p.blndUsd).toBeNull();
    expect(p.eurcUsd).toBeNull();
    expect(p.eurcStellarMid).toBeNull();
  });

  it('tolere un echec reseau', async () => {
    const p = await fetchPrices({
      fetcher: (async () => {
        throw new Error('net');
      }) as unknown as typeof fetch,
    });
    expect(p).toEqual({ blndUsd: null, xlmUsd: null, eurcUsd: null, eurcStellarMid: null });
  });

  it('tolere une reponse !ok', async () => {
    const p = await fetchPrices({ fetcher: fakeFetch({}, false) });
    expect(p.blndUsd).toBeNull();
  });
});

describe('fetchEurcStellarMid', () => {
  it('calcule le mid quand bid et ask présents', async () => {
    const mid = await fetchEurcStellarMid(fakeFetch(orderBook('1.14', '1.16')), 5000);
    expect(mid).toBeCloseTo(1.15, 5);
  });

  it('renvoie null si carnet vide (aucun bid/ask)', async () => {
    const mid = await fetchEurcStellarMid(fakeFetch(orderBook()), 5000);
    expect(mid).toBeNull();
  });

  it('renvoie null si une seule jambe (seulement bid)', async () => {
    const mid = await fetchEurcStellarMid(fakeFetch(orderBook('1.14', undefined)), 5000);
    expect(mid).toBeNull();
  });

  it('renvoie null si une seule jambe (seulement ask)', async () => {
    const mid = await fetchEurcStellarMid(fakeFetch(orderBook(undefined, '1.16')), 5000);
    expect(mid).toBeNull();
  });

  it('renvoie null si valeur aberrante (< 0.5)', async () => {
    const mid = await fetchEurcStellarMid(fakeFetch(orderBook('0.2', '0.3')), 5000);
    expect(mid).toBeNull();
  });

  it('renvoie null si valeur aberrante (> 2.0)', async () => {
    const mid = await fetchEurcStellarMid(fakeFetch(orderBook('2.5', '3.0')), 5000);
    expect(mid).toBeNull();
  });

  it('renvoie null si reponse !ok', async () => {
    const mid = await fetchEurcStellarMid(fakeFetch({}, false), 5000);
    expect(mid).toBeNull();
  });

  it('renvoie null si echec reseau', async () => {
    const failFetch = (async () => { throw new Error('net'); }) as unknown as typeof fetch;
    const mid = await fetchEurcStellarMid(failFetch, 5000);
    expect(mid).toBeNull();
  });
});

describe('targetEvmPerUnit', () => {
  it('USDC = 1', () =>
    expect(targetEvmPerUnit('USDC', { blndUsd: null, xlmUsd: null, eurcUsd: 1.1, eurcStellarMid: 1.09 })).toBe(1));
  it('EURC = eurcUsd', () =>
    expect(targetEvmPerUnit('EURC', { blndUsd: null, xlmUsd: null, eurcUsd: 1.1, eurcStellarMid: 1.09 })).toBe(1.1));
  it('inconnu = null', () =>
    expect(targetEvmPerUnit('XYZ', { blndUsd: null, xlmUsd: null, eurcUsd: 1.1, eurcStellarMid: null })).toBeNull());
});

describe('targetLocalPerUnit', () => {
  it('USDC = 1', () =>
    expect(targetLocalPerUnit('USDC', { blndUsd: null, xlmUsd: null, eurcUsd: 1.1, eurcStellarMid: 1.09 })).toBe(1));
  it('EURC = eurcStellarMid', () =>
    expect(targetLocalPerUnit('EURC', { blndUsd: null, xlmUsd: null, eurcUsd: 1.1, eurcStellarMid: 1.09 })).toBe(1.09));
  it('EURC null si eurcStellarMid absent', () =>
    expect(targetLocalPerUnit('EURC', { blndUsd: null, xlmUsd: null, eurcUsd: 1.1, eurcStellarMid: null })).toBeNull());
  it('inconnu = null', () =>
    expect(targetLocalPerUnit('XYZ', { blndUsd: null, xlmUsd: null, eurcUsd: 1.1, eurcStellarMid: 1.09 })).toBeNull());
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
