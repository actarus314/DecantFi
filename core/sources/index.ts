// Registre des sources de cotation (meta-agregateur). Interrogees en parallele, tolerantes aux pannes.
import type { SourceAdapter } from './types.js';
import { xbull } from './xbull.js';
import { soroswap } from './soroswap.js';
import { aquarius } from './aquarius.js';
import { comet } from './comet.js';
import { ultrastellar } from './ultrastellar.js';
import { stellarbroker } from './stellarbroker.js';
import { horizon } from './horizon.js';
import { phoenix } from './phoenix.js';

export const ADAPTERS: SourceAdapter[] = [
  xbull,
  soroswap,
  aquarius,
  comet,
  ultrastellar,
  // stellarbroker — WS-authenticated (cfg.stellarBrokerApiKey required; available() gates activation).
  // Classified on the estimate; floor (directTrade.buying) exposed in UI. Non-executable (quote-only).
  stellarbroker,
  horizon,
  // phoenix — NOT ACTIVE: Phoenix has no BLND pool on mainnet, so it's inert for DecantFi's
  // current BLND→USDC/EURC pairs (supports() returns false → never quoted, no Stability-page noise).
  // The adapter is written + tested, ready to activate (uncomment) when DecantFi covers pairs Phoenix
  // serves (XLM/USDC, XLM/EURC, …) — e.g. for cross-checking that an aggregator routing through
  // Phoenix isn't skimming on top of Phoenix's own fee.
  // phoenix,
];

/** IDs of the currently active adapters — single source of truth for "which venues exist now".
 *  The Stability page derives its venue list from this, so a disconnected venue (e.g. StellarBroker,
 *  pending its API key) drops off automatically and reappears when re-added to ADAPTERS. */
export const ACTIVE_SOURCE_IDS = ADAPTERS.map((a) => a.id);

export { xbull, soroswap, aquarius, comet, ultrastellar, stellarbroker, horizon, phoenix };
export type { SourceAdapter };
