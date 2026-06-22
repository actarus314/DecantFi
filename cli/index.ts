#!/usr/bin/env -S npx tsx
// CLI v1 : recommande la meilleure route nette BLND -> USDC/EURC. Ne signe ni ne soumet RIEN.
//   npm run quote -- 1000 USDC
//   npm run quote -- 1000 EURC --split
//   npm run quote -- 500 USDC --slippage 30 --json
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bySymbol, type Asset } from '../core/assets.js';
import { fromStroops, toStroops } from '../core/amount.js';
import { quote, type EngineConfig, type QuoteResult } from '../core/engine.js';
import type { NormalizedQuote } from '../core/sources/types.js';

interface Args {
  amount: string;
  target: string;
  from: string;
  slippageBps: number;
  json: boolean;
  split: boolean;
  help: boolean;
  balance: boolean;
  balanceAddr: string; // adresse fournie après --balance, ou ''
}

function parseArgs(argv: string[]): Args {
  const a: Args = { amount: '', target: '', from: 'BLND', slippageBps: 50, json: false, split: false, help: false, balance: false, balanceAddr: '' };
  const pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]!;
    if (t === '--json') a.json = true;
    else if (t === '--split') a.split = true;
    else if (t === '--balance') a.balance = true;
    else if (t === '-h' || t === '--help') a.help = true;
    else if (t === '--from') a.from = argv[++i] ?? 'BLND';
    else if (t === '--slippage') a.slippageBps = Number(argv[++i]);
    else pos.push(t);
  }
  if (a.balance) {
    // --balance [G…] <USDC|EURC> ou --balance <USDC|EURC>
    if (pos.length >= 2) {
      a.balanceAddr = pos[0] ?? '';     // premier positionnel = adresse G…
      a.target = pos[1] ?? '';
    } else {
      a.target = pos[0] ?? '';          // rétrocompat : adresse via WALLET_ADDRESS
    }
  } else {
    a.amount = pos[0] ?? '';
    a.target = pos[1] ?? '';
  }
  return a;
}

const HELP = `DecantFi — recommandeur de route nette (read-only, ne signe rien)

Usage:
  npm run quote -- <montant> <USDC|EURC> [options]

Options:
  --from <ASSET>      actif vendu (defaut BLND)
  --slippage <bps>    tolerance en points de base (defaut 50 = 0,5 %)
  --split             ajoute l'analyse de fractionnement (25/50/100 %)
  --balance [G…]      cote la balance BLND live du wallet (adresse optionnelle, sinon WALLET_ADDRESS)
  --json              sortie JSON brute
  -h, --help          cette aide

Exemples:
  npm run quote -- 1000 USDC
  npm run quote -- 1000 EURC --split
`;

/** Charge repo/.env si direnv ne l'a pas deja fait (fallback non fatal). */
function loadEnv(): void {
  try {
    const txt = readFileSync(fileURLToPath(new URL('../.env', import.meta.url)), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = (m[2] ?? '').replace(/^["']|["']$/g, '');
    }
  } catch {
    /* pas de .env : on garde les defauts publics */
  }
}

function routeStr(q: NormalizedQuote): string {
  if (q.route.length === 0) return `${q.sellAsset.symbol}->${q.buyAsset.symbol}`;
  return [q.route[0]!.sell, ...q.route.map((h) => h.buy)].join('->');
}

function deltaStr(q: NormalizedQuote): string {
  // Affiche l'impact LOCAL par défaut (SDEX Stellar) ; si EURC et EVM diffère, append discret.
  const localPct = q.priceImpactLocalPct;
  const evmPct = q.priceImpactPct;
  const fmt = (v: number) => `${v > 0 ? '-' : '+'}${Math.abs(v).toFixed(2)}%`;
  if (localPct !== undefined) {
    const base = fmt(localPct);
    // Pour EURC : si EVM disponible et diffère du local de plus de 0.01%, append "(evm ±x%)"
    if (evmPct !== undefined && q.buyAsset.symbol === 'EURC' && Math.abs(evmPct - localPct) >= 0.01) {
      const diff = evmPct - localPct;
      const sign = diff > 0 ? '+' : '';
      return `${base} (evm ${sign}${diff.toFixed(2)}%)`;
    }
    return base;
  }
  if (evmPct !== undefined) return fmt(evmPct);
  return '—';
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const fmt = (cells: string[]) => cells.map((c, i) => (i <= 1 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');
  return [fmt(headers), ...rows.map(fmt)].join('\n');
}

function renderQuotes(quotes: NormalizedQuote[], target: string): string {
  const rows = quotes.map((q, i) => [
    String(i + 1),
    q.source,
    routeStr(q),
    fromStroops(q.netOut),
    deltaStr(q),
    fromStroops(q.gasInTarget),
    q.netConfidence,
  ]);
  return table(['#', 'source', 'route', `net ${target}`, 'Δspot', 'gas', 'conf'], rows);
}

export function renderText(result: QuoteResult): string {
  const { request: rq, prices, ranking, eurc, split, errors } = result;
  const out: string[] = [];
  out.push(`${rq.sell} → ${rq.buy} · ${fromStroops(rq.amountIn)} ${rq.sell} · slippage ${(rq.slippageBps / 100).toFixed(2)}%`);
  const p = (v: number | null, s = '$') => (v == null ? '?' : `${parseFloat(v.toPrecision(4))}${s}`);
  out.push(`spot BLND ~${p(prices.blndUsd)} · XLM ~${p(prices.xlmUsd)} · EURC/USD ~${p(prices.eurcUsd, '')} · EURC@Stellar ~${p(prices.eurcStellarMid, '')}`);
  out.push('');

  if (ranking.ranked.length === 0 && !eurc) {
    out.push('Aucune cotation disponible.');
  } else {
    if (ranking.ranked.length > 0) {
      if (eurc) out.push(`Sources directes ${rq.sell}→${rq.buy} :`);
      out.push(renderQuotes(ranking.ranked, rq.buy));
      out.push('');
    }

    // Recommandation autoritaire : pour EURC, le meilleur entre direct et via-USDC (design §4).
    let headlineNet: bigint | undefined;
    if (eurc) {
      if (eurc.winner === 'via-usdc' && eurc.viaUsdc) {
        headlineNet = eurc.viaUsdc.netEurc;
        out.push(`➜ Meilleur net : ${fromStroops(eurc.viaUsdc.netEurc)} EURC via via-USDC (2 tx)`);
      } else if (eurc.winner === 'direct' && eurc.direct) {
        headlineNet = eurc.direct.netOut;
        out.push(`➜ Meilleur net : ${fromStroops(eurc.direct.netOut)} EURC via ${eurc.direct.source} (${routeStr(eurc.direct)}, 1 tx)`);
      } else {
        out.push('Aucune route EURC trouvee.');
      }
    } else if (ranking.best) {
      const best = ranking.best;
      headlineNet = best.netOut;
      out.push(`➜ Meilleur net : ${fromStroops(best.netOut)} ${rq.buy} via ${best.source} (${routeStr(best)})`);
      if (best.netConfidence === 'floor' && best.netRange) {
        out.push(`  (plancher ; potentiel jusqu'a ${fromStroops(best.netRange.high)} ${rq.buy} si fee faible)`);
      }
    }

    if (ranking.floor && headlineNet !== undefined && ranking.floor.netOut > 0n && ranking.floor.netOut !== headlineNet) {
      const gain = ((Number(headlineNet) - Number(ranking.floor.netOut)) / Number(ranking.floor.netOut)) * 100;
      out.push(`  Plancher Horizon : ${fromStroops(ranking.floor.netOut)} ${rq.buy} → agrégateurs +${gain.toFixed(1)}%`);
    }
  }

  if (eurc) {
    out.push('');
    out.push('— EURC : direct vs via-USDC —');
    out.push(
      eurc.direct
        ? `  direct   : ${fromStroops(eurc.direct.netOut)} EURC via ${eurc.direct.source} (1 tx)`
        : '  direct   : aucune route',
    );
    if (eurc.viaUsdc) {
      out.push(
        `  via-USDC : ${fromStroops(eurc.viaUsdc.netEurc)} EURC ` +
          `(${fromStroops(eurc.viaUsdc.usdcMid)} USDC via ${eurc.viaUsdc.leg1.source}, ` +
          `puis EURC via ${eurc.viaUsdc.leg2.source}) — 2 tx`,
      );
    } else out.push('  via-USDC : aucune route');
    if (eurc.winner) out.push(`  ➜ ${eurc.note}`);
  }

  if (split) {
    out.push('');
    out.push('— fractionnement —');
    for (const pt of split.points) {
      const net = pt.netOut !== undefined ? `${fromStroops(pt.netOut)} ${rq.buy}` : 'n/a';
      out.push(`  ${String(pt.fractionPct).padStart(3)}% (${fromStroops(pt.amountIn)} ${rq.sell}) → ${net}`);
    }
    out.push(`  ${split.note}`);
  }

  if (errors.length > 0) {
    out.push('');
    out.push(`(sources sans cotation : ${errors.join(', ')})`);
  }
  return out.join('\n');
}

function jsonReplacer(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.target || (!args.amount && !args.balance)) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }

  const sell = bySymbol(args.from);
  const buy = bySymbol(args.target);
  if (!sell) fail(`actif vendu inconnu : ${args.from}`);
  if (!buy) fail(`cible inconnue : ${args.target} (attendu USDC ou EURC)`);

  loadEnv();

  let amountIn: bigint = 0n;
  if (args.balance) {
    const addr = args.balanceAddr || process.env.WALLET_ADDRESS;
    if (!addr) return fail('adresse requise : `decant --balance G… USDC` ou WALLET_ADDRESS dans .env');
    const { readBlndBalance } = await import('../core/balance.js');
    amountIn = await readBlndBalance(addr, {
      horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org', timeoutMs: 12000,
    });
    if (amountIn <= 0n) {
      process.stdout.write(`Balance BLND = 0 pour ${addr.slice(0, 6)}… — rien à coter.\n`);
      process.exit(0);
    }
    process.stdout.write(`Balance BLND live : ${fromStroops(amountIn)} BLND → cotation…\n`);
  } else {
    try {
      amountIn = toStroops(args.amount);
    } catch {
      return fail(`montant invalide : ${args.amount}`);
    }
    if (amountIn <= 0n) return fail('le montant doit etre > 0');
  }
  const cfg: EngineConfig = {
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://mainnet.sorobanrpc.com',
    horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org',
    soroswapApiKey: process.env.SOROSWAP_API_KEY || undefined,
    walletAddress: process.env.WALLET_ADDRESS || undefined,
    slippageBps: Number.isFinite(args.slippageBps) ? args.slippageBps : 50,
    withSplit: args.split,
    timeoutMs: 12000,
  };

  const result = await quote({ sell: sell as Asset, buy: buy as Asset, amountIn, cfg });

  if (args.json) process.stdout.write(JSON.stringify(result, jsonReplacer, 2) + '\n');
  else process.stdout.write(renderText(result) + '\n');
}

function fail(msg: string): never {
  process.stderr.write(`erreur : ${msg}\n`);
  process.exit(1);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
