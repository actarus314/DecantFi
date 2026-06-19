// Refresh manuel : exécute UN tick réel (réseau live) et le journalise avec note='manual'.
// Provisoire — le prochain poll programmé du collecteur le purge (db.purgeManualTicks).
// Connexion d'écriture éphémère (ouvre/insère/ferme) : la lecture stats garde sa connexion query_only.
// ponytail: garde in-flight = 1 refresh à la fois ; spam-clics rejetés (429) plutôt que de marteler le réseau.
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

/** true si un refresh est déjà en cours (le serveur répond 429). */
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
    tick.note = 'manual'; // marqueur de purge par le poll programmé
    const db = openDb(cfg.dbPath); // connexion d'écriture (volume RW) ; refermée aussitôt
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
