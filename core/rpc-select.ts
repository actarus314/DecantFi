// Sélection du meilleur RPC au démarrage d'un tick : sonde tous les endpoints en parallèle,
// choisit le plus rapide non-retardé, repli sur le moins mauvais, best-effort sur urls[0].
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

// ponytail: tolérance = 2 ledgers (~10 s) ; upgrade si on sonde ≥3 RPCs avec des décalages > 2.
const LEDGER_LAG_TOLERANCE = 2;
// ponytail: seuil lenteur = 2500 ms ; baisser si la cadence de tick est très serrée.
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
    // Tout en échec : best-effort = urls[0]
    return { chosen: urls[0]!, probes };
  }

  const maxLedger = Math.max(...okProbes.map((p) => p.ledger!));

  // Premier URL (dans l'ordre de urls) qui est ok, pas trop retardé et pas trop lent.
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

  // Repli : ok probe avec le ledger le plus haut (tie-break: latence la plus basse)
  const best = okProbes.reduce((a, b) =>
    b.ledger! > a.ledger! || (b.ledger === a.ledger && b.latencyMs! < a.latencyMs!) ? b : a,
  );
  return { chosen: best.url, probes };
}
