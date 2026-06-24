// Serveur HTTP web — node:http (stdlib, pas d'Express).
// Routes : GET / · GET /api/overview · GET /api/quote · GET /api/balance
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { clientIp, apiAllowed } from './request-ip.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { loadWebConfig } from './config.js';
import { openReadOnly, readCoherenceProbesByVenue } from './read-db.js';
import { overview, buildSourceHealth, latestChosenRpc } from './stats.js';
import { liveQuote, walletBalance, parseAmountStroops } from './quote-api.js';
import { appendRpcCallLog } from '../db/index.js';
import { resetRpc, readRpc, rpcAls } from '../core/rpc-meter.js';
import { pickExecutableVenue, submit, txStatus, buildChangeTrust, ExecError, type Venue } from './execute.js';
import { manualRefresh, refreshBusy } from './refresh.js';
import { toStroops, toNumber } from '../core/amount.js';
import { readBlndBalance, readAssetBalance } from '../core/balance.js';
import { TARGETS, BLND, USDC } from '../core/assets.js';

const cfg = loadWebConfig();
const db = openReadOnly(cfg.dbPath);

// --- Helpers compression + ETag ---

function staticAsset(buf: Buffer, type: string) {
  const gz = gzipSync(buf, { level: 9 });
  const br = brotliCompressSync(buf);
  return {
    raw: buf,
    type,
    gzip: gz.byteLength < buf.byteLength ? gz : null,
    br: br.byteLength < buf.byteLength ? br : null,
    etag: 'W/"' + createHash('sha1').update(buf).digest('hex').slice(0, 16) + '"',
  };
}

function sendStatic(
  req: IncomingMessage,
  res: ServerResponse,
  a: ReturnType<typeof staticAsset>,
  cacheControl: string,
  extraHeaders?: Record<string, string>,
): void {
  if (req.headers['if-none-match'] === a.etag) {
    res.writeHead(304, { 'ETag': a.etag, 'Cache-Control': cacheControl, ...extraHeaders });
    res.end();
    return;
  }
  const ae = req.headers['accept-encoding'] ?? '';
  let body = a.raw;
  let enc: string | undefined;
  if (a.br && /\bbr\b/.test(ae)) { body = a.br; enc = 'br'; }
  else if (a.gzip && /\bgzip\b/.test(ae)) { body = a.gzip; enc = 'gzip'; }
  const hdrs: Record<string, string | number> = {
    'Content-Type': a.type,
    'Content-Length': body.byteLength,
    'Cache-Control': cacheControl,
    'ETag': a.etag,
    'Vary': 'Accept-Encoding',
    ...extraHeaders,
  };
  if (enc) hdrs['Content-Encoding'] = enc;
  res.writeHead(200, hdrs);
  res.end(body);
}

// --- Assets statiques pré-compilés au boot ---

// B10 : inline APP_REV and APP_VERSION into the HTML (removes the /version.js round-trip)
const rev = (process.env.APP_REV || 'dev').replace(/[^\w.-]/g, '');
const appVersion = (process.env.APP_VERSION || 'dev').replace(/[^\w.-]/g, '');
const htmlPath = fileURLToPath(new URL('./public/index.html', import.meta.url));
const htmlStr = readFileSync(htmlPath, 'utf-8')
  .replace('<!--version-meta-->', `<meta name="app-rev" content="${rev}"><meta name="app-version" content="${appVersion}">`);
const htmlAsset = staticAsset(Buffer.from(htmlStr), 'text/html; charset=utf-8');

// B8 : lire en Buffer (pas utf-8)
const walletkitPath = fileURLToPath(new URL('./public/walletkit.js', import.meta.url));
const walletkitAsset = staticAsset(readFileSync(walletkitPath), 'text/javascript; charset=utf-8');

// App logic extracted from index.html (CSP: served as 'self', no inline script needed).
const appJsPath = fileURLToPath(new URL('./public/app.js', import.meta.url));
const appJsAsset = staticAsset(readFileSync(appJsPath), 'text/javascript; charset=utf-8');

const faviconPath = fileURLToPath(new URL('./public/favicon.svg', import.meta.url));
const faviconAsset = staticAsset(readFileSync(faviconPath), 'image/svg+xml; charset=utf-8');

const logoPath = fileURLToPath(new URL('./public/logo.svg', import.meta.url));
const logoAsset = staticAsset(readFileSync(logoPath), 'image/svg+xml; charset=utf-8');

const robotsTxtAsset = staticAsset(
  Buffer.from(
    '# DecantFi is open-source. Want the data? Run your own instance:\n' +
    '#   https://github.com/actarus314/DecantFi\n' +
    '# The /api/* endpoints serve the dashboard only — please don\'t scrape them.\n' +
    '# Questions or a use case? Open a GitHub issue and reach out.\n' +
    'User-agent: *\n' +
    'Disallow: /api/\n',
  ),
  'text/plain; charset=utf-8',
);

// Wallet icons: precompile all .png files from web/public/wallet-icons/ at boot.
// Generic: any icon produced by build:walletkit is served automatically.
const walletIconsMap = new Map<string, ReturnType<typeof staticAsset>>();
const walletIconsDir = new URL('./public/wallet-icons/', import.meta.url);
try {
  for (const name of readdirSync(fileURLToPath(walletIconsDir))) {
    if (!name.endsWith('.png')) continue;
    const buf = readFileSync(fileURLToPath(new URL(name, walletIconsDir)));
    walletIconsMap.set(name, staticAsset(buf, 'image/png'));
  }
} catch {
  // Directory missing (fresh checkout before build:walletkit) — serve 404 for icon requests.
}

// --- Cache mémoire TTL pour /api/overview (B3) ---

// ponytail: Map keyed by `${pair}|${offsetH}`; bounded by validated inputs
// (2 pairs × tzoff[-14..14] ≈ 58 keys) — the clear() is a paranoia cap.
const overviewCache = new Map<string, { at: number; data: unknown }>();
const OVERVIEW_TTL_MS = 60_000;

// --- Cache mémoire TTL pour /api/health (D3) ---

let healthCache: { key: string; at: number; data: unknown } | null = null;
const HEALTH_TTL_MS = 30_000;

// --- Réponse JSON avec compression conditionnelle (B6) ---

function json(res: ServerResponse, req: IncomingMessage, status: number, data: unknown): void {
  const body = Buffer.from(JSON.stringify(data));
  const ae = req.headers['accept-encoding'] ?? '';
  const hdrs: Record<string, string | number> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  let out = body;
  let enc: string | undefined;
  if (body.byteLength > 1024) {
    if (/\bbr\b/.test(ae)) { out = brotliCompressSync(body); enc = 'br'; }
    else if (/\bgzip\b/.test(ae)) { out = gzipSync(body, { level: 6 }); enc = 'gzip'; }
  }
  if (enc) hdrs['Content-Encoding'] = enc;
  hdrs['Content-Length'] = out.byteLength;
  res.writeHead(status, hdrs);
  res.end(out);
}

// C1 — En-têtes de sécurité
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
};

// C1b — En-têtes communs pour les assets statiques (JS, SVG, PNG, texte)
const RESOURCE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' } as const;

// C4 — Redaction de l'URL RPC (protocol+host uniquement, sans le path qui peut contenir une clé API)
function redactRpcUrl(u: string): string {
  try { const x = new URL(u); return x.protocol + '//' + x.host; } catch { return 'invalid'; }
}

// C5 — Rate-limiting en mémoire (token-bucket par IP)
const rlBuckets = new Map<string, { count: number; resetAt: number }>();

// Purge expired buckets every 5 minutes to prevent unbounded growth under IP churn.
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of rlBuckets) {
    if (now > e.resetAt) rlBuckets.delete(ip);
  }
}, 5 * 60_000).unref();

function rateLimited(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const e = rlBuckets.get(ip);
  if (!e || now > e.resetAt) { rlBuckets.set(ip, { count: 1, resetAt: now + windowMs }); return false; }
  if (e.count >= max) return true;
  e.count++; return false;
}

// C5 — Cooldown refresh
let lastRefreshAt = 0;

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
    try {
      const k = decodeURIComponent(part.slice(0, eq));
      const v = decodeURIComponent(part.slice(eq + 1));
      params[k] = v;
    } catch {
      // Malformed percent-encoding (%GG etc.) — skip param, return a 400 later if required.
      continue;
    }
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

function isStellarPubkey(s: unknown): s is string { return typeof s === 'string' && s.length === 56 && /^G[A-Z2-7]{55}$/.test(s); }

function execStatus(code: ExecError['code']): number { return code === 'down' ? 502 : 400; } // bad_request → 400 (client error)

// Operator-visible signal when a protection fires: `docker logs <web> | grep BLOCK`.
function logBlock(req: IncomingMessage, status: number, reason: string, path: string): void {
  const ua = (req.headers['user-agent'] ?? '').toString().replace(/[\r\n]/g, ' ').slice(0, 100);
  process.stderr.write(`BLOCK ${status} ${reason} ${path} ip=${clientIp(req)} ua="${ua}"\n`);
}

const VENUES: readonly Venue[] = ['xbull', 'soroswap', 'horizon', 'aquarius', 'comet', 'ultrastellar'];
function isVenue(v: unknown): v is Venue { return typeof v === 'string' && (VENUES as readonly string[]).includes(v); }

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawUrl = req.url ?? '/';
  const path = rawUrl.split('?')[0] ?? '/';

  process.stderr.write(`${new Date().toISOString()} ${req.method} ${path}\n`);

  // Wrap in ALS so inc()/read() are isolated per concurrent request (fix #3).
  return rpcAls.run({ n: 0 }, async () => {
  try {
    // parseQuery skips malformed percent-encoded params (e.g. ?pair=%GG) via try/catch;
    // the handler then returns 400 if a required param is absent or invalid.
    const query = parseQuery(rawUrl);

    if (path.startsWith('/api/') && !apiAllowed(req)) {
      logBlock(req, 403, 'sec-fetch', path);
      json(res, req, 403, {
        error: "accès direct à l'API non autorisé",
        message: "DecantFi is open-source. Want this data? Run your own instance — it's a few commands: https://github.com/actarus314/DecantFi . The /api/* endpoints power the dashboard only; please don't scrape them. Questions or a use case? Open a GitHub issue and let's talk.",
      });
      return;
    }

    if (req.method === 'GET' && path === '/') {
      sendStatic(req, res, htmlAsset, 'no-cache', SECURITY_HEADERS);
      return;
    }

    if (req.method === 'GET' && path === '/walletkit.js') {
      sendStatic(req, res, walletkitAsset, 'no-cache', RESOURCE_HEADERS);
      return;
    }

    if (req.method === 'GET' && path === '/app.js') {
      sendStatic(req, res, appJsAsset, 'no-cache', RESOURCE_HEADERS);
      return;
    }

    // B10 : /version.js supprimé (APP_REV inliné dans le HTML au boot)

    if (req.method === 'GET' && path === '/favicon.svg') {
      sendStatic(req, res, faviconAsset, 'public, max-age=86400', RESOURCE_HEADERS);
      return;
    }
    if (req.method === 'GET' && path === '/logo.svg') {
      sendStatic(req, res, logoAsset, 'public, max-age=86400', RESOURCE_HEADERS);
      return;
    }

    if (req.method === 'GET' && path === '/robots.txt') {
      sendStatic(req, res, robotsTxtAsset, 'public, max-age=86400');
      return;
    }

    if (req.method === 'GET' && path.startsWith('/wallet-icons/')) {
      const name = path.slice('/wallet-icons/'.length);
      // Validate: only safe filename characters, must end with .png (map lookup is path-traversal-safe)
      if (/^[A-Za-z0-9._-]+\.png$/.test(name)) {
        const icon = walletIconsMap.get(name);
        if (icon) {
          sendStatic(req, res, icon, 'public, max-age=86400', RESOURCE_HEADERS);
          return;
        }
      }
      // Fall through to 404
    }

    if (req.method === 'GET' && path === '/api/health') {
      const nowMs = Date.now();
      const cacheKey = 'health';
      if (healthCache && healthCache.key === cacheKey && nowMs - healthCache.at < HEALTH_TTL_MS) {
        json(res, req, 200, healthCache.data);
        return;
      }
      const now = new Date(nowMs);
      const windowStart = new Date(nowMs - 7 * 86_400_000).toISOString();
      const result = buildSourceHealth(db, windowStart, now);
      const data = { ...result, generatedAt: now.toISOString() };
      healthCache = { key: cacheKey, at: nowMs, data };
      json(res, req, 200, data);
      return;
    }

    if (req.method === 'GET' && path === '/api/coherence') {
      const venue = query['venue'] ?? '';
      if (!venue) {
        json(res, req, 400, { error: 'paramètre venue manquant' });
        return;
      }
      if (!/^[a-z]{1,20}$/.test(venue)) { json(res, req, 400, { error: 'venue invalide' }); return; }
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
      json(res, req, 200, { venue, probes });
      return;
    }

    if (req.method === 'GET' && path === '/api/overview') {
      const pairRaw = query['pair'] ?? 'USDC';
      const pair = parsePair(pairRaw);
      if (!pair) {
        json(res, req, 400, { error: `pair invalide: ${pairRaw}` });
        return;
      }
      const tzoffRaw = Number(query['tzoff'] ?? '0');
      const offsetH = Number.isFinite(tzoffRaw) && tzoffRaw >= -14 && tzoffRaw <= 14 ? Math.trunc(tzoffRaw) : 0;
      const now = Date.now();
      const cacheKey = `${pair}|${offsetH}`;
      const hit = overviewCache.get(cacheKey);
      if (hit && now - hit.at < OVERVIEW_TTL_MS) {
        json(res, req, 200, hit.data);
        return;
      }
      const result = overview(db, pair, cfg, undefined, offsetH);
      // ponytail: bounded by validated inputs (2 pairs × tzoff[-14..14] ≈ 58 keys); clear() is a paranoia cap.
      if (overviewCache.size > 200) overviewCache.clear();
      overviewCache.set(cacheKey, { at: now, data: result });
      json(res, req, 200, result);
      return;
    }

    if (req.method === 'GET' && path === '/api/quote') {
      const ip = clientIp(req);
      if (rateLimited(ip, 120, 60_000)) { logBlock(req, 429, 'rate', path); json(res, req, 429, { error: 'trop de requêtes' }); return; }
      const pairRaw = query['pair'] ?? 'USDC';
      const pair = parsePair(pairRaw);
      if (!pair) {
        json(res, req, 400, { error: `pair invalide: ${pairRaw}` });
        return;
      }

      let amountStroops: bigint;

      if (query['wallet'] === '1') {
        // Utilise le solde wallet
        const balance = await walletBalance(cfg);
        if (!balance.configured || balance.blnd <= 0) {
          json(res, req, 400, { error: 'wallet non configuré ou solde nul' });
          return;
        }
        amountStroops = toStroops(balance.blnd);
      } else {
        const amtStr = query['amount'] ?? '';
        const parsed = parseAmountStroops(amtStr);
        if (parsed === null) {
          json(res, req, 400, { error: `amount invalide: ${amtStr}` });
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
      json(res, req, 200, result);
      // Log de la charge en best-effort, après l'envoi de la réponse (ne retarde pas le client).
      if (rpcCalls > 0) {
        const logUrl = chosenRpc ?? cfg.rpcUrl;
        try {
          appendRpcCallLog(cfg.dbPath, {
            at: new Date(quoteStart).toISOString(),
            url: redactRpcUrl(logUrl),
            kind: 'quote',
            calls: rpcCalls,
            dur_ms: elapsed,
          });
        } catch { /* best-effort */ }
      }
      return;
    }

    if (req.method === 'GET' && path === '/api/balance') {
      const ip = clientIp(req);
      if (rateLimited(ip, 60, 60_000)) { logBlock(req, 429, 'rate', path); json(res, req, 429, { error: 'trop de requêtes' }); return; }
      const address = query['address'];
      if (address !== undefined) {
        if (!isStellarPubkey(address)) { json(res, req, 400, { error: 'adresse invalide' }); return; }
        const stroops = await readBlndBalance(address, { horizonUrl: cfg.horizonUrl, timeoutMs: cfg.timeoutMs });
        json(res, req, 200, { blnd: toNumber(stroops), configured: true });
      } else {
        const result = await walletBalance(cfg);
        json(res, req, 200, result);
      }
      return;
    }

    if (req.method === 'GET' && path === '/api/asset-balance') {
      const ip = clientIp(req);
      if (rateLimited(ip, 60, 60_000)) { logBlock(req, 429, 'rate', path); json(res, req, 429, { error: 'trop de requêtes' }); return; }
      const address = query['address'];
      if (!isStellarPubkey(address)) { json(res, req, 400, { error: 'adresse invalide' }); return; }
      const assetKey = query['asset'];
      const pair = parsePair(assetKey ?? null);
      if (!pair) { json(res, req, 400, { error: `asset invalide: ${assetKey ?? '(absent)'}` }); return; }
      const asset = TARGETS[pair];
      const balance = await readAssetBalance(address, asset, { horizonUrl: cfg.horizonUrl, timeoutMs: cfg.timeoutMs });
      json(res, req, 200, { balance });
      return;
    }

    // Refresh manuel : journalise un tick (note='manual', purgé au prochain poll programmé),
    // puis renvoie l'overview rafraîchi de la paire demandée.
    if (req.method === 'POST' && path === '/api/refresh') {
      if (refreshBusy()) {
        json(res, req, 429, { error: 'refresh déjà en cours' });
        return;
      }
      if (Date.now() - lastRefreshAt < 15_000) {
        json(res, req, 429, { error: 'refresh en cooldown' });
        return;
      }
      lastRefreshAt = Date.now();
      const pair = parsePair(query['pair'] ?? 'USDC') ?? 'USDC';
      const tzoffRaw = Number(query['tzoff'] ?? '0');
      const offsetH = Number.isFinite(tzoffRaw) && tzoffRaw >= -14 && tzoffRaw <= 14 ? Math.trunc(tzoffRaw) : 0;
      const refresh = await manualRefresh(cfg);
      // B3/D3 : invalide les caches après un refresh (les données changent)
      overviewCache.clear();
      healthCache = null;
      json(res, req, 200, { refresh, overview: overview(db, pair, cfg, undefined, offsetH) });
      return;
    }

    if (req.method === 'POST' && path === '/api/build') {
      const ip = clientIp(req);
      if (rateLimited(ip, 30, 60_000)) { logBlock(req, 429, 'rate', path); json(res, req, 429, { error: 'trop de requêtes' }); return; }
      const raw = await readJsonBody(req);
      const b = (raw ?? {}) as Record<string, unknown>;
      const pair = parsePair(typeof b.pair === 'string' ? b.pair : null);
      if (!pair) { json(res, req, 400, { error: 'pair invalide' }); return; }
      if (!isStellarPubkey(b.sender)) { json(res, req, 400, { error: 'sender invalide (adresse G… requise)' }); return; }
      const amount = parseAmountStroops(String(b.amount ?? ''));
      if (amount === null) { json(res, req, 400, { error: 'amount invalide' }); return; }
      // slippage : entier 0..5000 (cap 50 %), défaut 50.
      let slippageBps = 50;
      if (b.slippageBps !== undefined) {
        const n = Number(b.slippageBps);
        if (!Number.isInteger(n) || n < 0 || n > 5000) { json(res, req, 400, { error: 'slippageBps invalide (0..5000)' }); return; }
        slippageBps = n;
      }
      const displayed = (b.displayed && typeof b.displayed === 'object')
        ? { winner: (b.displayed as any).winner, net: (b.displayed as any).net }
        : undefined;
      let forceVenue: Venue | undefined;
      if (b.venue !== undefined) {
        if (!isVenue(b.venue)) { json(res, req, 400, { error: 'venue invalide' }); return; }
        forceVenue = b.venue;
      }
      if (b.from !== undefined && b.from !== 'BLND' && b.from !== 'USDC') {
        json(res, req, 400, { error: 'from invalide' }); return;
      }
      const sellAsset = b.from === 'USDC' ? USDC : BLND;
      try {
        const result = await pickExecutableVenue(pair, amount, b.sender as string, slippageBps, cfg, displayed, undefined, forceVenue, sellAsset);
        json(res, req, 200, result);
      } catch (e) {
        if (e instanceof ExecError) { json(res, req, execStatus(e.code), { error: e.message, code: e.code, asset: e.asset }); return; }
        throw e; // → 500 via handle()
      }
      return;
    }

    if (req.method === 'POST' && path === '/api/build-trustline') {
      const ip = clientIp(req);
      if (rateLimited(ip, 10, 60_000)) { logBlock(req, 429, 'rate', path); json(res, req, 429, { error: 'trop de requêtes' }); return; }
      const raw = await readJsonBody(req);
      const b = (raw ?? {}) as Record<string, unknown>;
      const pair = parsePair(typeof b.pair === 'string' ? b.pair : null);
      if (!pair) { json(res, req, 400, { error: 'pair invalide' }); return; }
      if (!isStellarPubkey(b.sender)) { json(res, req, 400, { error: 'sender invalide (adresse G… requise)' }); return; }
      try {
        const result = await buildChangeTrust(b.sender, TARGETS[pair], cfg.horizonUrl);
        json(res, req, 200, result);
      } catch (e) {
        if (e instanceof ExecError) { json(res, req, execStatus(e.code), { error: e.message, code: e.code }); return; }
        throw e;
      }
      return;
    }

    if (req.method === 'POST' && path === '/api/submit') {
      const ip = clientIp(req);
      if (rateLimited(ip, 10, 60_000)) { logBlock(req, 429, 'rate', path); json(res, req, 429, { error: 'trop de requêtes' }); return; }
      const raw = await readJsonBody(req);
      const b = (raw ?? {}) as Record<string, unknown>;
      if (!isVenue(b.venue)) { json(res, req, 400, { error: 'venue invalide' }); return; }
      if (typeof b.signedXdr !== 'string' || b.signedXdr.length === 0 || b.signedXdr.length > 65536) { json(res, req, 400, { error: 'signedXdr manquant ou invalide' }); return; }
      if (b.venue === 'xbull' && typeof b.id !== 'string') { json(res, req, 400, { error: 'id requis pour xbull' }); return; }
      try {
        const result = await submit(b.venue, { id: b.id as string | undefined, signedXdr: b.signedXdr }, cfg);
        json(res, req, 200, result);
      } catch (e) {
        if (e instanceof ExecError) { json(res, req, execStatus(e.code), { error: e.message, code: e.code }); return; }
        throw e;
      }
      return;
    }

    if (req.method === 'GET' && path === '/api/tx-status') {
      const ip = clientIp(req);
      if (rateLimited(ip, 90, 60_000)) { logBlock(req, 429, 'rate', path); json(res, req, 429, { error: 'trop de requêtes' }); return; }
      const venue = query['venue'];
      if (venue !== 'aquarius' && venue !== 'comet') { json(res, req, 400, { error: 'venue invalide (tx-status réservé aux venues Soroban)' }); return; }
      const hash = query['hash'];
      if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash)) { json(res, req, 400, { error: 'hash invalide' }); return; }
      try {
        const result = await txStatus(hash, cfg);
        json(res, req, 200, result);
      } catch (e) {
        if (e instanceof ExecError) { json(res, req, execStatus(e.code), { error: e.message, code: e.code }); return; }
        throw e;
      }
      return;
    }

    json(res, req, 404, { error: 'route inconnue' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`ERROR ${path}: ${msg}\n`);
    json(res, req, 500, { error: 'internal error' });
  }
  }); // end rpcAls.run()
}

const server = createServer((req, res) => {
  void handle(req, res);
});

// B7 — keep-alive + slowloris guard
server.keepAliveTimeout = 30_000;
server.headersTimeout = 35_000;
server.requestTimeout = 30_000; // abort slow body uploads (anti-slowloris)

server.listen(cfg.port, '0.0.0.0', () => {
  process.stderr.write(`DecantFi web · http://0.0.0.0:${cfg.port} · DB=${cfg.dbPath}\n`);
});
