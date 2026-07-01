#!/usr/bin/env node
/**
 * Regenerates web/public/sb-mediator.js + web/public/sb-mediator.js.sha256
 * Usage: npm run build:sb-mediator
 *
 * ⚠ After running: commit sb-mediator.js + sb-mediator.js.sha256.
 *   The bundle pins @stellar-broker/client@0.6.14 (KNOWN vuln DECANT-SB-2026-001).
 *   DO NOT upgrade the SDK without a full security review and updating the guard.
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outfile = path.join(repoRoot, 'web', 'public', 'sb-mediator.js');
const sha256file = outfile + '.sha256';

// Read the installed SDK version dynamically
let version;
try {
  const pkgPath = path.join(repoRoot, 'node_modules', '@stellar-broker', 'client', 'package.json');
  ({ version } = JSON.parse(readFileSync(pkgPath, 'utf-8')));
} catch {
  version = 'unknown';
}

const banner =
  `// @stellar-broker/client@${version} — vendored browser bundle (esbuild); regenerate: npm run build:sb-mediator\n` +
  `// ⚠ KNOWN vuln DECANT-SB-2026-001: validateTransaction() incomplete — mitigated by validateStreamedTx guard (bundled).`;

await build({
  entryPoints: [path.join(repoRoot, 'web', 'sb-mediator.entry.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  define: { global: 'globalThis' },
  inject: [path.join(repoRoot, 'scripts', 'sb-mediator-shims.js')],
  target: 'es2020',
  outfile,
  banner: { js: banner },
});

// Compute and write the sha256 checksum (compatible with sha256sum -c)
const content = readFileSync(outfile);
const hash = createHash('sha256').update(content).digest('hex');
writeFileSync(sha256file, `${hash}  web/public/sb-mediator.js\n`);

console.log(`✓ sb-mediator.js bundled (${content.length} bytes)`);
console.log(`✓ ${sha256file} updated`);
console.log(`  SDK version: ${version}`);
console.log(`  SHA-256: ${hash}`);
