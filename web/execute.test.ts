// Tests de web/execute.ts — aucun réseau (deps injectées / fakes).
import { describe, it, expect, vi } from 'vitest';
import {
  minReceivedStroops,
  pickBest,
  parseXbullAcceptQuote,
  classifyExecError,
  reviewData,
  routeLabel,
  pickExecutableVenue,
  submit,
  ExecError,
  type ExecDeps,
  type FetchResult,
  type SoroswapClient,
} from './execute.js';
import { BLND, USDC, EURC } from '../core/assets.js';
import { toNumber } from '../core/amount.js';

// ─── minReceivedStroops ──────────────────────────────────────────────────────

describe('minReceivedStroops', () => {
  it('50bps : 101896877 → 101387392 (floor)', () => {
    expect(minReceivedStroops(101896877n, 50)).toBe(101387392n);
  });

  it('0bps : valeur inchangée', () => {
    expect(minReceivedStroops(101896877n, 0)).toBe(101896877n);
  });

  it('lance sur slippageBps = 10000', () => {
    expect(() => minReceivedStroops(100n, 10000)).toThrow();
  });

  it('lance sur slippageBps < 0', () => {
    expect(() => minReceivedStroops(100n, -1)).toThrow();
  });
});

// ─── pickBest ────────────────────────────────────────────────────────────────

describe('pickBest', () => {
  it('sélectionne le netOut le plus élevé', () => {
    const a = { venue: 'xbull' as const, netOut: 100n, route: '' };
    const b = { venue: 'soroswap' as const, netOut: 200n, soroPath: undefined, quote: null, minOut: 0n };
    expect(pickBest([a, b])).toBe(b);
  });

  it('ignore les nulls', () => {
    const a = { netOut: 50n };
    expect(pickBest([null, a, null])).toBe(a);
  });

  it('tous null → null', () => {
    expect(pickBest([null, null])).toBeNull();
  });

  it("à égalité, garde le premier (stable)", () => {
    const a = { netOut: 100n };
    const b = { netOut: 100n };
    expect(pickBest([a, b])).toBe(a);
  });
});

// ─── parseXbullAcceptQuote ───────────────────────────────────────────────────

describe('parseXbullAcceptQuote', () => {
  it('valide type full', () => {
    const r = parseXbullAcceptQuote({ id: 'abc', xdr: 'base64==', type: 'full' });
    expect(r).toEqual({ id: 'abc', xdr: 'base64==', type: 'full' });
  });

  it('valide type restore', () => {
    const r = parseXbullAcceptQuote({ id: 'xyz', xdr: 'xdr123', type: 'restore' });
    expect(r?.type).toBe('restore');
  });

  it('rejette si xdr manquant', () => {
    expect(parseXbullAcceptQuote({ id: 'abc', type: 'full' })).toBeNull();
  });

  it('rejette si type inconnu', () => {
    expect(parseXbullAcceptQuote({ id: 'abc', xdr: 'x', type: 'partial' })).toBeNull();
  });

  it('rejette si non-objet', () => {
    expect(parseXbullAcceptQuote('string')).toBeNull();
    expect(parseXbullAcceptQuote(null)).toBeNull();
    expect(parseXbullAcceptQuote(42)).toBeNull();
  });
});

// ─── classifyExecError ───────────────────────────────────────────────────────

describe('classifyExecError', () => {
  it('no trustline for EURC → trustline', () => {
    expect(classifyExecError('no trustline for EURC')).toBe('trustline');
  });

  it('not enough funds → funds', () => {
    expect(classifyExecError('not enough funds')).toBe('funds');
  });

  it('RouterInsufficientOutputAmount → slippage', () => {
    expect(classifyExecError('RouterInsufficientOutputAmount')).toBe('slippage');
  });

  it('gateway timeout → down', () => {
    expect(classifyExecError('gateway timeout')).toBe('down');
  });

  it('insensible à la casse (Trust → trustline)', () => {
    expect(classifyExecError('Trust line missing')).toBe('trustline');
  });

  it('insufficient balance → funds', () => {
    expect(classifyExecError('insufficient balance')).toBe('funds');
  });
});

// ─── reviewData ──────────────────────────────────────────────────────────────

describe('reviewData', () => {
  const BASE = {
    venue: 'xbull' as const,
    target: 'USDC' as const,
    type: 'full' as const,
    sendStroops: 10_0000000n, // 10 BLND
    netStroops: 5_0000000n,   // 5 USDC
    minReceivedStroops: 4_9750000n,
    slippageBps: 50,
    route: 'BLND → ☁ → USDC',
  };

  it('minReceived affiché correctement', () => {
    const r = reviewData(BASE);
    expect(r.minReceived).toBeCloseTo(toNumber(BASE.minReceivedStroops), 5);
  });

  it('fidelity présent si displayed.net > netOut de plus de 1e-6', () => {
    const r = reviewData({
      ...BASE,
      displayed: { winner: 'soroswap', net: toNumber(BASE.netStroops) + 0.01 },
    });
    expect(r.fidelity).toBeDefined();
    expect(r.fidelity?.displayedWinner).toBe('soroswap');
  });

  it('fidelity absent si displayed.net == netOut', () => {
    const r = reviewData({
      ...BASE,
      displayed: { winner: 'soroswap', net: toNumber(BASE.netStroops) },
    });
    expect(r.fidelity).toBeUndefined();
  });

  it('fidelity absent si displayed.net inférieur', () => {
    const r = reviewData({
      ...BASE,
      displayed: { winner: 'soroswap', net: toNumber(BASE.netStroops) - 0.1 },
    });
    expect(r.fidelity).toBeUndefined();
  });

  it('fidelity absent si displayed absent', () => {
    const r = reviewData(BASE);
    expect(r.fidelity).toBeUndefined();
  });
});

// ─── routeLabel ──────────────────────────────────────────────────────────────

describe('routeLabel', () => {
  it('soroswap avec path [BLND.sac, USDC.sac, EURC.sac] → BLND → USDC → EURC', () => {
    const label = routeLabel('soroswap', 'EURC', [BLND.sac, USDC.sac, EURC.sac]);
    expect(label).toBe('BLND → USDC → EURC');
  });

  it('xbull → BLND → ☁ → USDC', () => {
    expect(routeLabel('xbull', 'USDC')).toBe('BLND → ☁ → USDC');
  });

  it('soroswap sans path → BLND → USDC', () => {
    expect(routeLabel('soroswap', 'USDC')).toBe('BLND → USDC');
  });

  it('SAC inconnu → fallback premier4…dernier4', () => {
    const sac = 'CABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDE';
    const label = routeLabel('soroswap', 'USDC', [sac]);
    // 4 premiers + … + 4 derniers du SAC
    expect(label).toContain('…');
  });
});

// ─── pickExecutableVenue ─────────────────────────────────────────────────────

/**
 * Helper : construit un ExecDeps partiel depuis des fakes de haut niveau.
 * fetchJson route selon la substring d'URL ('/swaps/quote' vs '/swaps/accept-quote' vs '/swaps/submit').
 * makeSoroswap retourne un SoroswapClient fake.
 */
function fakeDeps(opts: {
  xbullQuote?: { toAmount: string; route: string } | null;
  /** Succès → objet accept-quote. Echec → { ok: false, body } pour simuler un 4xx avec message. */
  xbullAccept?: { id: string; xdr: string; type: 'full' | 'restore' } | { ok: false; body: unknown } | Error | null;
  xbullSubmit?: { success: boolean; hash: string } | null;
  soroQuote?: { amountOut: bigint; rawTrade: { amountOutMin: bigint }; routePlan: Array<{ swapInfo: { protocol: string; path: string[] } }> } | null;
  soroBuild?: { xdr: string } | Error | null;
  soroSend?: { txHash: string; success: boolean } | Error | null;
}): Partial<ExecDeps> {
  const fetchJson = vi.fn(async (url: string): Promise<FetchResult> => {
    if (url.includes('/swaps/accept-quote')) {
      if (opts.xbullAccept instanceof Error) throw opts.xbullAccept;
      if (opts.xbullAccept === null || opts.xbullAccept === undefined) {
        return { status: 400, ok: false, body: { message: 'accept error' } };
      }
      // { ok: false, body } → erreur simulée avec message personnalisé
      if ('ok' in opts.xbullAccept && opts.xbullAccept.ok === false) {
        return { status: 400, ok: false, body: opts.xbullAccept.body };
      }
      return { status: 200, ok: true, body: opts.xbullAccept };
    }
    if (url.includes('/swaps/submit')) {
      if (!opts.xbullSubmit) return { status: 500, ok: false, body: { message: 'submit error' } };
      return { status: 200, ok: true, body: opts.xbullSubmit };
    }
    if (url.includes('/swaps/quote')) {
      if (!opts.xbullQuote) return { status: 200, ok: true, body: {} };
      return { status: 200, ok: true, body: opts.xbullQuote };
    }
    return { status: 404, ok: false, body: {} };
  });

  const makeSoroswap = vi.fn((_apiKey: string): SoroswapClient => ({
    async quote(_req) {
      if (opts.soroQuote === undefined) return null;
      return opts.soroQuote;
    },
    async build(_req) {
      if (opts.soroBuild instanceof Error) throw opts.soroBuild;
      if (!opts.soroBuild) throw new Error('build failed');
      return opts.soroBuild;
    },
    async send(_xdr) {
      if (opts.soroSend instanceof Error) throw opts.soroSend;
      if (!opts.soroSend) throw new Error('send failed');
      return opts.soroSend;
    },
  }));

  return { fetchJson, makeSoroswap };
}

const CFG = { soroswapApiKey: 'test-key', rpcUrl: 'https://rpc.test', timeoutMs: 5000 };
const SENDER = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

describe('pickExecutableVenue', () => {
  it('(a) soroswap net plus élevé → soroswap choisi, review.netOut correct', async () => {
    const netSoro = 5_2000000n; // > xbull 5.0
    const netXbull = 5_0000000n;
    const result = await pickExecutableVenue(
      'USDC',
      10_0000000n,
      SENDER,
      50,
      CFG,
      undefined,
      fakeDeps({
        xbullQuote: { toAmount: netXbull.toString(), route: 'uuid-xbull' },
        xbullAccept: { id: 'id1', xdr: 'xdr-xbull', type: 'full' },
        soroQuote: {
          amountOut: netSoro,
          rawTrade: { amountOutMin: minReceivedStroops(netSoro, 50) },
          routePlan: [{ swapInfo: { protocol: 'soroswap', path: [BLND.sac, USDC.sac] } }],
        },
        soroBuild: { xdr: 'xdr-soro' },
      }),
    );
    expect(result.venue).toBe('soroswap');
    expect(result.review.netOut).toBeCloseTo(toNumber(netSoro), 5);
  });

  it('(b) xBull net plus élevé mais build échoue → fallback soroswap', async () => {
    const netXbull = 6_0000000n;
    const netSoro = 5_0000000n;
    const result = await pickExecutableVenue(
      'USDC',
      10_0000000n,
      SENDER,
      50,
      CFG,
      undefined,
      fakeDeps({
        xbullQuote: { toAmount: netXbull.toString(), route: 'uuid-xbull' },
        xbullAccept: null, // build échoue (retourne 400)
        soroQuote: {
          amountOut: netSoro,
          rawTrade: { amountOutMin: minReceivedStroops(netSoro, 50) },
          routePlan: [{ swapInfo: { protocol: 'soroswap', path: [BLND.sac, USDC.sac] } }],
        },
        soroBuild: { xdr: 'xdr-soro-fallback' },
      }),
    );
    expect(result.venue).toBe('soroswap');
    expect(result.xdr).toBe('xdr-soro-fallback');
  });

  it('(c) soroswap quote null, xBull build réussit → xbull choisi', async () => {
    const result = await pickExecutableVenue(
      'USDC',
      10_0000000n,
      SENDER,
      50,
      CFG,
      undefined,
      fakeDeps({
        xbullQuote: { toAmount: '5000000', route: 'uuid-only-xbull' },
        xbullAccept: { id: 'id-ok', xdr: 'xdr-only-xbull', type: 'full' },
        soroQuote: null,
      }),
    );
    expect(result.venue).toBe('xbull');
    expect(result.id).toBe('id-ok');
  });

  it('(d) xBull accept-quote retourne type restore → result.type === restore', async () => {
    const result = await pickExecutableVenue(
      'USDC',
      10_0000000n,
      SENDER,
      50,
      CFG,
      undefined,
      fakeDeps({
        xbullQuote: { toAmount: '9000000', route: 'uuid-restore' },
        xbullAccept: { id: 'id-restore', xdr: 'xdr-restore', type: 'restore' },
        soroQuote: null,
      }),
    );
    expect(result.type).toBe('restore');
  });

  it('(e) les deux quotes null → lance ExecError code no-route', async () => {
    await expect(
      pickExecutableVenue(
        'USDC',
        10_0000000n,
        SENDER,
        50,
        CFG,
        undefined,
        fakeDeps({ xbullQuote: null, soroQuote: null }),
      ),
    ).rejects.toMatchObject({ code: 'no-route' });
  });

  it('(f) les deux builds échouent, trustline > down → lance trustline', async () => {
    // xBull quote gagnant, accept-quote 400 trustline.
    // Soroswap quote second, build échoue avec down.
    // fakeDeps supporte maintenant { ok: false, body } pour xbullAccept.
    await expect(
      pickExecutableVenue(
        'EURC',
        10_0000000n,
        SENDER,
        50,
        CFG,
        undefined,
        fakeDeps({
          xbullQuote: { toAmount: '9000000', route: 'uuid-xbull' },
          xbullAccept: { ok: false, body: { message: 'no trustline for EURC' } },
          soroQuote: {
            amountOut: 8_0000000n,
            rawTrade: { amountOutMin: 7_9600000n },
            routePlan: [{ swapInfo: { protocol: 'soroswap', path: [BLND.sac, EURC.sac] } }],
          },
          soroBuild: new Error('down network error'),
        }),
      ),
    ).rejects.toMatchObject({ code: 'trustline' });
  });

  it('(g) Soroswap renvoie des NUMBER (SDK réel) → coercition bigint, venue choisi', async () => {
    // Le SDK @soroswap renvoie amountOut/amountOutMin en NUMBER malgré le typage bigint.
    const result = await pickExecutableVenue(
      'USDC',
      10_0000000n,
      SENDER,
      50,
      CFG,
      undefined,
      fakeDeps({
        xbullQuote: null,
        soroQuote: {
          amountOut: 5_2000000, // number, pas bigint
          rawTrade: { amountOutMin: 5_1740000 }, // number
          routePlan: [{ swapInfo: { protocol: 'soroswap', path: [BLND.sac, USDC.sac] } }],
        },
        soroBuild: { xdr: 'xdr-num' },
      } as never),
    );
    expect(result.venue).toBe('soroswap');
    expect(result.review.netOut).toBeCloseTo(5.2, 5);
    expect(result.review.minReceived).toBeCloseTo(5.174, 5);
  });
});

describe('submit', () => {
  it('xBull ok → retourne hash', async () => {
    const deps = fakeDeps({ xbullSubmit: { success: true, hash: 'abc123' } });
    const result = await submit('xbull', { id: 'q1', signedXdr: 'xdr…' }, { rpcUrl: 'r' }, deps);
    expect(result).toEqual({ hash: 'abc123' });
  });

  it('xBull success:false → ExecError down', async () => {
    const deps = fakeDeps({ xbullSubmit: { success: false, hash: '' } });
    await expect(
      submit('xbull', { id: 'q1', signedXdr: 'xdr…' }, { rpcUrl: 'r' }, deps),
    ).rejects.toMatchObject({ code: 'down' });
  });

  it('soroswap ok → retourne txHash', async () => {
    const deps = fakeDeps({ soroSend: { txHash: 'def456', success: true } });
    const result = await submit(
      'soroswap',
      { signedXdr: 'xdr…' },
      { rpcUrl: 'r', soroswapApiKey: 'k' },
      deps,
    );
    expect(result).toEqual({ hash: 'def456' });
  });

  it('soroswap success:false → ExecError down', async () => {
    const deps = fakeDeps({ soroSend: { txHash: 'x', success: false } });
    await expect(
      submit('soroswap', { signedXdr: 'xdr…' }, { rpcUrl: 'r', soroswapApiKey: 'k' }, deps),
    ).rejects.toMatchObject({ code: 'down' });
  });

  it('soroswap send() lève → ExecError classé (jamais un 500 opaque post-signature)', async () => {
    const deps = fakeDeps({ soroSend: new Error('missing trustline for asset') });
    await expect(
      submit('soroswap', { signedXdr: 'xdr…' }, { rpcUrl: 'r', soroswapApiKey: 'k' }, deps),
    ).rejects.toMatchObject({ name: 'ExecError', code: 'trustline' });
  });
});
