#!/usr/bin/env -S npx tsx
// Journal du collecteur. `npm run history [-- --limit 20]` (table) ; `npm run export [-- json|csv]`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from '../db/index.js';
import { history, exportRows } from '../db/queries.js';
import { loadCollectorConfig } from '../collector/config.js';

function loadEnv(): void {
  try {
    const txt = readFileSync(fileURLToPath(new URL('../.env', import.meta.url)), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = (m[2] ?? '').replace(/^["']|["']$/g, '');
    }
  } catch { /* defauts publics */ }
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const fmt = (cells: string[]) => cells.map((c, i) => (i <= 1 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');
  return [fmt(headers), ...rows.map(fmt)].join('\n');
}

function main(): void {
  loadEnv();
  const argv = process.argv.slice(2);
  const cfg = loadCollectorConfig();
  const db = openDb(cfg.dbPath);

  if (argv[0] === 'export') {
    const format = argv[1] === 'csv' ? 'csv' : 'json';
    process.stdout.write(exportRows(db, format));
    db.close();
    return;
  }

  const li = argv.indexOf('--limit');
  const limit = li >= 0 ? Number(argv[li + 1]) : 50;
  const rows = history(db, { limit: Number.isFinite(limit) ? limit : 50 });
  if (rows.length === 0) process.stdout.write('Journal vide (aucun tick enregistré).\n');
  else {
    process.stdout.write(table(
      ['date (UTC)', 'paire', 'taille', 'net', 'source', 'impact', 'voie'],
      rows.map((r) => [r.started_at, r.pair, r.amount_in, r.net_out ?? 'n/a', r.source_id,
        r.price_impact_pct === null ? '—' : `${r.price_impact_pct.toFixed(2)}%`, r.eurc_path ?? '']),
    ) + '\n');
  }
  db.close();
}

main();
