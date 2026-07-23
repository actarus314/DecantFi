import { describe, it, expect } from 'vitest';
import { Asset as SdkAsset, Networks } from '@stellar/stellar-sdk';
import { BLND, USDC, EURC, XLM, classicColon, classicDash, bySymbol } from './assets.js';

describe('assets', () => {
  // Ensures the hardcoded G... issuers do match the expected C... SACs.
  it.each([BLND, USDC, EURC])('$symbol: recomputed issuer -> known SAC', (a) => {
    const computed = new SdkAsset(a.code, a.issuer as string).contractId(Networks.PUBLIC);
    expect(computed).toBe(a.sac);
  });

  it('native XLM: SAC == native contractId', () => {
    expect(SdkAsset.native().contractId(Networks.PUBLIC)).toBe(XLM.sac);
  });

  it('classic colon / dash / native formats', () => {
    expect(classicColon(USDC)).toBe(`USDC:${USDC.issuer}`);
    expect(classicDash(USDC)).toBe(`USDC-${USDC.issuer}`);
    expect(classicColon(XLM)).toBe('native');
    expect(classicDash(XLM)).toBe('native');
  });

  it('bySymbol is case-insensitive', () => {
    expect(bySymbol('blnd')).toBe(BLND);
    expect(bySymbol('USDC')).toBe(USDC);
    expect(bySymbol('XYZ')).toBeUndefined();
  });
});
