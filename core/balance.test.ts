import { describe, it, expect } from 'vitest';
import { parseBlndBalance, readBlndBalance, parseAssetBalance, readAssetBalance } from './balance.js';
import { toStroops } from './amount.js';
import { USDC, EURC } from './assets.js';

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

describe('parseAssetBalance', () => {
  it('extrait la balance USDC en unités (number, pas stroops)', () => {
    const raw = {
      balances: [
        { balance: '123.4500000', asset_code: 'USDC', asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
        { balance: '5.0000000', asset_type: 'native' },
      ],
    };
    expect(parseAssetBalance(raw, USDC)).toBe(123.45);
  });
  it('trustline absente → 0', () => {
    const raw = { balances: [{ balance: '5.0', asset_type: 'native' }] };
    expect(parseAssetBalance(raw, USDC)).toBe(0);
  });
  it('réponse inattendue → 0', () => {
    expect(parseAssetBalance(null, USDC)).toBe(0);
    expect(parseAssetBalance({}, EURC)).toBe(0);
  });
  it('discriminant unités : 123.45 ≠ 1234500000 (pas des stroops)', () => {
    const raw = { balances: [{ balance: '123.45', asset_code: 'USDC', asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' }] };
    const result = parseAssetBalance(raw, USDC);
    expect(result).toBe(123.45);
    expect(result).not.toBe(1234500000);
  });
});

describe('readAssetBalance', () => {
  it('appelle Horizon /accounts/{addr} et retourne le solde USDC en unités', async () => {
    const getJson = async () => ({
      balances: [
        { balance: '42.0000000', asset_code: 'USDC', asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' },
      ],
    });
    const bal = await readAssetBalance('GC43VW7DGJREUMJWMHJZOAWWWQ374ZKCFS2GKGRMNAIXSNV53WIBY5AA', USDC, {
      horizonUrl: 'https://horizon.stellar.org', getJson,
    });
    expect(bal).toBe(42);
  });
  it('Horizon indisponible (null) → 0', async () => {
    const bal = await readAssetBalance('GC43...', USDC, { horizonUrl: 'h', getJson: async () => null });
    expect(bal).toBe(0);
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
