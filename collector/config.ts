// Charge + valide la config du collecteur depuis l'environnement. Lance sur valeur invalide (fail fast).
import { toStroops } from '../core/amount.js';

export interface CollectorConfig {
  cadenceSec: number; jitterSec: number;
  sizesBlnd: bigint[]; pairs: ('USDC' | 'EURC')[];
  dbPath: string; timeoutMs: number;
  rawRetentionDays: number; rollupAfterDays: number;
  rpcUrl: string; rpcUrls: string[]; horizonUrl: string; soroswapApiKey?: string; walletAddress?: string;
}

type Env = Record<string, string | undefined>;

function int(env: Env, key: string, def: number): number {
  const v = env[key];
  if (v === undefined || v.trim() === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${key} invalide : ${v}`);
  return n;
}

export function loadCollectorConfig(env: Env = process.env): CollectorConfig {
  const sizes = (env.COLLECTOR_SIZES_BLND ?? '250,750')
    .split(',').map((s) => s.trim()).filter(Boolean).map((s) => toStroops(s));
  if (sizes.length === 0) throw new Error('COLLECTOR_SIZES_BLND vide');

  const pairs = (env.COLLECTOR_PAIRS ?? 'USDC,EURC')
    .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  for (const p of pairs) if (p !== 'USDC' && p !== 'EURC') throw new Error(`paire inconnue : ${p}`);

  return {
    cadenceSec: int(env, 'COLLECTOR_CADENCE_SEC', 900),
    jitterSec: int(env, 'COLLECTOR_JITTER_SEC', 60),
    sizesBlnd: sizes,
    pairs: pairs as ('USDC' | 'EURC')[],
    dbPath: env.COLLECTOR_DB_PATH ?? './data/quotes.db',
    timeoutMs: int(env, 'COLLECTOR_TIMEOUT_MS', 15000),
    rawRetentionDays: int(env, 'RAW_RETENTION_DAYS', 90),
    rollupAfterDays: int(env, 'ROLLUP_AFTER_DAYS', 365),
    rpcUrl: env.STELLAR_RPC_URL || 'https://mainnet.sorobanrpc.com',
    rpcUrls: (() => {
      const primary = env.STELLAR_RPC_URL || 'https://mainnet.sorobanrpc.com';
      const fallback = env.STELLAR_RPC_URL_FALLBACK;
      return fallback && fallback !== primary ? [primary, fallback] : [primary];
    })(),
    horizonUrl: env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org',
    soroswapApiKey: env.SOROSWAP_API_KEY || undefined,
  };
}
