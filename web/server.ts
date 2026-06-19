// Serveur HTTP web — node:http (stdlib, pas d'Express).
// Routes : GET / · GET /api/overview · GET /api/quote · GET /api/balance
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadWebConfig } from './config.js';
import { openReadOnly, readCoherenceProbesByVenue } from './read-db.js';
import { overview, buildSourceHealth, latestChosenRpc } from './stats.js';
import { liveQuote, walletBalance, parseAmountStroops } from './quote-api.js';
import { appendRpcCallLog } from '../db/index.js';
import { resetRpc, readRpc } from '../core/rpc-meter.js';
import { pickExecutableVenue, submit, buildChangeTrust, ExecError, type Venue } from './execute.js';
import { manualRefresh, refreshBusy } from './refresh.js';
import { toStroops, toNumber } from '../core/amount.js';
import { readBlndBalance, readAssetBalance } from '../core/balance.js';
import { TARGETS, BLND, USDC } from '../core/assets.js';

const cfg = loadWebConfig();
const db = openReadOnly(cfg.dbPath);

// HTML servi statiquement (lu une fois au boot)
const htmlPath = fileURLToPath(new URL('./public/index.html', import.meta.url));
const html = readFileSync(htmlPath, 'utf-8');
// Bundle Stellar Wallets Kit self-hosté (esm.sh casse les sous-chemins /modules/*). Régénérer : npm run build:walletkit.
const walletkitPath = fileURLToPath(new URL('./public/walletkit.js', import.meta.url));
const walletkitJs = readFileSync(walletkitPath, 'utf-8');
const faviconPath = fileURLToPath(new URL('./public/favicon.svg', import.meta.url));
const faviconSvg = readFileSync(faviconPath, 'utf-8');

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

const VENUES: readonly Venue[] = ['xbull', 'soroswap', 'horizon', 'aquarius', 'comet', 'ultrastellar'];
function isVenue(v: unknown): v is Venue { return typeof v === 'string' && (VENUES as readonly string[]).includes(v); }

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

    if (req.method === 'GET' && path === '/version.js') {
      const rev = (process.env.APP_REV || 'dev').replace(/[^\w.-]/g, '');
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(`window.__REV='${rev}';`);
      return;
    }

    if (req.method === 'GET' && path === '/favicon.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'max-age=86400' });
      res.end(faviconSvg);
      return;
    }

    if (req.method === 'GET' && path === '/api/health') {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 7 * 86_400_000).toISOString();
      const result = buildSourceHealth(db, windowStart, now);
      json(res, 200, { ...result, generatedAt: now.toISOString() });
      return;
    }

    if (req.method === 'GET' && path === '/api/coherence') {
      const venue = query['venue'] ?? '';
      if (!venue) {
        json(res, 400, { error: 'paramètre venue manquant' });
        return;
      }
      const now = new Date();
      const windowStart = new Date(now.getTime() - 7 * 86_400_000).toISOString();
      const rows = readCoherenceProbesByVenue(db, venue, windowStart);
      // Convertit les bigint en string pour la sérialisation JSON
      const probes = rows.map((p) => ({
        created_at: p.created_at,
        pair: p.pair,
        amount_in: p.amount_in.toString(),
        incoherent: p.incoherent,
        reason: p.reason,
        net_quoted: p.net_quoted !== null ? p.net_quoted.toString() : null,
        net_simulated: p.net_simulated !== null ? p.net_simulated.toString() : null,
        delta_bps: p.delta_bps !== null ? Number(p.delta_bps) : null,
        route: p.route_json !== null ? (() => { try { return JSON.parse(p.route_json!); } catch { return null; } })() : null,
        trace: p.trace_json !== null ? (() => { try { return JSON.parse(p.trace_json!); } catch { return null; } })() : null,
      }));
      json(res, 200, { venue, probes });
      return;
    }

    if (req.method === 'GET' && path === '/api/overview') {
      const pairRaw = query['pair'] ?? 'USDC';
      const pair = parsePair(pairRaw);
      if (!pair) {
        json(res, 400, { error: `pair invalide: ${pairRaw}` });
        return;
      }
      const tzoffRaw = Number(query['tzoff'] ?? '0');
      const offsetH = Number.isFinite(tzoffRaw) && tzoffRaw >= -14 && tzoffRaw <= 14 ? Math.trunc(tzoffRaw) : 0;
      const result = overview(db, pair, cfg, undefined, offsetH);
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

      const chosenRpc = latestChosenRpc(db);
      const quoteCfg = chosenRpc ? { ...cfg, rpcUrl: chosenRpc } : cfg;
      resetRpc();
      const quoteStart = Date.now();
      const result = await liveQuote(pair, amountStroops, quoteCfg);
      const elapsed = Date.now() - quoteStart;
      const rpcCalls = readRpc();
      json(res, 200, result);
      // Log de la charge en best-effort, après l'envoi de la réponse (ne retarde pas le client).
      if (rpcCalls > 0) {
        const logUrl = chosenRpc ?? cfg.rpcUrl;
        try {
          appendRpcCallLog(cfg.dbPath, {
            at: new Date(quoteStart).toISOString(),
            url: logUrl,
            kind: 'quote',
            calls: rpcCalls,
            dur_ms: elapsed,
          });
        } catch { /* best-effort */ }
      }
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

    if (req.method === 'GET' && path === '/api/asset-balance') {
      const address = query['address'];
      if (!isStellarPubkey(address)) { json(res, 400, { error: 'adresse invalide' }); return; }
      const assetKey = query['asset'];
      const pair = parsePair(assetKey ?? null);
      if (!pair) { json(res, 400, { error: `asset invalide: ${assetKey ?? '(absent)'}` }); return; }
      const asset = TARGETS[pair];
      const balance = await readAssetBalance(address, asset, { horizonUrl: cfg.horizonUrl, timeoutMs: cfg.timeoutMs });
      json(res, 200, { balance });
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
      const tzoffRaw = Number(query['tzoff'] ?? '0');
      const offsetH = Number.isFinite(tzoffRaw) && tzoffRaw >= -14 && tzoffRaw <= 14 ? Math.trunc(tzoffRaw) : 0;
      const refresh = await manualRefresh(cfg);
      json(res, 200, { refresh, overview: overview(db, pair, cfg, undefined, offsetH) });
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
      let forceVenue: Venue | undefined;
      if (b.venue !== undefined) {
        if (!isVenue(b.venue)) { json(res, 400, { error: 'venue invalide' }); return; }
        forceVenue = b.venue;
      }
      if (b.from !== undefined && b.from !== 'BLND' && b.from !== 'USDC') {
        json(res, 400, { error: 'from invalide' }); return;
      }
      const sellAsset = b.from === 'USDC' ? USDC : BLND;
      try {
        const result = await pickExecutableVenue(pair, amount, b.sender as string, slippageBps, cfg, displayed, undefined, forceVenue, sellAsset);
        json(res, 200, result);
      } catch (e) {
        if (e instanceof ExecError) { json(res, execStatus(e.code), { error: e.message, code: e.code }); return; }
        throw e; // → 500 via handle()
      }
      return;
    }

    if (req.method === 'POST' && path === '/api/build-trustline') {
      const raw = await readJsonBody(req);
      const b = (raw ?? {}) as Record<string, unknown>;
      const pair = parsePair(typeof b.pair === 'string' ? b.pair : null);
      if (!pair) { json(res, 400, { error: 'pair invalide' }); return; }
      if (!isStellarPubkey(b.sender)) { json(res, 400, { error: 'sender invalide (adresse G… requise)' }); return; }
      try {
        const result = await buildChangeTrust(b.sender, TARGETS[pair], cfg.horizonUrl);
        json(res, 200, result);
      } catch (e) {
        if (e instanceof ExecError) { json(res, execStatus(e.code), { error: e.message, code: e.code }); return; }
        throw e;
      }
      return;
    }

    if (req.method === 'POST' && path === '/api/submit') {
      const raw = await readJsonBody(req);
      const b = (raw ?? {}) as Record<string, unknown>;
      if (!isVenue(b.venue)) { json(res, 400, { error: 'venue invalide' }); return; }
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
