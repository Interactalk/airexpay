import { formatDecimal, parseDecimal } from '@airexpay/shared';

export function decimalPlaces(value: string): number {
  const fraction = value.split('.')[1];
  return fraction?.length ?? 0;
}

export function padDecimal(value: string, places: number): string {
  const negative = value.startsWith('-');
  const body = negative ? value.slice(1) : value;
  const [whole, fraction = ''] = body.split('.') as [string, string];
  if (places <= 0) return `${negative ? '-' : ''}${whole}`;
  return `${negative ? '-' : ''}${whole}.${fraction.padEnd(places, '0').slice(0, places)}`;
}

/** Subtract decimal strings without treating a shortfall as paid. */
export function subtractAmounts(left: string, right: string): string | null {
  try {
    const places = Math.max(decimalPlaces(left), decimalPlaces(right));
    const diff = parseDecimal(left) - parseDecimal(right);
    if (diff < 0n) return padDecimal('0', places);
    return padDecimal(formatDecimal(diff, 18, places), places);
  } catch {
    return null;
  }
}

export function groupAmount(value: string): string {
  const negative = value.startsWith('-');
  const body = negative ? value.slice(1) : value;
  const [whole, fraction] = body.split('.') as [string, string | undefined];
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const shown = fraction !== undefined ? `${grouped}.${fraction}` : grouped;
  return negative ? `-${shown}` : shown;
}
