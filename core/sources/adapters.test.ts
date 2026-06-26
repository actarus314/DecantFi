// Tests des adapters sur des reponses REELLES capturees en live le 2026-06-15 (fixtures).
// Figent le parsing/normalisation des 7 sources (contrats d'API verifies).
import { describe, it, expect } from 'vitest';
import { xdr, scValToNative } from '@stellar/stellar-sdk';
import type { QuoteRequest } from './types.js';
import { BLND, USDC, EURC } from '../assets.js';
import { toStroops } from '../amount.js';
import { loadFixture } from '../../test/loadFixture.js';
import { parseXbull } from './xbull.js';
import { parseAquarius } from './aquarius.js';
import { parseHorizon } from './horizon.js';
import { parseStellarbroker, captureStellarBrokerTx } from './stellarbroker.js';
import { parseUltrastellar } from './ultrastellar.js';
import { parseSoroswapRoute } from './soroswap.js';
import { decodeCometOut } from './comet.js';
import { decodePhoenixOut } from './phoenix.js';

const req: QuoteRequest = { sellAsset: BLND, buyAsset: USDC, amountIn: toStroops('1000'), slippageBps: 50 };

describe('xbull', () => {
  it('toAmount = net (stroops)', () => {
    const q = parseXbull(loadFixture('xbull.blnd-usdc.json'), req)!;
    expect(q.source).toBe('xbull');
    expect(q.netOut).toBe(509187563n);
    expect(q.netConfidence).toBe('exact');
    expect(q.feeBreakdown[0]?.amount).toBe(509187n);
  });
  it('shape .app (fee = string ratio) : netOut exact, feeBreakdown vide', () => {
    // Shape renvoyée par swap.apis.xbull.app (endpoint exécutable, vérité actuelle)
    const raw = { route: 'abc123', fromAmount: '300000000', fromAsset: 'C...', toAsset: 'C...', toAmount: '14493322', fee: '0.001' };
    const q = parseXbull(raw, req)!;
    expect(q.netOut).toBe(14493322n);
    expect(q.netConfidence).toBe('exact');
    expect(q.feeBreakdown).toHaveLength(0);
  });
  it('null si toAmount absent', () => {
    expect(parseXbull({}, req)).toBeNull();
  });
});

describe('aquarius', () => {
  it('amount_with_fee = net (stroops), route via sUSD', () => {
    const q = parseAquarius(loadFixture('aquarius.blnd-usdc.json'), req)!;
    expect(q.source).toBe('aquarius');
    expect(q.netOut).toBe(505220384n);
    expect(q.route.map((h) => h.buy)).toContain('sUSD');
  });
  it('raw find-path quote defaults to estimate confidence (over-quotes ~0.2% via-XLM routes)', () => {
    const q = parseAquarius(loadFixture('aquarius.blnd-usdc.json'), req)!;
    // find-path API over-quotes; confidence is promoted to 'exact' only after a successful on-chain re-sim
    expect(q.netConfidence).toBe('estimate');
  });
  it('null si success=false', () => {
    expect(parseAquarius({ success: false }, req)).toBeNull();
  });
});

describe('horizon', () => {
  it('prend le meilleur destination_amount (humain -> stroops)', () => {
    const q = parseHorizon(loadFixture('horizon.blnd-usdc.json'), req)!;
    expect(q.source).toBe('horizon');
    expect(q.netOut).toBe(toStroops('45.6531063'));
  });
  it('null si aucun record', () => {
    expect(parseHorizon({ _embedded: { records: [] } }, req)).toBeNull();
  });
});

describe('stellarbroker', () => {
  it('classifies on estimate, floor in netRange.low', () => {
    const q = parseStellarbroker(loadFixture('stellarbroker.blnd-usdc.json'), req)!;
    expect(q.netConfidence).toBe('estimate');
    expect(q.netOut).toBe(toStroops('42.0911116'));
    expect(q.netRange?.low).toBe(toStroops('40.7380394'));
    expect(q.netRange?.high).toBe(toStroops('42.0911116'));
    expect(q.netRange!.high).toBeGreaterThan(q.netRange!.low);
  });
  it('null si status != success', () => {
    expect(parseStellarbroker({ status: 'error' }, req)).toBeNull();
  });
  it('unwraps msg.quote (WS envelope)', () => {
    const wsEnvelope = loadFixture('stellarbroker.ws.blnd-usdc.json') as { quote: unknown };
    const q = parseStellarbroker(wsEnvelope.quote, req)!;
    expect(q.netConfidence).toBe('estimate');
    expect(q.netOut).toBe(toStroops('42.0911116'));
  });
});

describe('ultrastellar', () => {
  it('optimized_sum = net (humain -> stroops)', () => {
    const q = parseUltrastellar(loadFixture('ultrastellar.blnd-usdc.json'), req)!;
    expect(q.netOut).toBe(toStroops('48.1573592'));
    expect(q.netConfidence).toBe('exact');
  });
});

describe('soroswap', () => {
  it('quoteCurrency = sortie nette (stroops)', () => {
    const f = loadFixture('soroswap.blnd-usdc.json') as {
      quoteCurrency: { raw: string };
      trade: { path: string[] };
    };
    const route = { quoteCurrency: { quotient: f.quoteCurrency.raw }, trade: { path: f.trade.path } };
    const q = parseSoroswapRoute(route, req)!;
    expect(q.source).toBe('soroswap');
    expect(q.netOut).toBe(506342052n);
    expect(q.route.map((h) => h.sell)).toContain('BLND');
  });

  it('multi-hop : path 3 noeuds -> 2 hops BLND->USDC->EURC', () => {
    const route = { quoteCurrency: { quotient: '439000000' }, trade: { path: [BLND.sac, USDC.sac, EURC.sac] } };
    const reqE: QuoteRequest = { sellAsset: BLND, buyAsset: EURC, amountIn: toStroops('1000'), slippageBps: 50 };
    const q = parseSoroswapRoute(route, reqE)!;
    expect(q.route).toHaveLength(2);
    expect(q.route[0]).toMatchObject({ sell: 'BLND', buy: 'USDC' });
    expect(q.route[1]).toMatchObject({ sell: 'USDC', buy: 'EURC' });
    expect(q.netOut).toBe(439000000n);
  });
});

describe('phoenix', () => {
  it('decodePhoenixOut → ask_amount (déjà net de commission)', () => {
    expect(decodePhoenixOut({ ask_amount: 194227186n, commission_amount: 976016n, spread_amount: 4980n, total_return: 195208182n })).toBe(194227186n);
  });
  it('decodePhoenixOut → null si absent / ≤0 / non-objet', () => {
    expect(decodePhoenixOut(null)).toBeNull();
    expect(decodePhoenixOut({})).toBeNull();
    expect(decodePhoenixOut({ ask_amount: 0n })).toBeNull();
    expect(decodePhoenixOut('nope')).toBeNull();
  });
});

describe('comet', () => {
  it('decode le retval simule (vec [amount_out, prix]) -> ~50,9156 USDC', () => {
    const f = loadFixture('comet.blnd-usdc.json') as {
      result: { results: { xdr: string }[] };
    };
    const native = scValToNative(xdr.ScVal.fromXDR(f.result.results[0]!.xdr, 'base64'));
    expect(decodeCometOut(native)).toBe(509156322n);
  });
  it('decode direct depuis un tableau', () => {
    expect(decodeCometOut([509156322n, 196540873n])).toBe(509156322n);
    expect(decodeCometOut([])).toBeNull();
  });
});

// ─── captureStellarBrokerTx ───────────────────────────────────────────────────

describe('captureStellarBrokerTx', () => {
  /** Minimal fake WebSocket that lets the test drive server→client messages. */
  type FakeWS = {
    sentMessages: string[];
    onmessage: ((e: { data: string }) => void) | null;
    onerror: ((e: unknown) => void) | null;
    onclose: (() => void) | null;
    onopen: (() => void) | null;
    readyState: number;
    send(data: string): void;
    close(): void;
    receive(data: string): void;
  };

  let wsInstance: FakeWS | null = null;
  const FakeWSClass = class {
    sentMessages: string[] = [];
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onclose: (() => void) | null = null;
    onopen: (() => void) | null = null;
    readyState = 1;
    constructor(_url: string) { wsInstance = this as unknown as FakeWS; }
    send(data: string) { this.sentMessages.push(data); }
    close() { this.readyState = 3; }
    receive(data: string) { this.onmessage?.({ data }); }
  } as unknown as typeof WebSocket;

  const REQ: QuoteRequest = { sellAsset: BLND, buyAsset: USDC, amountIn: 5000_0000000n, slippageBps: 50 };
  const WITNESS = 'GCA34HBKNLWN3AOXWBRW5Y3HSGHCWF3UDBRJ5YHGU6HWGJZEPO2NSXI3';

  it('sends quote on connected, sends trade on quote success, collects XDRs, sends stop on burst end', async () => {
    wsInstance = null;
    const capturePromise = captureStellarBrokerTx(REQ, 'test-key', WITNESS, {
      WebSocketConstructor: FakeWSClass,
      _burstWindowMs: 10,
      _totalTimeoutMs: 500,
    });

    // Promise executor runs synchronously → wsInstance and handlers are set before we continue
    expect(wsInstance).not.toBeNull();

    // Server: connected
    wsInstance!.receive(JSON.stringify({ type: 'connected' }));
    expect(wsInstance!.sentMessages.some(m => JSON.parse(m).type === 'quote')).toBe(true);

    // Server: quote success
    wsInstance!.receive(JSON.stringify({
      type: 'quote',
      quote: { status: 'success', estimatedBuyingAmount: '201.5', directTrade: { buying: '193.1' } },
    }));
    expect(wsInstance!.sentMessages.some(m => JSON.parse(m).type === 'trade')).toBe(true);

    // Server: tx burst
    wsInstance!.receive(JSON.stringify({ type: 'tx', xdr: 'XDR_0' }));
    wsInstance!.receive(JSON.stringify({ type: 'tx', xdr: 'XDR_1' }));

    // Wait for burst window (10 ms) + margin
    await new Promise(r => setTimeout(r, 30));

    const result = await capturePromise;
    expect(result).not.toBeNull();
    expect(result!.xdrs).toEqual(['XDR_0', 'XDR_1']);
    expect(result!.estimatedBuyingAmount).toBe('201.5');
    expect(result!.directBuying).toBe('193.1');
    expect(wsInstance!.sentMessages.some(m => JSON.parse(m).type === 'stop')).toBe(true);
  });

  it('returns null when server quote status is not success', async () => {
    wsInstance = null;
    const capturePromise = captureStellarBrokerTx(REQ, 'test-key', WITNESS, {
      WebSocketConstructor: FakeWSClass, _burstWindowMs: 10, _totalTimeoutMs: 200,
    });
    wsInstance!.receive(JSON.stringify({ type: 'connected' }));
    wsInstance!.receive(JSON.stringify({ type: 'quote', quote: { status: 'error', estimatedBuyingAmount: '0' } }));
    expect(await capturePromise).toBeNull();
  });

  it('returns null on global timeout when no tx received', async () => {
    wsInstance = null;
    const capturePromise = captureStellarBrokerTx(REQ, 'test-key', WITNESS, {
      WebSocketConstructor: FakeWSClass, _burstWindowMs: 10, _totalTimeoutMs: 30,
    });
    wsInstance!.receive(JSON.stringify({ type: 'connected' }));
    wsInstance!.receive(JSON.stringify({
      type: 'quote',
      quote: { status: 'success', estimatedBuyingAmount: '201', directTrade: { buying: '193' } },
    }));
    // trade sent but server never sends tx → global timeout fires (30 ms)
    expect(await capturePromise).toBeNull();
  });

  it('responds to ping with pong containing matching uid', async () => {
    wsInstance = null;
    const capturePromise = captureStellarBrokerTx(REQ, 'test-key', WITNESS, {
      WebSocketConstructor: FakeWSClass, _burstWindowMs: 10, _totalTimeoutMs: 80,
    });
    wsInstance!.receive(JSON.stringify({ type: 'connected' }));
    wsInstance!.receive(JSON.stringify({ type: 'ping', uid: 'abc-123' }));
    const pong = wsInstance!.sentMessages.find(m => JSON.parse(m).type === 'pong');
    expect(pong).toBeDefined();
    expect(JSON.parse(pong!).uid).toBe('abc-123');
    await capturePromise; // let it time out cleanly
  });
});
