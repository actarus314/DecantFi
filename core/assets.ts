// Table des actifs. Emetteurs G... verifies on-chain le 2026-06-15 :
// chaque issuer recalcule via Asset(code, issuer).contractId(PUBLIC) == le SAC connu (cf. assets.test.ts).
//
// Formats attendus selon la source :
//   - xBull, Aquarius, Soroswap, Comet  -> SAC (C...)
//   - StellarBroker                     -> CODE-ISSUER  (tiret) ou 'native' (XLM)
//   - Horizon strict-send               -> asset_type + code/issuer (ou 'native')

export interface Asset {
  /** Symbole affiche. */
  symbol: string;
  /** Code classique Stellar ('XLM' pour le natif). */
  code: string;
  /** Emetteur G... ; null pour XLM natif. */
  issuer: string | null;
  /** Soroban Asset Contract (C...). */
  sac: string;
  /** Decimales (7 sur Stellar). */
  decimals: number;
  /** true pour l'actif natif XLM. */
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

/** XLM natif : utilise pour la conversion du gas. */
export const XLM: Asset = {
  symbol: 'XLM',
  code: 'XLM',
  issuer: null,
  sac: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
  decimals: 7,
  native: true,
};

export const ASSETS: Asset[] = [BLND, USDC, EURC, XLM];

/** Cibles de swap de premier rang (USDC et EURC). */
export const TARGETS: Record<'USDC' | 'EURC', Asset> = { USDC, EURC };

export function bySymbol(symbol: string): Asset | undefined {
  return ASSETS.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
}

/** Retrouve un actif connu par son SAC (C...). */
export function bySac(sac: string): Asset | undefined {
  return ASSETS.find((a) => a.sac === sac);
}

/** 'CODE:ISSUER' (Horizon, StellarBroker variante deux-points) ; 'native' pour XLM. */
export function classicColon(a: Asset): string {
  return a.native ? 'native' : `${a.code}:${a.issuer}`;
}

/** 'CODE-ISSUER' (StellarBroker) ; 'native' pour XLM. */
export function classicDash(a: Asset): string {
  return a.native ? 'native' : `${a.code}-${a.issuer}`;
}
