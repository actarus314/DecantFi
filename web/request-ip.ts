// Client IP extraction — opt-in proxy trust via TRUST_PROXY env.
// Read once at module load; never re-read per request.
import type { IncomingMessage } from 'node:http';

// ponytail: deliberate boot-time const — avoids per-request env reads.
export const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY ?? '');

/** Extracts the real client IP from a request.
 *  @param trustProxy defaults to TRUST_PROXY boot const; injectable for tests.
 *
 *  When TRUST_PROXY is on:
 *   - prefer X-Real-IP (set by nginx/reverse-proxy)
 *   - else take the RIGHTMOST element of X-Forwarded-For (the proxy-appended peer,
 *     not the first which an attacker can spoof)
 *   - else fall back to socket.remoteAddress
 *
 *  When TRUST_PROXY is off (default): use socket.remoteAddress directly.
 */
export function clientIp(req: IncomingMessage, trustProxy = TRUST_PROXY): string {
  if (trustProxy) {
    const realIp = firstHeader(req.headers['x-real-ip']);
    if (realIp) return realIp;

    const forwarded = firstHeader(req.headers['x-forwarded-for']);
    if (forwarded) {
      // Take the LAST (rightmost) element — appended by the trusted reverse proxy.
      // The first element can be spoofed by the client.
      const last = forwarded.split(',').at(-1)?.trim();
      if (last) return last;
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Normalises a header value that may be string | string[] | undefined → trimmed string or null. */
function firstHeader(h: string | string[] | undefined): string | null {
  if (!h) return null;
  const raw = Array.isArray(h) ? h[0] : h;
  if (!raw) return null;
  const t = raw.trim();
  return t || null;
}
