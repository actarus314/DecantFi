import { describe, it, expect } from 'vitest';
import { Asset as SdkAsset, Networks } from '@stellar/stellar-sdk';
import { BLND, USDC, EURC, XLM, classicColon, classicDash, bySymbol } from './assets.js';

describe('assets', () => {
  // Garantit que les emetteurs G... codes en dur correspondent bien aux SAC C... attendus.
  it.each([BLND, USDC, EURC])('$symbol : issuer recalcule -> SAC connu', (a) => {
    const computed = new SdkAsset(a.code, a.issuer as string).contractId(Networks.PUBLIC);
    expect(computed).toBe(a.sac);
  });

  it('XLM natif : SAC == contractId du natif', () => {
    expect(SdkAsset.native().contractId(Networks.PUBLIC)).toBe(XLM.sac);
  });

  it('formats classiques colon / dash / native', () => {
    expect(classicColon(USDC)).toBe(`USDC:${USDC.issuer}`);
    expect(classicDash(USDC)).toBe(`USDC-${USDC.issuer}`);
    expect(classicColon(XLM)).toBe('native');
    expect(classicDash(XLM)).toBe('native');
  });

  it('bySymbol insensible a la casse', () => {
    expect(bySymbol('blnd')).toBe(BLND);
    expect(bySymbol('USDC')).toBe(USDC);
    expect(bySymbol('XYZ')).toBeUndefined();
  });
});
