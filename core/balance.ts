// Read-only read of an account's classic BLND balance via Horizon. Exact stroops; 0 if absent.
// Shared: CLI (--balance) and future web UI. NEVER a private key.
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

/** Extracts the BLND balance (known code+issuer) in stroops. 0 if absent / unexpected response. */
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

/** Reads `address`'s live BLND balance via Horizon. Tolerant: Horizon down -> 0. */
export async function readBlndBalance(address: string, deps: BalanceDeps): Promise<bigint> {
  const getJson = deps.getJson ?? defaultGetJson;
  const base = (deps.horizonUrl || 'https://horizon.stellar.org').replace(/\/$/, '');
  const raw = await getJson(`${base}/accounts/${address}`, deps.timeoutMs);
  return parseBlndBalance(raw);
}

/**
 * Extracts a classic asset's balance (USDC/EURC) in units (number).
 * 0 if the trustline is absent or the Horizon response is unexpected.
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
 * Reads `address`'s live classic asset balance via Horizon.
 * **Distinguishes a read failure (-> null) from an absent trustline (-> 0)**: otherwise a post-swap
 * "received" delta would be computed against 0 (= full balance, wrong). The caller treats null as "read failed".
 */
export async function readAssetBalance(address: string, asset: Asset, deps: BalanceDeps): Promise<number | null> {
  const getJson = deps.getJson ?? defaultGetJson;
  const base = (deps.horizonUrl || 'https://horizon.stellar.org').replace(/\/$/, '');
  const raw = await getJson(`${base}/accounts/${address}`, deps.timeoutMs);
  if (raw == null) return null; // Horizon down -> null (!= 0 = absent trustline)
  return parseAssetBalance(raw, asset);
}
