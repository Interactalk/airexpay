const SCALE = 18;

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(\.\d+)?$/;

export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value);
}

export function parseDecimal(value: string, scale = SCALE): bigint {
  if (!isDecimalString(value)) {
    throw new Error(`Invalid decimal amount: ${value}`);
  }
  const [wholePart, fraction = ''] = value.split('.');
  const whole = wholePart ?? '0';
  const padded = (fraction + '0'.repeat(scale)).slice(0, scale);
  if (fraction.length > scale) {
    throw new Error(`Amount exceeds ${scale} decimal places: ${value}`);
  }
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(padded);
}

export function formatDecimal(value: bigint, scale = SCALE, places = scale): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(scale);
  const whole = absolute / base;
  let fraction = (absolute % base).toString().padStart(scale, '0');
  if (places < scale) {
    fraction = fraction.slice(0, places);
  }
  fraction = fraction.replace(/0+$/, '');
  const body = fraction.length > 0 ? `${whole.toString()}.${fraction}` : whole.toString();
  return negative ? `-${body}` : body;
}

export function compareDecimal(left: string, right: string): -1 | 0 | 1 {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function divideDecimal(numerator: string, denominator: string, places = 8): string {
  const scale = SCALE;
  const left = parseDecimal(numerator, scale);
  const right = parseDecimal(denominator, scale);
  if (right === 0n) {
    throw new Error('Division by zero');
  }
  const scaled = (left * 10n ** BigInt(places)) / right;
  return formatDecimal(scaled, places, places);
}
