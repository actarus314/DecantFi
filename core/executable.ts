// Single source of truth for executable quote sources (used by both core and web).
// A source is executable if it supports one-click swap submission in this app.
// ponytail: 'stellarbroker' is intentionally absent — add it once its execution is wired.
export const EXECUTABLE_SOURCES = [
  'xbull',
  'soroswap',
  'horizon',
  'aquarius',
  'comet',
  'ultrastellar',
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
