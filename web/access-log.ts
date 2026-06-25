// Nginx COMBINED-format access log helpers — pure, side-effect-free, importable by tests.
// Used by server.ts to emit one stdout line per request for GoAccess parsing.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { clientIp } from './request-ip.js';
import { createWriteStream, statSync, renameSync, type WriteStream } from 'node:fs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Formats a Date as a CLF timestamp: DD/Mon/YYYY:HH:MM:SS +0000 (UTC, fixed offset). */
export function clfTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}:${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
}

/** Builds one nginx COMBINED access-log line for the given request/response.
 *  `path` should be the path without query string (privacy + GoAccess cardinality). */
export function accessLine(req: IncomingMessage, res: ServerResponse, path: string): string {
  const ip = clientIp(req);
  const ua = (req.headers['user-agent'] ?? '').toString().replace(/[\r\n"]/g, ' ').slice(0, 200) || '-';
  const ref = (req.headers['referer'] ?? '-').toString().replace(/[\r\n"]/g, ' ');
  const len = res.getHeader('content-length');
  const bytes = (len === undefined || len === null) ? '-' : String(len);
  const ver = req.httpVersion || '1.1';
  return `${ip} - - [${clfTime(new Date())}] "${req.method ?? '-'} ${path} HTTP/${ver}" ${res.statusCode} ${bytes} "${ref}" "${ua}"\n`;
}

// ─── Optional file tee (opt-in via ACCESS_LOG env var) ───────────────────────
// State is module-level but only written by initAccessFile() which is called
// once from server.ts. The module remains side-effect-free on import.

let _stream: WriteStream | null = null;
let _filePath: string | null = null;
let _maxBytes: number = 50 * 1024 * 1024; // 50 MB default

/**
 * Returns true when the file tee is active (ACCESS_LOG is set and init succeeded).
 * Used by server.ts to decide whether to also write each access line to the file.
 */
export function accessFileActive(): boolean {
  return _stream !== null;
}

/**
 * Writes `line` to the file stream (no-op if the tee is not active).
 * Called from server.ts alongside the stdout write.
 */
export function writeToAccessFile(line: string): void {
  _stream?.write(line);
}

/**
 * Decides whether a rotate is needed given the current file size and the cap.
 * Exported so the unit test can exercise the decision logic without I/O.
 */
export function shouldRotate(sizeBytes: number, maxBytes: number): boolean {
  return sizeBytes > maxBytes;
}

/** Opens (or reopens) the log file stream in append mode. */
function openStream(filePath: string): WriteStream {
  return createWriteStream(filePath, { flags: 'a' });
}

/** One rotation cycle: rename → .1, open a fresh stream. */
function rotate(filePath: string): void {
  const rotated = filePath + '.1';
  if (_stream) {
    _stream.end();
    _stream = null;
  }
  try {
    renameSync(filePath, rotated); // overwrites the previous .1
  } catch {
    // File may not exist yet on the very first rotation — that's fine.
  }
  _stream = openStream(filePath);
}

/**
 * Initialise the optional access-log file tee.
 * Must be called once from server.ts (not at module top-level, so imports stay side-effect-free).
 * If ACCESS_LOG is empty/unset, this is a no-op.
 */
export function initAccessFile(): void {
  const filePath = process.env['ACCESS_LOG'] ?? '';
  if (!filePath) return;

  const maxMb = Number(process.env['ACCESS_LOG_MAX_MB'] ?? '50');
  _maxBytes = (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 50) * 1024 * 1024;
  _filePath = filePath;
  _stream = openStream(filePath);

  // Rotation check every 60 s; .unref() so it never prevents process exit.
  setInterval(() => {
    if (!_stream || !_filePath) return;
    try {
      const size = statSync(_filePath).size;
      if (shouldRotate(size, _maxBytes)) {
        rotate(_filePath);
      }
    } catch {
      // Stat failure (e.g. file deleted externally) — reopen.
      try {
        _stream = openStream(_filePath);
      } catch { /* best-effort */ }
    }
  }, 60_000).unref();
}
