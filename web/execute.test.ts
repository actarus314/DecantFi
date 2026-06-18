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
  quoteHorizon,
  horizonPathSymbols,
  classifyHorizonSubmit,
  quoteAquarius,
  aquariusPathSymbols,
  quoteComet,
  parseUltraQuote,
  quoteUltra,
  reconcileLegSends,
  type ExecDeps,
  type FetchResult,
  type SoroswapClient,
} from './execute.js';
import { BLND, USDC, EURC } from '../core/assets.js';
import { toNumber, toStroops } from '../core/amount.js';

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
  cometOut?: bigint | null;
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

  return { fetchJson, makeSoroswap, simulateComet: vi.fn(async () => opts.cometOut ?? null) };
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

  // ─── forceVenue (click-to-select) ────────────────────────────────────────────

  it('(h) forceVenue:soroswap → seul soroswap buildé, même si xbull net plus élevé', async () => {
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
        xbullAccept: { id: 'id1', xdr: 'xdr-xbull', type: 'full' },
        soroQuote: {
          amountOut: netSoro,
          rawTrade: { amountOutMin: minReceivedStroops(netSoro, 50) },
          routePlan: [{ swapInfo: { protocol: 'soroswap', path: [BLND.sac, USDC.sac] } }],
        },
        soroBuild: { xdr: 'xdr-soro-forced' },
      }),
      'soroswap',
    );
    expect(result.venue).toBe('soroswap');
    expect(result.xdr).toBe('xdr-soro-forced');
  });

  it('(i) forceVenue:soroswap mais soroswap indisponible → ExecError no-route', async () => {
    await expect(
      pickExecutableVenue(
        'USDC',
        10_0000000n,
        SENDER,
        50,
        CFG,
        undefined,
        fakeDeps({
          xbullQuote: { toAmount: '5000000', route: 'uuid-xbull' },
          xbullAccept: { id: 'id1', xdr: 'xdr-xbull', type: 'full' },
          soroQuote: null, // soroswap indisponible
        }),
        'soroswap',
      ),
    ).rejects.toMatchObject({ code: 'no-route' });
  });

  it('(j) soroswap multi-hop EURC (path 3 nœuds) → review.route = BLND → USDC → EURC', async () => {
    const net = 4_1000000n;
    const result = await pickExecutableVenue(
      'EURC',
      1000_0000000n,
      SENDER,
      50,
      CFG,
      undefined,
      fakeDeps({
        xbullQuote: null,
        soroQuote: {
          amountOut: net,
          rawTrade: { amountOutMin: minReceivedStroops(net, 50) },
          routePlan: [{ swapInfo: { protocol: 'soroswap', path: [BLND.sac, USDC.sac, EURC.sac] } }],
        },
        soroBuild: { xdr: 'xdr-soro-multihop' },
      }),
    );
    expect(result.venue).toBe('soroswap');
    expect(result.review.route).toBe('BLND → USDC → EURC');
  });

  it('(g) comet coté pour USDC (gate ouvert) — simulateComet appelé', async () => {
    const deps = fakeDeps({
      xbullQuote: { toAmount: '5000000', route: 'r' },
      xbullAccept: { id: 'i', xdr: 'x', type: 'full' },
      soroQuote: null,
      cometOut: 3000000n, // 0.3 USDC < xbull 0.5 → xbull gagne, buildComet jamais appelé
    });
    const result = await pickExecutableVenue('USDC', 10_0000000n, SENDER, 50, CFG, undefined, deps);
    expect(result.venue).toBe('xbull');
    expect((deps.simulateComet as any).mock.calls.length).toBe(1);
  });

  it('(h) comet jamais coté pour EURC (gate fermé) — simulateComet pas appelé', async () => {
    const deps = fakeDeps({
      xbullQuote: { toAmount: '5000000', route: 'r' },
      xbullAccept: { id: 'i', xdr: 'x', type: 'full' },
      soroQuote: null,
      cometOut: 3000000n,
    });
    const result = await pickExecutableVenue('EURC', 10_0000000n, SENDER, 50, CFG, undefined, deps);
    expect(result.venue).toBe('xbull');
    expect((deps.simulateComet as any).mock.calls.length).toBe(0);
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

// ─── Horizon ──────────────────────────────────────────────────────────────────

describe('horizonPathSymbols', () => {
  it('mappe native → XLM et garde les codes', () => {
    expect(horizonPathSymbols([
      { asset_type: 'native' },
      { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GA5…' },
    ])).toEqual(['XLM', 'USDC']);
  });
  it('chemin vide → []', () => {
    expect(horizonPathSymbols([])).toEqual([]);
  });
});

describe('quoteHorizon', () => {
  // deps minimal : quoteHorizon n'utilise que fetchJson.
  const depsFromBody = (body: unknown, ok = true): ExecDeps =>
    ({ fetchJson: vi.fn(async () => ({ status: ok ? 200 : 500, ok, body })), makeSoroswap: vi.fn() }) as unknown as ExecDeps;

  it('choisit le record au plus gros destination_amount + renvoie son chemin', async () => {
    const body = { _embedded: { records: [
      { destination_amount: '120.0', path: [] },
      { destination_amount: '123.4567890', path: [{ asset_type: 'native' }] },
    ] } };
    const q = await quoteHorizon(BLND, USDC, 1000_0000000n, depsFromBody(body), 'https://h.test');
    expect(q).not.toBeNull();
    expect(q!.netOut).toBe(1234567890n); // 123.456789 × 1e7
    expect(q!.path).toEqual([{ asset_type: 'native' }]);
  });

  it('records vide → null', async () => {
    const q = await quoteHorizon(BLND, USDC, 1n, depsFromBody({ _embedded: { records: [] } }), 'h');
    expect(q).toBeNull();
  });

  it('réponse non-ok → null', async () => {
    const q = await quoteHorizon(BLND, EURC, 1n, depsFromBody({}, false), 'h');
    expect(q).toBeNull();
  });
});

describe('classifyHorizonSubmit', () => {
  const err = (...ops: string[]) => ({ response: { data: { extras: { result_codes: { transaction: 'tx_failed', operations: ops } } } } });
  it('op_too_few_offers (orderbook consommé) → slippage, pas down (502)', () => {
    expect(classifyHorizonSubmit(err('op_too_few_offers'))).toBe('slippage');
  });
  it('op_offer_cross_self → slippage', () => {
    expect(classifyHorizonSubmit(err('op_offer_cross_self'))).toBe('slippage');
  });
  it('op_under_dest_min → slippage', () => {
    expect(classifyHorizonSubmit(err('op_under_dest_min'))).toBe('slippage');
  });
  it('op_no_trust → trustline', () => {
    expect(classifyHorizonSubmit(err('op_no_trust'))).toBe('trustline');
  });
  it('op_underfunded → funds', () => {
    expect(classifyHorizonSubmit(err('op_underfunded'))).toBe('funds');
  });
  it('code inconnu / pas de result_codes → down', () => {
    expect(classifyHorizonSubmit(new Error('boom'))).toBe('down');
  });
});

describe('aquariusPathSymbols', () => {
  it("mappe 'native' → XLM et CODE:ISSUER → CODE", () => {
    expect(aquariusPathSymbols(['native', 'AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA'])).toEqual(['XLM', 'AQUA']);
  });
  it('route multi-hop BLND→sUSD→USDC', () => {
    expect(aquariusPathSymbols(['BLND:GDJ', 'sUSD:GCH', 'USDC:GA5'])).toEqual(['BLND', 'sUSD', 'USDC']);
  });
  it('liste vide → []', () => {
    expect(aquariusPathSymbols([])).toEqual([]);
  });
});

describe('quoteAquarius', () => {
  const depsFromBody = (body: unknown, ok = true): ExecDeps =>
    ({ fetchJson: vi.fn(async () => ({ status: ok ? 200 : 500, ok, body })), makeSoroswap: vi.fn(), simulateComet: vi.fn(async () => null) }) as unknown as ExecDeps;

  it('parse net (amount_with_fee stroops bruts) + swap_chain_xdr + tokens', async () => {
    const body = { success: true, amount: 505220384, amount_with_fee: 505220384, swap_chain_xdr: 'AAAAE==', tokens: ['BLND:G', 'sUSD:G', 'USDC:G'] };
    const q = await quoteAquarius(BLND.sac, USDC.sac, 1000_0000000n, depsFromBody(body));
    expect(q).not.toBeNull();
    expect(q!.netOut).toBe(505220384n);
    expect(q!.swapChainXdr).toBe('AAAAE==');
    expect(q!.tokens).toEqual(['BLND:G', 'sUSD:G', 'USDC:G']);
  });

  it('success:false → null', async () => {
    const q = await quoteAquarius(BLND.sac, EURC.sac, 1n, depsFromBody({ success: false }));
    expect(q).toBeNull();
  });

  it('swap_chain_xdr absent → null', async () => {
    const q = await quoteAquarius(BLND.sac, USDC.sac, 1n, depsFromBody({ success: true, amount_with_fee: 100, tokens: [] }));
    expect(q).toBeNull();
  });

  it('réponse non-ok → null', async () => {
    const q = await quoteAquarius(BLND.sac, USDC.sac, 1n, depsFromBody({}, false));
    expect(q).toBeNull();
  });
});

describe('quoteComet', () => {
  const depsSim = (out: bigint | null): ExecDeps =>
    ({ fetchJson: vi.fn(), makeSoroswap: vi.fn(), simulateComet: vi.fn(async () => out) }) as unknown as ExecDeps;

  it('sortie simulée > 0 → venue comet + netOut', async () => {
    const q = await quoteComet(depsSim(33_0000000n), BLND.sac, USDC.sac, 750_0000000n, 'https://rpc.test');
    expect(q).toEqual({ venue: 'comet', netOut: 33_0000000n });
  });
  it('simulation null → null', async () => {
    expect(await quoteComet(depsSim(null), BLND.sac, USDC.sac, 1n, 'r')).toBeNull();
  });
  it('sortie 0 → null', async () => {
    expect(await quoteComet(depsSim(0n), BLND.sac, USDC.sac, 1n, 'r')).toBeNull();
  });
});

describe('Ultra Stellar', () => {
  const CANNED = {
    optimized_sum: '46.7638929',
    extended_paths: [
      { percent: 90, sourceAmount: 900, destinationAmount: '42.0', path: [{ asset_type: 'credit_alphanum4', asset_code: 'AQUA', asset_issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA' }] },
      { percent: 10, sourceAmount: 100, destinationAmount: '4.7638929', path: [] },
    ],
  };

  it('parseUltraQuote → net + jambes en stroops, path conservé', () => {
    const r = parseUltraQuote(CANNED)!;
    expect(r.netOut).toBe(toStroops('46.7638929'));
    expect(r.legs).toHaveLength(2);
    expect(r.legs[0]!.sendStroops).toBe(toStroops(900));
    expect(r.legs[0]!.destStroops).toBe(toStroops('42.0'));
    expect(r.legs[0]!.path).toHaveLength(1);
    expect(r.legs[1]!.path).toHaveLength(0); // jambe directe
  });

  it('parseUltraQuote → null si aucune jambe valide', () => {
    expect(parseUltraQuote({ extended_paths: [] })).toBeNull();
    expect(parseUltraQuote({})).toBeNull();
    // jambes nulles (arrondies à 0) → droppées → aucune jambe valide → null
    expect(parseUltraQuote({ optimized_sum: '46', extended_paths: [{ sourceAmount: 0, destinationAmount: 0 }] })).toBeNull();
  });

  it('parseUltraQuote → net = Σ jambes RETENUES (ignore optimized_sum, anti-inflation si jambe droppée)', () => {
    // optimized_sum prétend 99 mais une jambe est malformée (non parseable) → droppée.
    // Le net doit refléter la SEULE jambe retenue (10), pas le total Ultra (sinon affiché > exécuté).
    const r = parseUltraQuote({
      optimized_sum: '99',
      extended_paths: [
        { sourceAmount: 200, destinationAmount: '10.0', path: [] },
        { sourceAmount: 'pas-un-nombre', destinationAmount: '89.0', path: [] },
      ],
    })!;
    expect(r.legs).toHaveLength(1);
    expect(r.netOut).toBe(toStroops('10.0'));
  });

  it('quoteUltra → parse via fetchJson injecté', async () => {
    const deps = { fetchJson: async () => ({ status: 200, ok: true, body: CANNED }) } as unknown as Parameters<typeof quoteUltra>[3];
    const q = (await quoteUltra(BLND, USDC, toStroops(1000), deps))!;
    expect(q.venue).toBe('ultrastellar');
    expect(q.netOut).toBe(toStroops('46.7638929'));
    expect(q.legs).toHaveLength(2);
  });

  it('quoteUltra → null si fetch !ok', async () => {
    const deps = { fetchJson: async () => ({ status: 502, ok: false, body: {} }) } as unknown as Parameters<typeof quoteUltra>[3];
    expect(await quoteUltra(BLND, USDC, toStroops(1000), deps)).toBeNull();
  });

  it('reconcileLegSends → résidu positif ajouté à la plus grande jambe, Σ == total', () => {
    const out = reconcileLegSends([toStroops(900), toStroops(99)], toStroops(1000));
    expect(out.reduce((a, b) => a + b, 0n)).toBe(toStroops(1000));
    expect(out[0]).toBe(toStroops(900) + toStroops(1)); // +1 BLND résiduel sur la plus grande
    expect(out[1]).toBe(toStroops(99));
  });

  it('reconcileLegSends → résidu nul = passthrough', () => {
    const sends = [toStroops(400), toStroops(600)];
    expect(reconcileLegSends(sends, toStroops(1000))).toEqual(sends);
  });
});
