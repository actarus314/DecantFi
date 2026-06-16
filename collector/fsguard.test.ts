import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureDirWritable } from './fsguard.js';

describe('ensureDirWritable', () => {
  it('réussit sur un dossier inscriptible', () => {
    const dir = mkdtempSync(join(tmpdir(), 'collector-'));
    expect(() => ensureDirWritable(dir)).not.toThrow();
  });
  it('lance quand le parent est un fichier (chemin non inscriptible)', () => {
    const base = mkdtempSync(join(tmpdir(), 'collector-'));
    const file = join(base, 'afile');
    writeFileSync(file, 'x');
    expect(() => ensureDirWritable(join(file, 'sub'))).toThrow(); // mkdir sous un fichier → ENOTDIR
  });
});
