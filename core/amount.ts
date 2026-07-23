// Exact conversion human amount <-> stroops (bigint). No floats: 7-decimal precision guaranteed.
import { DECIMALS } from './sources/types.js';

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/**
 * Parses a decimal amount ("1000", "0.0512", "50.9123456") into stroops (bigint).
 * Truncates (toward zero) beyond `decimals` decimals. Throws if the syntax is invalid.
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

/** Stroops (bigint) -> readable decimal string, trailing zeros stripped. */
export function fromStroops(s: bigint, decimals = DECIMALS): string {
  const neg = s < 0n;
  const v = neg ? -s : s;
  const base = pow10(decimals);
  const intPart = (v / base).toString();
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + intPart + (frac ? `.${frac}` : '');
}

/** Nearby floating-point number in stroops -> JS number (for ratios / non-accounting display). */
export function toNumber(s: bigint, decimals = DECIMALS): number {
  return Number(s) / Number(pow10(decimals));
}

function humanFromNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`montant non fini: ${n}`);
  // Avoids scientific notation for usual magnitudes; otherwise delegates to toFixed.
  if (Math.abs(n) < 1e-7 && n !== 0) return n.toFixed(DECIMALS);
  return Number.isInteger(n) ? n.toString() : n.toFixed(DECIMALS);
}
