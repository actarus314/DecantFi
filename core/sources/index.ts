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

export { xbull, soroswap, aquarius, comet, ultrastellar, stellarbroker, horizon };
export type { SourceAdapter };
