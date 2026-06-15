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
  stellarbroker,
  horizon,
];

export { xbull, soroswap, aquarius, comet, ultrastellar, stellarbroker, horizon };
export type { SourceAdapter };
