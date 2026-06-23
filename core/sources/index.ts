// Registre des sources de cotation (meta-agregateur). Interrogees en parallele, tolerantes aux pannes.
import type { SourceAdapter } from './types.js';
import { xbull } from './xbull.js';
import { soroswap } from './soroswap.js';
import { aquarius } from './aquarius.js';
import { comet } from './comet.js';
import { ultrastellar } from './ultrastellar.js';
import { stellarbroker } from './stellarbroker.js';
import { horizon } from './horizon.js';

export const ADAPTERS: SourceAdapter[] = [
  xbull,
  soroswap,
  aquarius,
  comet,
  ultrastellar,
  // stellarbroker — DISCONNECTED 2026-06-22: keyless endpoint is Cloudflare-rate-limited / IP-blocked
  // under collector polling (sustained 4xx). Re-enable via the key-based path once STELLARBROKER_API_KEY
  // is wired — see TODO in stellarbroker.ts.
  horizon,
];

/** IDs of the currently active adapters — single source of truth for "which venues exist now".
 *  The Stability page derives its venue list from this, so a disconnected venue (e.g. StellarBroker,
 *  pending its API key) drops off automatically and reappears when re-added to ADAPTERS. */
export const ACTIVE_SOURCE_IDS = ADAPTERS.map((a) => a.id);

export { xbull, soroswap, aquarius, comet, ultrastellar, stellarbroker, horizon };
export type { SourceAdapter };
