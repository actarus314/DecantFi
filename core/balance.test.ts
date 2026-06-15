import { describe, it, expect } from 'vitest';
import { parseBlndBalance, readBlndBalance } from './balance.js';
import { toStroops } from './amount.js';

const account = (balances: unknown[]) => ({ balances });

describe('parseBlndBalance', () => {
  it('extrait la balance BLND classique en stroops', () => {
    const raw = account([
      { balance: '123.4500000', asset_code: 'BLND', asset_issuer: 'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY' },
      { balance: '5.0000000', asset_type: 'native' },
    ]);
    expect(parseBlndBalance(raw)).toBe(toStroops('123.45'));
  });
  it('trustline BLND absente → 0', () => {
    expect(parseBlndBalance(account([{ balance: '5.0', asset_type: 'native' }]))).toBe(0n);
  });
  it('réponse inattendue / compte inexistant → 0', () => {
    expect(parseBlndBalance(null)).toBe(0n);
    expect(parseBlndBalance({})).toBe(0n);
  });
});

describe('readBlndBalance', () => {
  it('appelle Horizon /accounts/{addr} via le fetcher injecté', async () => {
    const fetcher = async () => parseBlndBalance; // sentinelle non utilisée
    const getJson = async () =>
      account([{ balance: '10.0000000', asset_code: 'BLND', asset_issuer: 'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY' }]);
    const bal = await readBlndBalance('GC43VW7DGJREUMJWMHJZOAWWWQ374ZKCFS2GKGRMNAIXSNV53WIBY5AA', {
      horizonUrl: 'https://horizon.stellar.org', getJson,
    });
    expect(bal).toBe(toStroops('10'));
    void fetcher;
  });
  it('Horizon indisponible (null) → 0', async () => {
    const bal = await readBlndBalance('GC43...', { horizonUrl: 'h', getJson: async () => null });
    expect(bal).toBe(0n);
  });
});
