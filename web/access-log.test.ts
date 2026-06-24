import { describe, it, expect } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { clfTime, accessLine } from './access-log.js';

// ─── clfTime ────────────────────────────────────────────────────────────────

describe('clfTime', () => {
  it('formats a known UTC date correctly', () => {
    const d = new Date('2026-03-07T15:04:09Z');
    expect(clfTime(d)).toBe('07/Mar/2026:15:04:09 +0000');
  });

  it('zero-pads single-digit day, hour, minute, second', () => {
    const d = new Date('2026-01-02T03:04:05Z');
    expect(clfTime(d)).toBe('02/Jan/2026:03:04:05 +0000');
  });

  it('uses correct month abbreviations at boundaries', () => {
    const jan = new Date('2026-01-31T00:00:00Z');
    const dec = new Date('2026-12-31T23:59:59Z');
    expect(clfTime(jan)).toMatch(/31\/Jan\/2026/);
    expect(clfTime(dec)).toMatch(/31\/Dec\/2026/);
  });
});

// ─── accessLine ─────────────────────────────────────────────────────────────

/** Minimal IncomingMessage stub. */
function makeReq(opts: {
  method?: string;
  httpVersion?: string;
  remoteAddress?: string;
  headers?: Record<string, string | string[]>;
}): IncomingMessage {
  return {
    method: opts.method ?? 'GET',
    httpVersion: opts.httpVersion ?? '1.1',
    socket: { remoteAddress: opts.remoteAddress ?? '1.2.3.4' },
    headers: opts.headers ?? {},
  } as unknown as IncomingMessage;
}

/** Minimal ServerResponse stub. */
function makeRes(statusCode: number, contentLength?: number): ServerResponse {
  const headers: Record<string, string | number> = {};
  if (contentLength !== undefined) headers['content-length'] = contentLength;
  return {
    statusCode,
    getHeader: (name: string) => headers[name.toLowerCase()],
  } as unknown as ServerResponse;
}

describe('accessLine', () => {
  const COMBINED = /^\S+ - - \[.+\] "\S+ \S+ HTTP\/\S+" \d{3} (\d+|-) ".*" ".*"\n$/;

  it('(a) matches nginx COMBINED shape for a plain GET', () => {
    const req = makeReq({ headers: { 'user-agent': 'Mozilla/5.0', 'referer': 'https://example.com/' } });
    const res = makeRes(200, 1234);
    expect(accessLine(req, res, '/api/overview')).toMatch(COMBINED);
  });

  it('(b) includes correct status code and byte count', () => {
    const req = makeReq({});
    const res = makeRes(404, 42);
    const line = accessLine(req, res, '/missing');
    expect(line).toContain('" 404 42 ');
  });

  it('(c) bytes is "-" when content-length header is absent', () => {
    const req = makeReq({});
    const res = makeRes(500);
    const line = accessLine(req, res, '/');
    expect(line).toContain('" 500 - ');
  });

  it('(d) uses the path argument (no query string)', () => {
    const req = makeReq({});
    const res = makeRes(200, 0);
    const line = accessLine(req, res, '/api/quote');
    expect(line).toContain('"GET /api/quote HTTP/1.1"');
  });

  it('(e) uses remote address from socket (TRUST_PROXY off)', () => {
    const req = makeReq({ remoteAddress: '203.0.113.7' });
    const res = makeRes(200, 0);
    const line = accessLine(req, res, '/');
    expect(line.startsWith('203.0.113.7 - - [')).toBe(true);
  });

  it('(f) user-agent and referer appear quoted in the line', () => {
    const req = makeReq({ headers: { 'user-agent': 'GoAccess/1.9', 'referer': 'https://decant.fi/' } });
    const res = makeRes(200, 10);
    const line = accessLine(req, res, '/');
    expect(line).toContain('"https://decant.fi/"');
    expect(line).toContain('"GoAccess/1.9"');
  });

  it('(g) absent referer defaults to "-"', () => {
    const req = makeReq({ headers: { 'user-agent': 'curl/8.0' } });
    const res = makeRes(200, 0);
    const line = accessLine(req, res, '/');
    expect(line).toContain('"-" "curl/8.0"');
  });

  it('(h) newlines/quotes in user-agent are stripped (injection guard)', () => {
    const req = makeReq({ headers: { 'user-agent': 'bad\r\n"agent"' } });
    const res = makeRes(200, 0);
    const line = accessLine(req, res, '/');
    // Line must still match the overall shape
    expect(line).toMatch(COMBINED);
    // The raw CR/LF must not appear verbatim; only the terminal \n is allowed
    expect(line).not.toContain('\r');
    // Strip the trailing \n and verify no other newline is present
    expect(line.slice(0, -1)).not.toContain('\n');
  });

  it('(i) 304 response matches COMBINED shape', () => {
    const req = makeReq({ headers: { 'if-none-match': 'W/"abc"' } });
    const res = makeRes(304);
    expect(accessLine(req, res, '/app.js')).toMatch(COMBINED);
  });
});
