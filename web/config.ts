// Config du serveur web : réutilise loadCollectorConfig + ajoute WEB_PORT.
import { loadCollectorConfig, type CollectorConfig } from '../collector/config.js';

export interface WebConfig extends CollectorConfig {
  port: number;
}

function intEnv(env: Record<string, string | undefined>, key: string, def: number): number {
  const v = env[key];
  if (v === undefined || v.trim() === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${key} invalide : ${v}`);
  return n;
}

export function loadWebConfig(env: Record<string, string | undefined> = process.env): WebConfig {
  const base = loadCollectorConfig(env);
  return {
    ...base,
    port: intEnv(env, 'WEB_PORT', 8080),
  };
}
