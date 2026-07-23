// Directory writability: creates the directory + writes a probe file to it; throws if it fails.
// Isolated from the daemon (which auto-runs main()) to stay testable.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function ensureDirWritable(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.write-probe'), String(Date.now()));
}
