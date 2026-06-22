#!/usr/bin/env node
/**
 * Régénère web/public/walletkit.js + web/public/walletkit.js.sha256
 * Usage : npm run build:walletkit
 *
 * ⚠ Après exécution : committer walletkit.js + walletkit.js.sha256,
 *   puis re-tester le wallet au navigateur (connexion + signature).
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outfile = path.join(repoRoot, 'web', 'public', 'walletkit.js');
const sha256file = outfile + '.sha256';

// Lire la version installée dynamiquement
const require = createRequire(import.meta.url);
const { version } = require('@creit.tech/stellar-wallets-kit/package.json');

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

// Régénère le checksum (format compatible sha256sum -c)
const content = readFileSync(outfile);
const hash = createHash('sha256').update(content).digest('hex');
writeFileSync(sha256file, `${hash}  web/public/walletkit.js\n`);

console.log(`✓ walletkit.js bundlé (${content.length} octets)`);
console.log(`✓ ${sha256file} mis à jour`);
console.log(`  SHA-256 : ${hash}`);
