// Entrypoint du collecteur. Sonde d'écriture au boot (échec bruyant anti-dEURO), init DB, boucle de ticks
// jittée + maintenance quotidienne, heartbeat à chaque tick réussi, arrêt propre SIGTERM/SIGINT.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fetchPrices } from '../core/prices.js';
import { quote } from '../core/engine.js';
import { loadCollectorConfig } from './config.js';
import { buildProbes } from './probes.js';
import { runTick, failedTick } from './tick.js';
import { runMaintenance } from './maintenance.js';
import { jitteredDelayMs, runLoop, interruptibleSleep } from './scheduler.js';
import { ensureDirWritable } from './fsguard.js';
import { openDb } from '../db/index.js';

/** Sonde au boot : dossier DB inscriptible ? Échec → log explicite + exit(1) (jamais silencieux, anti-dEURO). */
function assertDataDirWritable(dbPath: string): void {
  try {
    ensureDirWritable(dirname(dbPath));
  } catch (e) {
    process.stderr.write(`SQLITE_DATA_DIR_NOT_WRITABLE: ${dirname(dbPath)} — ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const cfg = loadCollectorConfig();
  assertDataDirWritable(cfg.dbPath);

  const db = openDb(cfg.dbPath);
  const probes = buildProbes(cfg);
  const heartbeat = join(dirname(cfg.dbPath), '.heartbeat');
  writeFileSync(heartbeat, new Date().toISOString()); // heartbeat de boot : healthcheck sain avant le 1er tick
  let lastMaintenanceDay = '';
  let stopping = false;
  const abort = new AbortController(); // réveille le sleep à l'arrêt → arrêt propre immédiat

  const tickAndStore = async (): Promise<void> => {
    const startedAt = new Date();
    try {
      const { tick, quotes } = await runTick({ probes, cfg, now: () => new Date(), fetchPrices, quote });
      db.insertTickWithQuotes(tick, quotes);
      writeFileSync(heartbeat, new Date().toISOString());
      process.stdout.write(`[tick] ${tick.started_at} ok=${tick.ok} quotes=${quotes.length}` +
        `${tick.source_errors ? ` errors=${tick.source_errors}` : ''}\n`);
    } catch (e) {
      // Exception inattendue : on enregistre quand même un tick ok=0 (trou visible, spec §7) ; la boucle continue.
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[tick] échec : ${msg}\n`);
      try {
        db.insertTickWithQuotes(failedTick(cfg, startedAt, new Date(), msg), []);
      } catch (e2) {
        process.stderr.write(`[tick] insert ok=0 impossible : ${e2 instanceof Error ? e2.message : e2}\n`);
      }
    }
    // Maintenance une fois par jour (UTC).
    const day = new Date().toISOString().slice(0, 10);
    if (day !== lastMaintenanceDay) {
      lastMaintenanceDay = day;
      try {
        runMaintenance(db, cfg, new Date());
        process.stdout.write(`[maintenance] ${day} ok\n`);
      } catch (e) {
        process.stderr.write(`[maintenance] échec : ${e instanceof Error ? e.message : e}\n`);
      }
    }
  };

  const shutdown = (): void => { stopping = true; abort.abort(); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.stdout.write(`[daemon] démarré · cadence=${cfg.cadenceSec}s · sondes=${probes.length} · db=${cfg.dbPath}\n`);
  await runLoop({
    delayMs: () => jitteredDelayMs(cfg.cadenceSec, cfg.jitterSec),
    sleep: (ms) => interruptibleSleep(ms, abort.signal),
    onTick: tickAndStore,
    shouldStop: () => stopping,
  });
  db.close();
  process.stdout.write('[daemon] arrêt propre\n');
}

main().catch((e) => {
  process.stderr.write(`[daemon] fatal : ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
