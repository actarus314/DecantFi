// Inscriptibilité d'un dossier : crée le dossier + y écrit un témoin ; lance si impossible.
// Isolé du daemon (qui auto-exécute main()) pour rester testable.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function ensureDirWritable(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.write-probe'), String(Date.now()));
}
