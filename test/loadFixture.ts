import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadFixture(name: string): unknown {
  const url = new URL(`../core/sources/__fixtures__/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}
