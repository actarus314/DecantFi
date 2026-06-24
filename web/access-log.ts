// Nginx COMBINED-format access log helpers — pure, side-effect-free, importable by tests.
// Used by server.ts to emit one stdout line per request for GoAccess parsing.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { clientIp } from './request-ip.js';

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
