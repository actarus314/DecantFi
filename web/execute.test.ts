// Tests de web/execute.ts — aucun réseau (deps injectées / fakes).
import { describe, it, expect, vi } from 'vitest';
import {
  minReceivedStroops,
  pickBest,
  feeExceedsSpendable,
  parseXbullAcceptQuote,
  classifyExecError,
  reviewData,
  routeLabel,
  pickExecutableVenue,
  submit,
  txStatus,
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
  simulateStellarBrokerNet,
  SB_FEE_ACCOUNT,
  type ExecDeps,
  type FetchResult,
  type SoroswapClient,
  type SendStatus,
} from './execute.js';
import { BLND, USDC, EURC } from '../core/assets.js';
import { toNumber, toStroops } from '../core/amount.js';
import {
  TransactionBuilder,
  Networks,
  Operation,
  Asset as SdkAsset,
  Keypair,
  Account,
  Contract,
  nativeToScVal,
} from '@stellar/stellar-sdk';

// ─── Helpers pour construire de vraies transactions de test ──────────────────

const TEST_KP = Keypair.random();

/** Construit et signe une transaction avec une seule opération. */
function buildSignedXdr(op: Parameters<TransactionBuilder['addOperation']>[0], seqOffset = 0): string {
  const account = new Account(TEST_KP.publicKey(), String(100 + seqOffset));
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.PUBLIC })
    .addOperation(op)
    .setTimeout(30)
    .build();
  tx.sign(TEST_KP);
  return tx.toXDR();
}

/** XDR d'une tx pathPaymentStrictSend (opération autorisée). */
function xdrPathPayment(): string {
  return buildSignedXdr(
    Operation.pathPaymentStrictSend({
      sendAsset: SdkAsset.native(),
      sendAmount: '1',
      destination: TEST_KP.publicKey(),
      destAsset: SdkAsset.native(),
      destMin: '0.9',
      path: [],
    }),
    0,
  );
}

/** XDR d'une tx changeTrust (opération autorisée — trustline EURC). */
function xdrChangeTrust(): string {
  const asset = new SdkAsset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
  return buildSignedXdr(Operation.changeTrust({ asset }), 1);
}

/** XDR d'une tx payment (opération interdite). */
function xdrPayment(): string {
  return buildSignedXdr(
    Operation.payment({
      destination: TEST_KP.publicKey(),
      asset: SdkAsset.native(),
      amount: '1',
    }),
    2,
  );
}

/** XDR d'une FeeBumpTransaction enveloppant une tx payment (opération interdite). */
function xdrFeeBumpPayment(): string {
  const account = new Account(TEST_KP.publicKey(), '103');
  const inner = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.PUBLIC })
    .addOperation(
      Operation.payment({
        destination: TEST_KP.publicKey(),
        asset: SdkAsset.native(),
        amount: '1',
      }),
    )
    .setTimeout(30)
    .build();
  inner.sign(TEST_KP);

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    TEST_KP.publicKey(),
    '200',
    inner,
    Networks.PUBLIC,
  );
  feeBump.sign(TEST_KP);
  return feeBump.toXDR();
}

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
    route: 'BLND → USDC',
    gasFeeXlm: 0,
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

  it('xbull → BLND → USDC', () => {
    expect(routeLabel('xbull', 'USDC')).toBe('BLND → USDC');
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

  return {
    fetchJson,
    makeSoroswap,
    simulateComet: vi.fn(async () => opts.cometOut ?? null),
    simulateXbullNet: vi.fn(async () => null),
    makeRpc: () => ({
      send: async () => { throw new Error('makeRpc.send() not stubbed'); },
      status: async () => { throw new Error('makeRpc.status() not stubbed'); },
    }),
  };
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

  // ─── StellarBroker floor execution path ──────────────────────────────────────
  // When the user clicks "Execute floor (SDEX)" on a StellarBroker row, the UI
  // calls /api/build with venue:'horizon'. This mirrors doExecuteSbFloor() in app.js.
  // Test (i2a): proves the routing filter — forceVenue:'horizon' eliminates all non-horizon
  // candidates even when xbull would otherwise win. buildHorizon calls Horizon.Server directly
  // (not injected via deps), so the full-build path is validated live; here we verify the filter
  // by checking that when only a horizon candidate exists and the build fails (no live Horizon in
  // CI), the error is 'no-route' from horizon's build — not xbull (which was filtered out).
  it('(i2a) SB floor: forceVenue:horizon → seuls les candidats horizon retenus (xbull filtré)', async () => {
    // xbull has a much higher net quote, but must be filtered out by forceVenue:'horizon'.
    // quoteHorizon returns null (Horizon URL not reachable in CI) → no candidates after filter → no-route.
    await expect(
      pickExecutableVenue(
        'USDC',
        1000_0000000n,
        SENDER,
        50,
        CFG,
        undefined,
        fakeDeps({
          xbullQuote: { toAmount: '500000000', route: 'uuid-xbull' }, // high net, but filtered by forceVenue
          xbullAccept: { id: 'id1', xdr: 'xdr-xbull', type: 'full' },
          soroQuote: null,
        }),
        'horizon', // forceVenue: SDEX strict-send (SB floor path)
      ),
    ).rejects.toMatchObject({ code: 'no-route' });
    // If xbull were not filtered, it would succeed (xbullAccept is valid). The no-route proves
    // that forceVenue:'horizon' correctly excludes xbull and relies on horizon-only candidates.
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

  // ─── leg2 composite USDC → EURC ──────────────────────────────────────────────

  it('(leg2) USDC→EURC : assetIn=USDC.sac, Comet exclu, route commence par USDC', async () => {
    // xBull gagne sur la paire USDC→EURC.
    const netOut = 9_8000000n; // 9.8 EURC pour 10 USDC
    const deps = fakeDeps({
      xbullQuote: { toAmount: netOut.toString(), route: 'uuid-leg2' },
      xbullAccept: { id: 'leg2-id', xdr: 'xdr-leg2', type: 'full' },
      soroQuote: null,
      cometOut: null,
    });

    const result = await pickExecutableVenue(
      'EURC',
      10_0000000n, // 10 USDC en stroops
      SENDER,
      50,
      CFG,
      undefined,
      deps,
      undefined, // forceVenue
      USDC,      // sellAsset = USDC (leg2)
    );

    // (a) cotation xBull demandée avec assetIn = USDC.sac
    const fetchCalls = (deps.fetchJson as ReturnType<typeof vi.fn>).mock.calls as Array<[string, ...unknown[]]>;
    const quoteUrl = fetchCalls.find((args) => args[0].includes('/swaps/quote'))?.[0] ?? '';
    expect(quoteUrl).toBeTruthy();
    expect(quoteUrl).toContain(USDC.sac);

    // (b) Comet n'est PAS coté (sellAsset ≠ BLND)
    expect((deps.simulateComet as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);

    // (c) build réussi, route commence par USDC
    expect(result.venue).toBe('xbull');
    expect(result.review.route.startsWith('USDC')).toBe(true);
  });
});

describe('submit', () => {
  it('xBull ok → retourne hash', async () => {
    const deps = fakeDeps({ xbullSubmit: { success: true, hash: 'abc123' } });
    const result = await submit('xbull', { id: 'q1', signedXdr: xdrPathPayment() }, { rpcUrl: 'r' }, deps);
    expect(result).toEqual({ hash: 'abc123' });
  });

  it('xBull success:false → ExecError down', async () => {
    const deps = fakeDeps({ xbullSubmit: { success: false, hash: '' } });
    await expect(
      submit('xbull', { id: 'q1', signedXdr: xdrPathPayment() }, { rpcUrl: 'r' }, deps),
    ).rejects.toMatchObject({ code: 'down' });
  });

  it('soroswap ok → retourne txHash', async () => {
    const deps = fakeDeps({ soroSend: { txHash: 'def456', success: true } });
    const result = await submit(
      'soroswap',
      { signedXdr: xdrPathPayment() },
      { rpcUrl: 'r', soroswapApiKey: 'k' },
      deps,
    );
    expect(result).toEqual({ hash: 'def456' });
  });

  it('soroswap success:false → ExecError down', async () => {
    const deps = fakeDeps({ soroSend: { txHash: 'x', success: false } });
    await expect(
      submit('soroswap', { signedXdr: xdrPathPayment() }, { rpcUrl: 'r', soroswapApiKey: 'k' }, deps),
    ).rejects.toMatchObject({ code: 'down' });
  });

  it('soroswap send() lève → ExecError classé (jamais un 500 opaque post-signature)', async () => {
    const deps = fakeDeps({ soroSend: new Error('missing trustline for asset') });
    await expect(
      submit('soroswap', { signedXdr: xdrPathPayment() }, { rpcUrl: 'r', soroswapApiKey: 'k' }, deps),
    ).rejects.toMatchObject({ name: 'ExecError', code: 'trustline' });
  });
});

// ─── assertAllowedOps (via submit) ───────────────────────────────────────────

describe('assertAllowedOps (defense-in-depth)', () => {
  // Pour les cas rejetés, aucun dep réseau ne doit être sollicité.
  // fakeDeps() sans option ne stubera rien de réseau réel.
  const depsNoNet = fakeDeps({});

  it('pathPaymentStrictSend → passe la validation', async () => {
    // submit xbull : retournera un hash si assertAllowedOps ne rejette pas
    const deps = fakeDeps({ xbullSubmit: { success: true, hash: 'ok-path' } });
    const result = await submit('xbull', { id: 'q1', signedXdr: xdrPathPayment() }, { rpcUrl: 'r' }, deps);
    expect(result.hash).toBe('ok-path');
  });

  it('changeTrust → passe la validation', async () => {
    const deps = fakeDeps({ xbullSubmit: { success: true, hash: 'ok-trust' } });
    const result = await submit('xbull', { id: 'q2', signedXdr: xdrChangeTrust() }, { rpcUrl: 'r' }, deps);
    expect(result.hash).toBe('ok-trust');
  });

  it('payment (op interdite) → rejeté ExecError bad_request, message contient le type', async () => {
    await expect(
      submit('xbull', { id: 'q3', signedXdr: xdrPayment() }, { rpcUrl: 'r' }, depsNoNet),
    ).rejects.toMatchObject({ code: 'bad_request', message: expect.stringContaining('payment') });
  });

  it("payment (op interdite) → aucun appel réseau n'a lieu", async () => {
    const deps = fakeDeps({});
    await expect(
      submit('xbull', { id: 'q4', signedXdr: xdrPayment() }, { rpcUrl: 'r' }, deps),
    ).rejects.toMatchObject({ code: 'bad_request' });
    // fetchJson ne doit pas avoir été appelé
    expect((deps.fetchJson as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('XDR malformé → rejeté ExecError bad_request "XDR illisible"', async () => {
    await expect(
      submit('xbull', { id: 'q5', signedXdr: 'ceci-n-est-pas-un-xdr' }, { rpcUrl: 'r' }, depsNoNet),
    ).rejects.toMatchObject({ code: 'bad_request', message: 'XDR illisible' });
  });

  it('FeeBumpTransaction enveloppant une op interdite → rejeté ExecError bad_request', async () => {
    await expect(
      submit('xbull', { id: 'q6', signedXdr: xdrFeeBumpPayment() }, { rpcUrl: 'r' }, depsNoNet),
    ).rejects.toMatchObject({ code: 'bad_request', message: expect.stringContaining('payment') });
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

  it('reconcileLegSends → over-send (sum > total) : résidu négatif réduit la plus grande jambe à ≤ 0 → throw no-route', () => {
    // sends sum = 1100, total = 1000 → residual = -100 → largest leg (600) becomes 500, OK
    // To trigger the throw: sends sum = total + largest, so largest becomes 0 after residual applied.
    // sends = [1000, 1000], total = 1000 → residual = -1000 → largest (1000 at index 0) → out[0] = 0 → throw
    expect(() => reconcileLegSends([toStroops(1000), toStroops(1000)], toStroops(1000))).toThrow(ExecError);
    expect(() => reconcileLegSends([toStroops(1000), toStroops(1000)], toStroops(1000))).toThrow(
      expect.objectContaining({ code: 'no-route' }),
    );
  });

  it('assertAllowedOps (via submit) → tx sans opération → rejeté ExecError bad_request', async () => {
    // Build a transaction with no operations by removing the only operation via low-level XDR manipulation.
    // Easiest: build a valid tx and produce a "zero ops" XDR by constructing one directly.
    // We use xdrPayment() as a base but need a tx with ops.length === 0.
    // Build it via TransactionBuilder manually with no addOperation calls — not allowed by SDK directly,
    // so we build a tx and strip operations via XDR.
    const { xdr } = await import('@stellar/stellar-sdk');
    const account = new Account(TEST_KP.publicKey(), '200');
    const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.PUBLIC })
      .addOperation(Operation.payment({ destination: TEST_KP.publicKey(), asset: SdkAsset.native(), amount: '1' }))
      .setTimeout(30)
      .build();
    // Strip operations from the envelope XDR directly
    const envelope = tx.toEnvelope();
    const innerTx = envelope.v1().tx();
    innerTx.operations([]);
    tx.sign(TEST_KP);
    const emptyOpsXdr = envelope.toXDR('base64');

    await expect(
      submit('xbull', { id: 'q-empty', signedXdr: emptyOpsXdr }, { rpcUrl: 'r' }, fakeDeps({})),
    ).rejects.toMatchObject({ code: 'bad_request', message: expect.stringContaining('sans opération') });
  });

  it('assertAllowedOps (via submit) → invokeHostFunction (Soroban) → passe la validation', async () => {
    // Build a real invokeHostFunction XDR using the Stellar SDK
    const { xdr: sdkXdr, Address } = await import('@stellar/stellar-sdk');
    const func = sdkXdr.HostFunction.hostFunctionTypeInvokeContract(
      new sdkXdr.InvokeContractArgs({
        contractAddress: new Address('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM').toScAddress(),
        functionName: 'swap',
        args: [],
      }),
    );
    const invokeXdr = buildSignedXdr(Operation.invokeHostFunction({ func, auth: [] }), 10);
    const deps = fakeDeps({ xbullSubmit: { success: true, hash: 'invoke-ok' } });
    const result = await submit('xbull', { id: 'q-invoke', signedXdr: invokeXdr }, { rpcUrl: 'r' }, deps);
    expect(result.hash).toBe('invoke-ok');
  });
});

// ─── minReceivedStroops — borne haute ────────────────────────────────────────

describe('minReceivedStroops — borne haute', () => {
  it('9999 bps : valeur limite haute valide (ne throw pas)', () => {
    // slippageBps = 9999 is valid (< 10000); result = net * 1 / 10000
    expect(() => minReceivedStroops(100_0000000n, 9999)).not.toThrow();
    expect(minReceivedStroops(100_0000000n, 9999)).toBe(100000n); // 100 * 1/10000 = 0.01 USDC in stroops
  });
});

// ─── submit Soroban : fire-and-poll ──────────────────────────────────────────
describe('submit (Soroban fire-and-poll)', () => {
  type StatusFn = (_hash: string) => Promise<{ status: 'SUCCESS' | 'NOT_FOUND' | 'FAILED' }>;
  const rpcDeps = (
    send: { status: SendStatus; hash: string; errorResult?: unknown },
    statusFn?: StatusFn,
  ): Partial<ExecDeps> => ({
    makeRpc: () => ({
      send: async () => send,
      status: statusFn ?? (async () => { throw new Error('status() ne doit PAS être appelé au submit (fire-and-poll)'); }),
    }),
  });

  it('aquarius PENDING → FIRE et rend {hash,status:pending} sans poller la confirmation', async () => {
    let statusCalled = false;
    const statusFn: StatusFn = async () => { statusCalled = true; return { status: 'SUCCESS' }; };
    const result = await submit('aquarius', { signedXdr: xdrPathPayment() }, { rpcUrl: 'r' },
      rpcDeps({ status: 'PENDING', hash: 'deadbeef' }, statusFn));
    expect(result).toEqual({ hash: 'deadbeef', status: 'pending' });
    expect(statusCalled).toBe(false);
  });

  it('comet DUPLICATE → traité comme fired (pending)', async () => {
    const result = await submit('comet', { signedXdr: xdrPathPayment() }, { rpcUrl: 'r' },
      rpcDeps({ status: 'DUPLICATE', hash: 'abc123' }));
    expect(result).toEqual({ hash: 'abc123', status: 'pending' });
  });

  it('ERROR → ExecError (down)', async () => {
    await expect(
      submit('aquarius', { signedXdr: xdrPathPayment() }, { rpcUrl: 'r' },
        rpcDeps({ status: 'ERROR', hash: '', errorResult: { x: 1 } })),
    ).rejects.toThrow(ExecError);
  });

  it('TRY_AGAIN_LATER → ExecError (down)', async () => {
    await expect(
      submit('comet', { signedXdr: xdrPathPayment() }, { rpcUrl: 'r' },
        rpcDeps({ status: 'TRY_AGAIN_LATER', hash: '' })),
    ).rejects.toThrow(ExecError);
  });
});

// ─── txStatus : mapping getTransaction → success/failed/pending ───────────────
describe('txStatus', () => {
  const mk = (s: 'SUCCESS' | 'NOT_FOUND' | 'FAILED'): Partial<ExecDeps> => ({
    makeRpc: () => ({ send: async () => ({ status: 'PENDING' as const, hash: '' }), status: async () => ({ status: s }) }),
  });
  it('SUCCESS → success', async () => expect(await txStatus('h', { rpcUrl: 'r' }, mk('SUCCESS'))).toEqual({ status: 'success' }));
  it('FAILED → failed', async () => expect(await txStatus('h', { rpcUrl: 'r' }, mk('FAILED'))).toEqual({ status: 'failed' }));
  it('NOT_FOUND → pending', async () => expect(await txStatus('h', { rpcUrl: 'r' }, mk('NOT_FOUND'))).toEqual({ status: 'pending' }));
  it('RPC error → pending (re-poll, pas un échec)', async () => {
    const deps: Partial<ExecDeps> = { makeRpc: () => ({ send: async () => ({ status: 'PENDING' as const, hash: '' }), status: async () => { throw new Error('rpc down'); } }) };
    expect(await txStatus('h', { rpcUrl: 'r' }, deps)).toEqual({ status: 'pending' });
  });
});

// ─── feeExceedsSpendable ─────────────────────────────────────────────────────
// Account: 5.1224040 XLM (51224040 stroops), 3 subentries
// Reserve  = (2+3) × 5_000_000 = 25_000_000 stroops (2.5 XLM)
// Spendable = 51224040 − 25000000 = 26224040 stroops (≈ 2.62 XLM)

describe('feeExceedsSpendable', () => {
  const NATIVE = 51_224_040; // 5.1224040 XLM
  const SUBS   = 3;

  it('max_fee 3.76 XLM (37600000 stroops) exceeds spendable → exceeds: true', () => {
    const { exceeds, spendableStroops } = feeExceedsSpendable(37_600_000, NATIVE, SUBS);
    expect(exceeds).toBe(true);
    expect(spendableStroops).toBe(26_224_040);
  });

  it('max_fee 0.11 XLM (1100000 stroops) fits → exceeds: false', () => {
    const { exceeds, spendableStroops } = feeExceedsSpendable(1_100_000, NATIVE, SUBS);
    expect(exceeds).toBe(false);
    expect(spendableStroops).toBe(26_224_040);
  });

  it('account below reserve → spendableStroops clamped to 0, any fee exceeds', () => {
    // 1.0 XLM native, 3 subentries → reserve 2.5 XLM → raw spendable negative → clamped to 0
    // Any fee > 0 therefore exceeds the clamped spendable
    const { exceeds, spendableStroops } = feeExceedsSpendable(100, 10_000_000, SUBS);
    expect(spendableStroops).toBe(0);
    expect(exceeds).toBe(true);
  });

  it('exact match (max_fee == spendable) → exceeds: false', () => {
    // 26224040 stroops fee == 26224040 spendable → not strictly greater
    const { exceeds } = feeExceedsSpendable(26_224_040, NATIVE, SUBS);
    expect(exceeds).toBe(false);
  });

  it('max_fee one stroop over spendable → exceeds: true', () => {
    const { exceeds } = feeExceedsSpendable(26_224_041, NATIVE, SUBS);
    expect(exceeds).toBe(true);
  });
});

// ─── simulateStellarBrokerNet ─────────────────────────────────────────────────

describe('simulateStellarBrokerNet', () => {
  const SB_ROUTER = 'CBWP275BNGLHWFTQVB6QHA67MLX7WTX6YZ5LNSUVOK7W2TMKWX7OPYOJ';
  const WITNESS = 'GCA34HBKNLWN3AOXWBRW5Y3HSGHCWF3UDBRJ5YHGU6HWGJZEPO2NSXI3';
  const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
  const EURC_ISSUER = 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2';

  /** Minimal Soroban XDR: one invokeHostFunction op on the SB router. */
  function makeSorobanXdr(): string {
    const account = new Account(WITNESS, '100');
    const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: Networks.PUBLIC })
      .addOperation(new Contract(SB_ROUTER).call('swap'))
      .setTimeout(120)
      .build();
    return tx.toXDR();
  }

  /** Classic pathPaymentStrictSend XDR (fee or trader leg). */
  function makeClassicXdr(destination: string, destMin: string): string {
    const account = new Account(WITNESS, '100');
    const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.PUBLIC })
      .addOperation(Operation.pathPaymentStrictSend({
        sendAsset: new SdkAsset('USDC', USDC_ISSUER),
        sendAmount: '1000',
        destination,
        destAsset: new SdkAsset('EURC', EURC_ISSUER),
        destMin,
        path: [],
      }))
      .setTimeout(180)
      .build();
    return tx.toXDR();
  }

  /** Fake RPC that returns a known retval: [amountIn, amountOut, 0n] as i128 vec. */
  function makeFakeRpc(amountOut: bigint) {
    return {
      async simulateTransaction(_tx: unknown) {
        return { result: { retval: nativeToScVal([10_000_0000000n, amountOut, 0n]) } };
      },
    };
  }

  // REAL captured StellarBroker swap tx (public on-chain data, not a secret), copied verbatim
  // from spike/sb-mediator/fixtures/blnd-usdc-5000-0.xdr. Exercises the genuine decode path:
  // fromXDR → invokeHostFunction func extraction → empty-auth rebuild → simulateTransaction.
  const REAL_SB_SOROBAN_XDR =
    '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';

  it('returns retval[1] from a Soroban invokeHostFunction XDR', async () => {
    const result = await simulateStellarBrokerNet({
      sellAsset: BLND, buyAsset: USDC,
      amountIn: 5000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [makeSorobanXdr()],
      _rpcServer: makeFakeRpc(100_0000000n),
    });
    expect(result).not.toBeNull();
    expect(result!.net).toBe(100_0000000n);
    expect(result!.exact).toBe(true); // all-Soroban burst → observed
    expect(result!.route).toContain('BLND');
    expect(result!.route).toContain('USDC');
  });

  it('sums two Soroban legs across two separate XDRs', async () => {
    let callCount = 0;
    const fakeRpc = {
      async simulateTransaction(_tx: unknown) {
        callCount++;
        const out = callCount === 1 ? 60_0000000n : 40_0000000n;
        return { result: { retval: nativeToScVal([5000_0000000n, out, 0n]) } };
      },
    };
    const result = await simulateStellarBrokerNet({
      sellAsset: BLND, buyAsset: USDC,
      amountIn: 5000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [makeSorobanXdr(), makeSorobanXdr()],
      _rpcServer: fakeRpc,
    });
    expect(result).not.toBeNull();
    expect(result!.net).toBe(100_0000000n); // 60 + 40
    expect(result!.exact).toBe(true); // both legs Soroban → observed
  });

  it('excludes fee-account classic XDR, adds destMin from trader classic XDR, and is NOT exact', async () => {
    const neverCalled = { async simulateTransaction(): Promise<never> { throw new Error('should not be called'); } };
    const result = await simulateStellarBrokerNet({
      sellAsset: USDC, buyAsset: EURC,
      amountIn: 1000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [
        makeClassicXdr(SB_FEE_ACCOUNT, '0.0001'), // fee leg → excluded
        makeClassicXdr(WITNESS, '879.1223392'),    // trader leg → add destMin (a floor)
      ],
      _rpcServer: neverCalled,
      // Simulate Horizon unavailable → fallback to destMin floor (tests the non-exact path)
      _quoteHorizon: async () => null,
    });
    expect(result).not.toBeNull();
    // 879.1223392 × 10^7 = 8_791_223_392 stroops
    expect(result!.net).toBe(8_791_223_392n);
    // destMin is a slippage floor, never an observed fill → must NOT be labelled exact
    expect(result!.exact).toBe(false);
  });

  it('returns null when all Soroban sims error (isSimulationError)', async () => {
    const failRpc = { async simulateTransaction(_tx: unknown) { return { error: 'failed' }; } };
    const result = await simulateStellarBrokerNet({
      sellAsset: BLND, buyAsset: USDC,
      amountIn: 5000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [makeSorobanXdr()],
      _rpcServer: failRpc,
    });
    expect(result).toBeNull();
  });

  it('returns null when _capturedXdrs is empty', async () => {
    const result = await simulateStellarBrokerNet({
      sellAsset: BLND, buyAsset: USDC,
      amountIn: 5000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [],
      _rpcServer: { async simulateTransaction() { return {}; } },
    });
    expect(result).toBeNull();
  });

  it('decodes a REAL captured SB Soroban XDR and returns retval[1], exact=true', async () => {
    // Real fixture → genuine fromXDR + invokeHostFunction func extraction + empty-auth rebuild.
    // RPC injected so the assertion targets the decode path, not network behaviour.
    const result = await simulateStellarBrokerNet({
      sellAsset: BLND, buyAsset: USDC,
      amountIn: 5000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [REAL_SB_SOROBAN_XDR],
      _rpcServer: makeFakeRpc(201_9641968n), // retval[1] = simulated fill
    });
    expect(result).not.toBeNull();
    expect(result!.net).toBe(201_9641968n);
    expect(result!.exact).toBe(true);
    expect(result!.route).toEqual(['BLND', 'USDC']);
  });

  it('mixes a REAL Soroban leg with classic legs: sums trader destMin, excludes fee leg, exact=false', async () => {
    // Real Soroban leg (sim → 100) + classic trader leg (destMin 50, a floor) + classic fee leg (excluded).
    // _quoteHorizon returns null → fallback to destMin (tests the non-exact fallback path).
    const result = await simulateStellarBrokerNet({
      sellAsset: USDC, buyAsset: EURC,
      amountIn: 1000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [
        REAL_SB_SOROBAN_XDR,                  // Soroban leg → sim retval[1] = 100
        makeClassicXdr(SB_FEE_ACCOUNT, '0.0001'), // fee leg → excluded
        makeClassicXdr(WITNESS, '50.0'),          // trader leg → destMin 50 added
      ],
      _rpcServer: makeFakeRpc(100_0000000n),
      // Horizon unavailable → destMin fallback ensures exact=false
      _quoteHorizon: async () => null,
    });
    expect(result).not.toBeNull();
    // 100 (Soroban sim) + 50 (trader destMin); fee leg excluded
    expect(result!.net).toBe(150_0000000n);
    // a classic destMin floor contributed → cannot be labelled observed
    expect(result!.exact).toBe(false);
  });

  // ─── P1: classic legs observed via Horizon strict-send ───────────────────────

  it('P1: mixed burst (Soroban + classic) with Horizon fill → sums real fills, exact=true', async () => {
    // Soroban leg observed via RPC sim; classic trader leg observed via Horizon strict-send.
    // No classic destMin floor ever summed → exact stays true.
    const sorobanFill = 100_0000000n;
    const horizonFill = 900_0000000n;
    const result = await simulateStellarBrokerNet({
      sellAsset: USDC, buyAsset: EURC,
      amountIn: 1000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [
        makeSorobanXdr(),                       // Soroban leg → retval[1] = sorobanFill
        makeClassicXdr(SB_FEE_ACCOUNT, '0.0001'), // fee leg → excluded
        makeClassicXdr(WITNESS, '879.1223392'), // trader leg → real fill from Horizon
      ],
      _rpcServer: makeFakeRpc(sorobanFill),
      // Horizon returns a real observed fill for the classic trader leg
      _quoteHorizon: async () => ({ venue: 'horizon' as const, netOut: horizonFill, path: [] }),
    });
    expect(result).not.toBeNull();
    // net = Soroban fill + Horizon fill (fee leg excluded; destMin floor never summed)
    expect(result!.net).toBe(sorobanFill + horizonFill);
    // All legs observed (Soroban recording-mode sim + Horizon strict-send) → exact
    expect(result!.exact).toBe(true);
  });

  it('P1: mixed burst with Horizon failure falls back to destMin floor → exact=false', async () => {
    // Soroban leg observed; classic trader leg: Horizon returns null → destMin floor used.
    // Honesty invariant: any destMin contribution forces exact=false.
    const sorobanFill = 100_0000000n;
    const destMinStroops = 8_791_223_392n; // '879.1223392' × 10^7
    const result = await simulateStellarBrokerNet({
      sellAsset: USDC, buyAsset: EURC,
      amountIn: 1000_0000000n, slippageBps: 50,
      apiKey: 'test', rpcUrl: 'https://rpc.test',
      _capturedXdrs: [
        makeSorobanXdr(),                       // Soroban leg → retval[1] = sorobanFill
        makeClassicXdr(SB_FEE_ACCOUNT, '0.0001'), // fee leg → excluded
        makeClassicXdr(WITNESS, '879.1223392'), // trader leg → Horizon fails → destMin floor
      ],
      _rpcServer: makeFakeRpc(sorobanFill),
      // Horizon unavailable: classic leg falls back to destMin (a floor, not an observed fill)
      _quoteHorizon: async () => null,
    });
    expect(result).not.toBeNull();
    // net = Soroban fill + destMin floor (conservative lower bound)
    expect(result!.net).toBe(sorobanFill + destMinStroops);
    // destMin floor contributed → cannot be labelled observed
    expect(result!.exact).toBe(false);
  });
});
