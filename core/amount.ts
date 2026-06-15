// Conversion exacte montant humain <-> stroops (bigint). Aucun float : precision 7 decimales garantie.
import { DECIMALS } from './sources/types.js';

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/**
 * Parse un montant decimal ("1000", "0.0512", "50.9123456") en stroops (bigint).
 * Tronque (vers zero) au-dela de `decimals` decimales. Lance si la syntaxe est invalide.
 */
export function toStroops(human: string | number, decimals = DECIMALS): bigint {
  const s = (typeof human === 'number' ? humanFromNumber(human) : human).trim();
  if (!/^-?\d*\.?\d*$/.test(s) || s === '' || s === '.' || s === '-' || s === '-.') {
    throw new Error(`montant invalide: ${JSON.stringify(human)}`);
  }
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const [intPart = '0', fracRaw = ''] = body.split('.');
  const frac = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  const v = BigInt(intPart || '0') * pow10(decimals) + BigInt(frac || '0');
  return neg ? -v : v;
}

/** Stroops (bigint) -> chaine decimale lisible, zeros de fin retires. */
export function fromStroops(s: bigint, decimals = DECIMALS): string {
  const neg = s < 0n;
  const v = neg ? -s : s;
  const base = pow10(decimals);
  const intPart = (v / base).toString();
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + intPart + (frac ? `.${frac}` : '');
}

/** Nombre flottant proche en stroops -> nombre JS (pour ratios / affichage non comptable). */
export function toNumber(s: bigint, decimals = DECIMALS): number {
  return Number(s) / Number(pow10(decimals));
}

function humanFromNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`montant non fini: ${n}`);
  // Evite la notation scientifique pour les magnitudes usuelles ; sinon delegue a toFixed.
  if (Math.abs(n) < 1e-7 && n !== 0) return n.toFixed(DECIMALS);
  return Number.isInteger(n) ? n.toString() : n.toFixed(DECIMALS);
}
