// Ops : exécute UN tick réel (réseau live) et l'écrit dans la DB. Pour smoke-test manuel / cron externe.
import { dirname } from 'node:path';
import { fetchPrices } from '../core/prices.js';
import { quote } from '../core/engine.js';
import { loadCollectorConfig } from './config.js';
import { buildProbes } from './probes.js';
import { runTick } from './tick.js';
import { openDb } from '../db/index.js';
import { fromStroops } from '../core/amount.js';
import { ensureDirWritable } from './fsguard.js';

async function main(): Promise<void> {
  const cfg = loadCollectorConfig();
  ensureDirWritable(dirname(cfg.dbPath));
  const db = openDb(cfg.dbPath);
  const { tick, quotes, rpcProbes } = await runTick({
    probes: buildProbes(cfg), cfg, now: () => new Date(), fetchPrices, quote,
  });
  const tickId = db.insertTickWithQuotes(tick, quotes, rpcProbes);
  process.stdout.write(`tick #${tickId} · ok=${tick.ok} · ${quotes.length} quotes\n`);
  for (const q of quotes.filter((x) => x.is_winner)) {
    process.stdout.write(`  ${q.pair} ${fromStroops(q.amount_in)} → ${q.net_out ? fromStroops(q.net_out) : 'n/a'} via ${q.source_id}` +
      `${q.eurc_path ? ` (${q.eurc_path})` : ''}\n`);
  }
  db.close();
}

main().catch((e) => { process.stderr.write(`erreur : ${e instanceof Error ? e.message : e}\n`); process.exit(1); });
