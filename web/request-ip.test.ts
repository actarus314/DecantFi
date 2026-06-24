import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { clientIp } from './request-ip.js';

/** Minimal IncomingMessage stub — only what clientIp needs. */
function makeReq(
  headers: Record<string, string | string[]> = {},
  remoteAddress = '1.2.3.4',
): IncomingMessage {
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as IncomingMessage;
}

describe('clientIp', () => {
  it('(a) X-Real-IP wins under TRUST_PROXY=true', () => {
    const req = makeReq({ 'x-real-ip': '10.0.0.1', 'x-forwarded-for': '9.9.9.9' });
    expect(clientIp(req, true)).toBe('10.0.0.1');
  });

  it('(b) X-Forwarded-For takes RIGHTMOST element; spoofed first element is ignored', () => {
    // Client sends "spoofed" as leftmost; proxy appends "192.168.1.1" on the right.
    const req = makeReq({ 'x-forwarded-for': 'spoofed, 10.10.10.10, 192.168.1.1' });
    expect(clientIp(req, true)).toBe('192.168.1.1');
  });

  it('(c) TRUST_PROXY off → socket remoteAddress, headers ignored', () => {
    const req = makeReq({ 'x-real-ip': '10.0.0.1', 'x-forwarded-for': '9.9.9.9' }, '5.5.5.5');
    expect(clientIp(req, false)).toBe('5.5.5.5');
  });

  it('(d) fallback to socket address when proxy headers absent', () => {
    const req = makeReq({}, '8.8.8.8');
    expect(clientIp(req, true)).toBe('8.8.8.8');
  });
});
