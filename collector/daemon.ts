// Collector entrypoint. Write probe at boot (loud failure, anti-dEURO), DB init, jittered tick loop
// + daily maintenance, heartbeat on every successful tick, clean SIGTERM/SIGINT shutdown.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fetchPrices } from '../core/prices.js';
import { quote } from '../core/engine.js';
import { loadCollectorConfig } from './config.js';
import { buildProbes } from './probes.js';
import { runTick, failedTick } from './tick.js';
import { runMaintenance } from './maintenance.js';
import { runCoherenceProbes } from './coherence.js';
import { jitteredDelayMs, runLoop, interruptibleSleep } from './scheduler.js';
import { ensureDirWritable } from './fsguard.js';
import { openDb } from '../db/index.js';
import { withTimeout } from '../core/timeout.js';

/** Boot probe: is the DB directory writable? Failure → explicit log + exit(1) (never silent, anti-dEURO). */
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
  const nextTickFile = join(dirname(cfg.dbPath), '.next_tick'); // forecast of when the next reading will be ready, read by the web
  writeFileSync(heartbeat, new Date().toISOString()); // boot heartbeat: healthy healthcheck before the 1st tick
  let lastMaintenanceDay = '';
  let lastTickDurationMs = 0; // duration of the last tick (started→finished), used to forecast when data will be ready
  let stopping = false;
  const abort = new AbortController(); // wakes the sleep on shutdown → immediate clean stop

  // Hard per-tick cap: a hung RPC re-sim must never freeze the loop (no tick → no exit → no Docker
  // restart). Stays well under the cadence so the next scheduled tick is never delayed.
  const TICK_TIMEOUT_MS = Math.max(60_000, Math.min(cfg.cadenceSec * 1000 - 30_000, 180_000));

  const tickAndStore = async (): Promise<void> => {
    const startedAt = new Date();
    try {
      const { tick, quotes, rpcProbes } = await withTimeout(
        runTick({ probes, cfg, now: () => new Date(), fetchPrices, quote }),
        TICK_TIMEOUT_MS, 'collector tick',
      );
      if (tick.finished_at) {
        lastTickDurationMs = new Date(tick.finished_at).getTime() - new Date(tick.started_at).getTime();
      }
      db.insertTickWithQuotes(tick, quotes, rpcProbes);
      const purged = db.purgeManualTicks(); // the scheduled poll takes priority: discard provisional manual refreshes
      writeFileSync(heartbeat, new Date().toISOString());
      process.stdout.write(`[tick] ${tick.started_at} ok=${tick.ok} quotes=${quotes.length}` +
        `${purged ? ` purged=${purged}` : ''}${tick.source_errors ? ` errors=${tick.source_errors}` : ''}\n`);
    } catch (e) {
      // Unexpected exception: still record a tick ok=0 (visible gap, spec §7); the loop continues.
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[tick] échec : ${msg}\n`);
      try {
        db.insertTickWithQuotes(failedTick(cfg, startedAt, new Date(), msg), [], []);
      } catch (e2) {
        process.stderr.write(`[tick] insert ok=0 impossible : ${e2 instanceof Error ? e2.message : e2}\n`);
      }
    }
    // Maintenance once per day (UTC).
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
    // Coherence probes: 1×/day per venue, randomly spread, best-effort.
    try {
      await runCoherenceProbes(db, cfg, new Date());
    } catch (e) {
      process.stderr.write(`[coherence] échec : ${e instanceof Error ? e.message : e}\n`);
    }
  };

  const shutdown = (): void => { stopping = true; abort.abort(); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.stdout.write(`[daemon] démarré · cadence=${cfg.cadenceSec}s · sondes=${probes.length} · db=${cfg.dbPath}\n`);
  // Tick at boot BEFORE the loop (runLoop sleeps first): otherwise no reading for ~1 cadence (15 min)
  // after every (re)start → countdown stuck on "imminent", pulsing dot missing, stale data.
  if (!stopping) await tickAndStore();
  await runLoop({
    delayMs: () => {
      const ms = jitteredDelayMs(cfg.cadenceSec, cfg.jitterSec);
      try {
        // Publishes when the next reading will be READY (wake-up + typical tick duration).
        writeFileSync(nextTickFile, new Date(Date.now() + ms + lastTickDurationMs).toISOString());
      } catch { /* best-effort, like the heartbeat */ }
      return ms;
    },
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
