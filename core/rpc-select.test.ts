import { describe, it, expect } from 'vitest';
import { selectRpc } from './rpc-select.js';
import type { RpcProbe } from './rpc-select.js';

function makeProbe(url: string, ok: boolean, ledger: number | null, latencyMs: number | null): RpcProbe {
  return { url, ok, ledger, latencyMs, error: ok ? null : 'down' };
}

describe('selectRpc', () => {
  it('tous sains → choisit le premier (primary)', async () => {
    const urls = ['https://primary.rpc', 'https://fallback.rpc'];
    const fakeProbe = async (url: string) => {
      if (url === urls[0]) return makeProbe(url, true, 1000, 100);
      return makeProbe(url, true, 1000, 200);
    };
    const sel = await selectRpc(urls, 5000, { probeRpc: fakeProbe });
    expect(sel.chosen).toBe(urls[0]);
    expect(sel.probes.length).toBe(2);
  });

  it('primary down → choisit fallback', async () => {
    const urls = ['https://primary.rpc', 'https://fallback.rpc'];
    const fakeProbe = async (url: string) => {
      if (url === urls[0]) return makeProbe(url, false, null, 50);
      return makeProbe(url, true, 1000, 200);
    };
    const sel = await selectRpc(urls, 5000, { probeRpc: fakeProbe });
    expect(sel.chosen).toBe(urls[1]);
  });

  it('primary retardé → choisit fallback', async () => {
    const urls = ['https://primary.rpc', 'https://fallback.rpc'];
    const fakeProbe = async (url: string) => {
      if (url === urls[0]) return makeProbe(url, true, 995, 100); // lag = 5 > LEDGER_LAG_TOLERANCE=2
      return makeProbe(url, true, 1000, 200);
    };
    const sel = await selectRpc(urls, 5000, { probeRpc: fakeProbe });
    expect(sel.chosen).toBe(urls[1]);
  });

  it('tous en échec → best-effort sur urls[0]', async () => {
    const urls = ['https://primary.rpc', 'https://fallback.rpc'];
    const fakeProbe = async (url: string) => makeProbe(url, false, null, 50);
    const sel = await selectRpc(urls, 5000, { probeRpc: fakeProbe });
    expect(sel.chosen).toBe(urls[0]);
    expect(sel.probes.every((p) => !p.ok)).toBe(true);
  });
});
