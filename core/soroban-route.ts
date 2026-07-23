// Decoding and verification of Soroban routes from simulation events.
// Two topologies observed empirically:
//   - Hub-and-spoke (xBull, Aquarius): central router, each hop = 2 identical transfers.
//   - Linear (Soroswap): direct pool-to-pool, each intermediate asset appears only once.
import { bySac } from './assets.js';

export interface Transfer {
  asset: string;
  from: string;
  to: string;
  amount: bigint;
}

/** Decodes the SAC transfer chain from Soroban simulation events.
 *  Accepts base64 events (string) or already-parsed DiagnosticEvent objects.
 *  Unreadable events are silently ignored. */
export async function decodeTransfers(events: unknown[]): Promise<Transfer[]> {
  const { scValToNative, StrKey, xdr } = await import('@stellar/stellar-sdk');
  const transfers: Transfer[] = [];

  for (const ev of events) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let e: any = ev;
      if (typeof e === 'string') e = xdr.DiagnosticEvent.fromXDR(e, 'base64');
      const ce = e.event ? e.event() : e;
      const cid = ce.contractId ? StrKey.encodeContract(ce.contractId()) : '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topics = ce.body().v0().topics().map((t: any) => {
        try { return scValToNative(t); } catch { return null; }
      });
      if (topics[0] !== 'transfer' || !cid) continue;

      const asset = bySac(cid)?.symbol ?? (cid.slice(0, 4) + '…' + cid.slice(-4));
      const from = String(topics[1] ?? '');
      const to = String(topics[2] ?? '');
      let amount = 0n;
      try {
        amount = BigInt(scValToNative(ce.body().v0().data()));
      } catch { /* unreadable amount -> 0n */ }

      transfers.push({ asset, from, to, amount });
    } catch { /* unreadable event ignored */ }
  }

  return transfers;
}

/** Builds the deduplicated (consecutive) route from the transfer list.
 *  Hub-spoke [BLND,BLND,USDC,USDC,XLM,XLM,EURC,EURC] -> [BLND,USDC,XLM,EURC].
 *  Linear [BLND,USDC,EURC] -> [BLND,USDC,EURC]. */
export function routeFromTransfers(transfers: Transfer[]): string[] {
  const route: string[] = [];
  for (const t of transfers) {
    if (route[route.length - 1] !== t.asset) route.push(t.asset);
  }
  return route;
}

/** Verifies that the transfer chain is coherent from the signer's point of view.
 *  The signer account (= transfers[0].from) must net ONLY -sellSymbol and +buySymbol,
 *  nothing else. An intermediate asset captured by the signer betrays an inconsistent route.
 *
 *  Note: conservation of intermediate assets across contracts is guaranteed by
 *  construction (each transfer credits AND debits), so asserting on the signer alone is enough. */
export function verifyChain(
  transfers: Transfer[],
  sellSymbol: string,
  buySymbol: string,
): { chained: boolean; reason?: string } {
  if (transfers.length < 2) return { chained: false, reason: 'transferts insuffisants' };

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sender = transfers[0]!.from;

  // Computes the net per asset from the signer's point of view.
  const net = new Map<string, bigint>();
  for (const t of transfers) {
    if (t.to === sender) {
      net.set(t.asset, (net.get(t.asset) ?? 0n) + t.amount);
    }
    if (t.from === sender) {
      net.set(t.asset, (net.get(t.asset) ?? 0n) - t.amount);
    }
  }

  for (const [asset, v] of net) {
    if (asset === sellSymbol) {
      if (v >= 0n) return { chained: false, reason: `actif d'entrée ${asset} non débité du signataire` };
    } else if (asset === buySymbol) {
      if (v <= 0n) return { chained: false, reason: `actif de sortie ${asset} non crédité au signataire` };
    } else if (v !== 0n) {
      return { chained: false, reason: `le signataire a reçu/envoyé l'intermédiaire ${asset} (net ${v}) — route incohérente` };
    }
  }

  if (!net.has(sellSymbol) || !net.has(buySymbol)) {
    return { chained: false, reason: "entrée ou sortie absente du flux" };
  }

  return { chained: true };
}
