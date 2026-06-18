// Lecture read-only de la balance BLND classique d'un compte via Horizon. Stroops exacts ; 0 si absente.
// Partagé : CLI (--balance) et future UI web. JAMAIS de clé privée.
import { BLND, type Asset } from './assets.js';
import { toStroops } from './amount.js';
import { getJson as defaultGetJson } from './sources/http.js';

interface HorizonBalance {
  balance?: string;
  asset_code?: string;
  asset_issuer?: string;
  asset_type?: string;
}
interface HorizonAccount {
  balances?: HorizonBalance[];
}

/** Extrait la balance BLND (code+issuer connus) en stroops. 0 si absente / réponse inattendue. */
export function parseBlndBalance(raw: unknown): bigint {
  const balances = (raw as HorizonAccount | null)?.balances;
  if (!Array.isArray(balances)) return 0n;
  const b = balances.find((x) => x.asset_code === BLND.code && x.asset_issuer === BLND.issuer);
  if (!b || typeof b.balance !== 'string') return 0n;
  try {
    return toStroops(b.balance);
  } catch {
    return 0n;
  }
}

export interface BalanceDeps {
  horizonUrl: string;
  timeoutMs?: number;
  getJson?: (url: string, timeoutMs?: number) => Promise<unknown | null>;
}

/** Lit la balance BLND live de `address` via Horizon. Tolérant : Horizon KO → 0. */
export async function readBlndBalance(address: string, deps: BalanceDeps): Promise<bigint> {
  const getJson = deps.getJson ?? defaultGetJson;
  const base = (deps.horizonUrl || 'https://horizon.stellar.org').replace(/\/$/, '');
  const raw = await getJson(`${base}/accounts/${address}`, deps.timeoutMs);
  return parseBlndBalance(raw);
}

/**
 * Extrait la balance d'un actif classique (USDC/EURC) en unités (number).
 * 0 si la trustline est absente ou si la réponse Horizon est inattendue.
 */
export function parseAssetBalance(raw: unknown, asset: Asset): number {
  const balances = (raw as HorizonAccount | null)?.balances;
  if (!Array.isArray(balances)) return 0;
  const b = balances.find((x) => x.asset_code === asset.code && x.asset_issuer === asset.issuer);
  if (!b || typeof b.balance !== 'string') return 0;
  const n = Number(b.balance);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lit la balance d'un actif classique live de `address` via Horizon.
 * **Distingue échec de lecture (→ null) de trustline absente (→ 0)** : sinon un delta « reçu »
 * post-swap serait calculé contre 0 (= solde total, faux). Le client traite null = « lecture KO ».
 */
export async function readAssetBalance(address: string, asset: Asset, deps: BalanceDeps): Promise<number | null> {
  const getJson = deps.getJson ?? defaultGetJson;
  const base = (deps.horizonUrl || 'https://horizon.stellar.org').replace(/\/$/, '');
  const raw = await getJson(`${base}/accounts/${address}`, deps.timeoutMs);
  if (raw == null) return null; // Horizon KO → null (≠ 0 = trustline absente)
  return parseAssetBalance(raw, asset);
}
