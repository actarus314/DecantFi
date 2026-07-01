// Single source of truth for executable quote sources (used by both core and web).
// A source is executable if it supports one-click swap submission in this app.
// ponytail: 'stellarbroker' is wired for direct Mediator execution (client-side WS + ephemeral key);
// it is NOT a valid server venue (/api/build rejects it) — doExecute short-circuits SB to the Mediator.
export const EXECUTABLE_SOURCES = [
  'xbull',
  'soroswap',
  'horizon',
  'aquarius',
  'comet',
  'ultrastellar',
  'stellarbroker',
] as const;

/**
 * Returns true iff `source` is a single, directly executable venue.
 * Composite rows (e.g. "xbull+soroswap") are never one-click executable.
 * Whitespace is trimmed before matching.
 */
export function isExecutableSource(source: string): boolean {
  const trimmed = source.trim();
  return !trimmed.includes('+') && (EXECUTABLE_SOURCES as readonly string[]).includes(trimmed);
}
