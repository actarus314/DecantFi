// Shared .env loader for CLI tools. Loads repo/.env if direnv has not already set the vars.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Loads repo/.env into process.env (skips already-set vars). Non-fatal if .env is absent. */
export function loadEnv(): void {
  try {
    const txt = readFileSync(fileURLToPath(new URL('../.env', import.meta.url)), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = (m[2] ?? '').replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env: keep public defaults */
  }
}
