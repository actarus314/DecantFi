// Manual refresh: runs ONE real tick (live network) and logs it with note='manual'.
// Temporary — the next scheduled collector poll purges it (db.purgeManualTicks).
// Ephemeral write connection (open/insert/close): the stats read path keeps its query_only connection.
// ponytail: in-flight guard = 1 refresh at a time; spam-clicks rejected (429) rather than hammering the network.
import { fetchPrices } from '../core/prices.js';
import { quote } from '../core/engine.js';
import { buildProbes } from '../collector/probes.js';
import { runTick } from '../collector/tick.js';
import { openDb } from '../db/index.js';
import type { WebConfig } from './config.js';

let inFlight = false;

export interface RefreshResult {
  tickId: number;
  ok: boolean;
  quotes: number;
  startedAt: string;
}

/** true if a refresh is already in progress (the server responds 429). */
export function refreshBusy(): boolean {
  return inFlight;
}

export async function manualRefresh(cfg: WebConfig): Promise<RefreshResult> {
  inFlight = true;
  try {
    const probes = buildProbes(cfg);
    const { tick, quotes, rpcProbes } = await runTick({
      probes, cfg, now: () => new Date(), fetchPrices, quote,
    });
    tick.note = 'manual'; // marker for purge by the scheduled poll
    const db = openDb(cfg.dbPath); // write connection (RW volume); closed immediately
    try {
      const tickId = db.insertTickWithQuotes(tick, quotes, rpcProbes);
      return { tickId, ok: tick.ok, quotes: quotes.length, startedAt: tick.started_at };
    } finally {
      db.close();
    }
  } finally {
    inFlight = false;
  }
}
