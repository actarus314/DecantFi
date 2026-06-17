// Serveur HTTP web — node:http (stdlib, pas d'Express).
// Routes : GET / · GET /api/overview · GET /api/quote · GET /api/balance
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadWebConfig } from './config.js';
import { openReadOnly } from './read-db.js';
import { overview, buildSourceHealth } from './stats.js';
import { liveQuote, walletBalance, parseAmountStroops } from './quote-api.js';
import { pickExecutableVenue, submit, ExecError } from './execute.js';
import { manualRefresh, refreshBusy } from './refresh.js';
import { toStroops, toNumber } from '../core/amount.js';
import { readBlndBalance } from '../core/balance.js';

const cfg = loadWebConfig();
const db = openReadOnly(cfg.dbPath);

// HTML servi statiquement (lu une fois au boot)
const htmlPath = fileURLToPath(new URL('./public/index.html', import.meta.url));
const html = readFileSync(htmlPath, 'utf-8');
// Bundle Stellar Wallets Kit self-hosté (esm.sh casse les sous-chemins /modules/*). Régénérer : npm run build:walletkit.
const walletkitPath = fileURLToPath(new URL('./public/walletkit.js', import.meta.url));
const walletkitJs = readFileSync(walletkitPath, 'utf-8');

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parsePair(raw: string | null): 'USDC' | 'EURC' | null {
  if (raw === 'USDC' || raw === 'EURC') return raw;
  return null;
}

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const qs = url.slice(idx + 1);
  const params: Record<string, string> = {};
  for (const part of qs.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = decodeURIComponent(part.slice(0, eq));
    const v = decodeURIComponent(part.slice(eq + 1));
    params[k] = v;
  }
  return params;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1_000_000) throw new Error('body trop volumineux'); // 1 MB cap
    chunks.push(c as Buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf-8')); // throws on invalid JSON → caught by handle()
}

function isStellarPubkey(s: unknown): s is string { return typeof s === 'string' && /^G[A-Z2-7]{55}$/.test(s); }

function execStatus(code: ExecError['code']): number { return code === 'down' ? 502 : 400; }

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawUrl = req.url ?? '/';
  const path = rawUrl.split('?')[0] ?? '/';
  const query = parseQuery(rawUrl);

  process.stderr.write(`${new Date().toISOString()} ${req.method} ${rawUrl}\n`);

  try {
    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (req.method === 'GET' && path === '/walletkit.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(walletkitJs);
      return;
    }

    if (req.method === 'GET' && path === '/api/health') {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 7 * 86_400_000).toISOString();
      const result = buildSourceHealth(db, windowStart, now);
      json(res, 200, { ...result, generatedAt: now.toISOString() });
      return;
    }

    if (req.method === 'GET' && path === '/api/overview') {
      const pairRaw = query['pair'] ?? 'USDC';
      const pair = parsePair(pairRaw);
      if (!pair) {
        json(res, 400, { error: `pair invalide: ${pairRaw}` });
        return;
      }
      const result = overview(db, pair, cfg);
      json(res, 200, result);
      return;
    }

    if (req.method === 'GET' && path === '/api/quote') {
      const pairRaw = query['pair'] ?? 'USDC';
      const pair = parsePair(pairRaw);
      if (!pair) {
        json(res, 400, { error: `pair invalide: ${pairRaw}` });
        return;
      }

      let amountStroops: bigint;

      if (query['wallet'] === '1') {
        // Utilise le solde wallet
        const balance = await walletBalance(cfg);
        if (!balance.configured || balance.blnd <= 0) {
          json(res, 400, { error: 'wallet non configuré ou solde nul' });
          return;
        }
        amountStroops = toStroops(balance.blnd);
      } else {
        const amtStr = query['amount'] ?? '';
        const parsed = parseAmountStroops(amtStr);
        if (parsed === null) {
          json(res, 400, { error: `amount invalide: ${amtStr}` });
          return;
        }
        amountStroops = parsed;
      }

      const result = await liveQuote(pair, amountStroops, cfg);
      json(res, 200, result);
      return;
    }

    if (req.method === 'GET' && path === '/api/balance') {
      const address = query['address'];
      if (address !== undefined) {
        if (!isStellarPubkey(address)) { json(res, 400, { error: 'adresse invalide' }); return; }
        const stroops = await readBlndBalance(address, { horizonUrl: cfg.horizonUrl, timeoutMs: cfg.timeoutMs });
        json(res, 200, { blnd: toNumber(stroops), configured: true });
      } else {
        const result = await walletBalance(cfg);
        json(res, 200, result);
      }
      return;
    }

    // Refresh manuel : journalise un tick (note='manual', purgé au prochain poll programmé),
    // puis renvoie l'overview rafraîchi de la paire demandée.
    if (req.method === 'POST' && path === '/api/refresh') {
      if (refreshBusy()) {
        json(res, 429, { error: 'refresh déjà en cours' });
        return;
      }
      const pair = parsePair(query['pair'] ?? 'USDC') ?? 'USDC';
      const refresh = await manualRefresh(cfg);
      json(res, 200, { refresh, overview: overview(db, pair, cfg) });
      return;
    }

    if (req.method === 'POST' && path === '/api/build') {
      const raw = await readJsonBody(req);
      const b = (raw ?? {}) as Record<string, unknown>;
      const pair = parsePair(typeof b.pair === 'string' ? b.pair : null);
      if (!pair) { json(res, 400, { error: 'pair invalide' }); return; }
      if (!isStellarPubkey(b.sender)) { json(res, 400, { error: 'sender invalide (adresse G… requise)' }); return; }
      const amount = parseAmountStroops(String(b.amount ?? ''));
      if (amount === null) { json(res, 400, { error: 'amount invalide' }); return; }
      // slippage : entier 0..5000 (cap 50 %), défaut 50.
      let slippageBps = 50;
      if (b.slippageBps !== undefined) {
        const n = Number(b.slippageBps);
        if (!Number.isInteger(n) || n < 0 || n > 5000) { json(res, 400, { error: 'slippageBps invalide (0..5000)' }); return; }
        slippageBps = n;
      }
      const displayed = (b.displayed && typeof b.displayed === 'object')
        ? { winner: (b.displayed as any).winner, net: (b.displayed as any).net }
        : undefined;
      try {
        const result = await pickExecutableVenue(pair, amount, b.sender, slippageBps, cfg, displayed);
        json(res, 200, result);
      } catch (e) {
        if (e instanceof ExecError) { json(res, execStatus(e.code), { error: e.message, code: e.code }); return; }
        throw e; // → 500 via handle()
      }
      return;
    }

    if (req.method === 'POST' && path === '/api/submit') {
      const raw = await readJsonBody(req);
      const b = (raw ?? {}) as Record<string, unknown>;
      if (b.venue !== 'xbull' && b.venue !== 'soroswap') { json(res, 400, { error: 'venue invalide' }); return; }
      if (typeof b.signedXdr !== 'string' || b.signedXdr.length === 0) { json(res, 400, { error: 'signedXdr manquant' }); return; }
      if (b.venue === 'xbull' && typeof b.id !== 'string') { json(res, 400, { error: 'id requis pour xbull' }); return; }
      try {
        const result = await submit(b.venue, { id: b.id as string | undefined, signedXdr: b.signedXdr }, cfg);
        json(res, 200, result);
      } catch (e) {
        if (e instanceof ExecError) { json(res, execStatus(e.code), { error: e.message, code: e.code }); return; }
        throw e;
      }
      return;
    }

    json(res, 404, { error: 'route inconnue' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`ERROR ${path}: ${msg}\n`);
    json(res, 500, { error: msg });
  }
}

const server = createServer((req, res) => {
  void handle(req, res);
});

server.listen(cfg.port, '0.0.0.0', () => {
  process.stderr.write(`stellarswap web · http://0.0.0.0:${cfg.port} · DB=${cfg.dbPath}\n`);
});
