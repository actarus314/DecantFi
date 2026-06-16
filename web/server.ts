// Serveur HTTP web — node:http (stdlib, pas d'Express).
// Routes : GET / · GET /api/overview · GET /api/quote · GET /api/balance
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadWebConfig } from './config.js';
import { openReadOnly } from './read-db.js';
import { overview } from './stats.js';
import { liveQuote, walletBalance, parseAmountStroops } from './quote-api.js';
import { toStroops } from '../core/amount.js';

const cfg = loadWebConfig();
const db = openReadOnly(cfg.dbPath);

// HTML servi statiquement (lu une fois au boot)
const htmlPath = fileURLToPath(new URL('./public/index.html', import.meta.url));
const html = readFileSync(htmlPath, 'utf-8');

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
      const result = await walletBalance(cfg);
      json(res, 200, result);
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
