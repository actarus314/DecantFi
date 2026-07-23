// Selects the best RPC at the start of a tick: probes all endpoints in parallel,
// picks the fastest non-lagging one, falls back to the least bad, best-effort on urls[0].
import { rpc } from '@stellar/stellar-sdk';
import { bumpRpc } from './rpc-meter.js';

export interface RpcProbe {
  url: string;
  ok: boolean;
  latencyMs: number | null;
  ledger: number | null;
  error: string | null;
}

export interface RpcSelection {
  chosen: string;
  probes: RpcProbe[];
}

// ponytail: tolerance = 2 ledgers (~10s); upgrade if probing >=3 RPCs with lags > 2.
const LEDGER_LAG_TOLERANCE = 2;
// ponytail: slowness threshold = 2500ms; lower if the tick cadence is very tight.
const SLOW_LATENCY_MS = 2500;

export async function probeRpc(
  url: string,
  timeoutMs: number,
  deps?: { getLatestLedger?: (url: string) => Promise<number> },
): Promise<RpcProbe> {
  const t0 = Date.now();
  try {
    let ledger: number;
    if (deps?.getLatestLedger) {
      ledger = await deps.getLatestLedger(url);
    } else {
      bumpRpc();
      const server = new rpc.Server(url.replace(/\/$/, ''));
      const timer = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      );
      const result = await Promise.race([server.getLatestLedger(), timer]);
      ledger = result.sequence;
    }
    return { url, ok: true, latencyMs: Date.now() - t0, ledger, error: null };
  } catch (e) {
    return { url, ok: false, latencyMs: Date.now() - t0, ledger: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function selectRpc(
  urls: string[],
  timeoutMs: number,
  deps?: { probeRpc?: typeof probeRpc },
): Promise<RpcSelection> {
  if (urls.length === 0) return { chosen: '', probes: [] };
  if (urls.length === 1) {
    const probe = await (deps?.probeRpc ?? probeRpc)(urls[0]!, timeoutMs);
    return { chosen: urls[0]!, probes: [probe] };
  }

  const probeFn = deps?.probeRpc ?? probeRpc;
  const probes = await Promise.all(urls.map((u) => probeFn(u, timeoutMs)));

  const okProbes = probes.filter((p) => p.ok);
  if (okProbes.length === 0) {
    // All failed: best-effort = urls[0]
    return { chosen: urls[0]!, probes };
  }

  const maxLedger = Math.max(...okProbes.map((p) => p.ledger!));

  // First URL (in urls order) that is ok, not too far behind, and not too slow.
  for (const url of urls) {
    const p = probes.find((x) => x.url === url);
    if (
      p?.ok &&
      p.ledger! >= maxLedger - LEDGER_LAG_TOLERANCE &&
      p.latencyMs! < SLOW_LATENCY_MS
    ) {
      return { chosen: url, probes };
    }
  }

  // Fallback: ok probe with the highest ledger (tie-break: lowest latency)
  const best = okProbes.reduce((a, b) =>
    b.ledger! > a.ledger! || (b.ledger === a.ledger && b.latencyMs! < a.latencyMs!) ? b : a,
  );
  return { chosen: best.url, probes };
}
