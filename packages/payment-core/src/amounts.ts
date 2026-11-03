export function decimalFromProviderValue(value: unknown): string | undefined {
  if (typeof value === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return String(value);
  }
  return undefined;
}
