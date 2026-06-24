#!/usr/bin/env node
/**
 * Régénère web/public/walletkit.js + web/public/walletkit.js.sha256
 * Usage : npm run build:walletkit
 *
 * ⚠ Après exécution : committer walletkit.js + walletkit.js.sha256 + web/public/wallet-icons/,
 *   puis re-tester le wallet au navigateur (connexion + signature).
 *
 * Auto-vendor: any https://stellar.creit.tech/wallet-icons/<name>.png URL found in the
 * bundle is downloaded to web/public/wallet-icons/<name>.png and the URL is rewritten to
 * /wallet-icons/<name>.png. The sha256 is computed over the final (rewritten) file.
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outfile = path.join(repoRoot, 'web', 'public', 'walletkit.js');
const sha256file = outfile + '.sha256';
const iconsDir = path.join(repoRoot, 'web', 'public', 'wallet-icons');

// Lire la version installée dynamiquement
const require = createRequire(import.meta.url);
// package.json may not be in "exports" — fall back to readFileSync
let version;
try {
  ({ version } = require('@creit.tech/stellar-wallets-kit/package.json'));
} catch {
  const pkgPath = path.join(repoRoot, 'node_modules', '@creit.tech', 'stellar-wallets-kit', 'package.json');
  ({ version } = JSON.parse(readFileSync(pkgPath, 'utf-8')));
}

const banner = `// @creit.tech/stellar-wallets-kit@${version} — bundle vendoré (esbuild) ; régénérer: npm run build:walletkit`;

await build({
  entryPoints: [path.join(repoRoot, 'web', 'walletkit.entry.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  define: { global: 'globalThis' },
  target: 'es2020',
  outfile,
  banner: { js: banner },
});

// --- Vendor wallet icons: find, download, rewrite ---

let bundleText = readFileSync(outfile, 'utf-8');

const iconUrlRe = /https:\/\/stellar\.creit\.tech\/wallet-icons\/[A-Za-z0-9._-]+\.png/g;
const uniqueUrls = [...new Set(bundleText.match(iconUrlRe) ?? [])];

if (uniqueUrls.length > 0) {
  mkdirSync(iconsDir, { recursive: true });

  for (const url of uniqueUrls) {
    const filename = url.split('/').pop(); // e.g. freighter.png
    const localPath = path.join(iconsDir, filename);

    let resp;
    try {
      resp = await fetch(url);
    } catch (err) {
      throw new Error(`wallet-icon fetch failed for ${url}: ${err.message}`);
    }
    if (!resp.ok) {
      throw new Error(`wallet-icon fetch ${url} returned HTTP ${resp.status} ${resp.statusText}`);
    }

    const bytes = Buffer.from(await resp.arrayBuffer());
    writeFileSync(localPath, bytes);
    console.log(`  ↓ ${url} → wallet-icons/${filename} (${bytes.length} bytes)`);

    // Rewrite all occurrences in the bundle
    bundleText = bundleText.replaceAll(url, `/wallet-icons/${filename}`);
  }

  writeFileSync(outfile, bundleText, 'utf-8');
  console.log(`✓ ${uniqueUrls.length} icon URL(s) rewritten to /wallet-icons/*`);
} else {
  console.log('  (no stellar.creit.tech icon URLs found in bundle)');
}

// Régénère le checksum over the final (rewritten) file (format compatible sha256sum -c)
const content = readFileSync(outfile);
const hash = createHash('sha256').update(content).digest('hex');
writeFileSync(sha256file, `${hash}  web/public/walletkit.js\n`);

console.log(`✓ walletkit.js bundlé (${content.length} octets)`);
console.log(`✓ ${sha256file} mis à jour`);
console.log(`  SHA-256 : ${hash}`);
