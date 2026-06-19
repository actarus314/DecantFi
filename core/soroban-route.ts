// Décodage et vérification des routes Soroban à partir des événements de simulation.
// Deux topologies observées empiriquement :
//   - Hub-and-spoke (xBull, Aquarius) : routeur central, chaque hop = 2 transferts identiques.
//   - Linéaire (Soroswap) : pool→pool direct, chaque actif intermédiaire apparaît une seule fois.
import { bySac } from './assets.js';

export interface Transfer {
  asset: string;
  from: string;
  to: string;
  amount: bigint;
}

/** Décode la chaîne de transferts SAC depuis les événements de simulation Soroban.
 *  Accepte des events base64 (string) ou des objets DiagnosticEvent déjà parsés.
 *  Les events illisibles sont ignorés silencieusement. */
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
      } catch { /* montant illisible → 0n */ }

      transfers.push({ asset, from, to, amount });
    } catch { /* event illisible ignoré */ }
  }

  return transfers;
}

/** Construit la route dédupliquée (consécutive) depuis la liste de transferts.
 *  Hub-spoke [BLND,BLND,USDC,USDC,XLM,XLM,EURC,EURC] → [BLND,USDC,XLM,EURC].
 *  Linéaire [BLND,USDC,EURC] → [BLND,USDC,EURC]. */
export function routeFromTransfers(transfers: Transfer[]): string[] {
  const route: string[] = [];
  for (const t of transfers) {
    if (route[route.length - 1] !== t.asset) route.push(t.asset);
  }
  return route;
}

/** Vérifie que la chaîne de transferts est cohérente du point de vue du signataire.
 *  Le compte signataire (= transfers[0].from) ne doit netter QUE −sellSymbol et +buySymbol,
 *  rien d'autre. Un actif intermédiaire capté par le signataire trahit une route incohérente.
 *
 *  Note : la conservation des actifs intermédiaires chez les contrats est garantie par
 *  construction (chaque transfert crédite ET débite), donc l'assertion sur le signataire seul suffit. */
export function verifyChain(
  transfers: Transfer[],
  sellSymbol: string,
  buySymbol: string,
): { chained: boolean; reason?: string } {
  if (transfers.length < 2) return { chained: false, reason: 'transferts insuffisants' };

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sender = transfers[0]!.from;

  // Calcul du net par actif du point de vue du signataire.
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
