// Asset table. G... issuers verified on-chain:
// each issuer recomputes via Asset(code, issuer).contractId(PUBLIC) == the known SAC (see assets.test.ts).
//
// Expected formats by source:
//   - xBull, Aquarius, Soroswap, Comet  -> SAC (C...)
//   - StellarBroker                     -> CODE-ISSUER  (dash) or 'native' (XLM)
//   - Horizon strict-send               -> asset_type + code/issuer (or 'native')

export interface Asset {
  /** Display symbol. */
  symbol: string;
  /** Classic Stellar code ('XLM' for native). */
  code: string;
  /** G... issuer; null for native XLM. */
  issuer: string | null;
  /** Soroban Asset Contract (C...). */
  sac: string;
  /** Decimals (7 on Stellar). */
  decimals: number;
  /** true for the native XLM asset. */
  native?: boolean;
}

export const BLND: Asset = {
  symbol: 'BLND',
  code: 'BLND',
  issuer: 'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY',
  sac: 'CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY',
  decimals: 7,
};

export const USDC: Asset = {
  symbol: 'USDC',
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  sac: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  decimals: 7,
};

export const EURC: Asset = {
  symbol: 'EURC',
  code: 'EURC',
  issuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
  sac: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV',
  decimals: 7,
};

/** Native XLM: used for gas conversion. */
export const XLM: Asset = {
  symbol: 'XLM',
  code: 'XLM',
  issuer: null,
  sac: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
  decimals: 7,
  native: true,
};

/** AQUA (Aquarius) — xBull routing intermediary; display resolution only, not a swap target. */
export const AQUA: Asset = {
  symbol: 'AQUA',
  code: 'AQUA',
  issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
  sac: 'CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK',
  decimals: 7,
};

export const ASSETS: Asset[] = [BLND, USDC, EURC, XLM, AQUA];

/** First-rank swap targets (USDC and EURC). */
export const TARGETS: Record<'USDC' | 'EURC', Asset> = { USDC, EURC };

export function bySymbol(symbol: string): Asset | undefined {
  return ASSETS.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
}

/** Looks up a known asset by its SAC (C...). */
export function bySac(sac: string): Asset | undefined {
  return ASSETS.find((a) => a.sac === sac);
}

/** 'CODE:ISSUER' (Horizon, StellarBroker colon variant); 'native' for XLM. */
export function classicColon(a: Asset): string {
  return a.native ? 'native' : `${a.code}:${a.issuer}`;
}

/** 'CODE-ISSUER' (StellarBroker); 'native' for XLM. */
export function classicDash(a: Asset): string {
  return a.native ? 'native' : `${a.code}-${a.issuer}`;
}
