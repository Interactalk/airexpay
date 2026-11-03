import { bufferToHex, sha256Hex } from '@airexpay/shared';

export function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortJsonValue(source[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

/** Constant-time string compare. Length mismatches still walk the longer input. */
export function timingSafeEqual(leftValue: string, rightValue: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(leftValue);
  const right = encoder.encode(rightValue);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

export async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bufferToHex(signature);
}

export interface SignatureCheck {
  valid: boolean;
  reason?: string;
  parsed?: unknown;
  canonical?: string;
}

/**
 * NOWPayments IPN: HMAC-SHA512 over JSON.stringify of the recursively key-sorted body.
 * The digest is hex. Comparison is constant-time.
 * Float re-serialization is a known risk — see docs/KNOWN_LIMITATIONS.md.
 */
export async function verifyNowPaymentsSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): Promise<SignatureCheck> {
  if (!secret) {
    return { valid: false, reason: 'missing_secret' };
  }
  if (!signatureHeader) {
    return { valid: false, reason: 'missing_signature' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return { valid: false, reason: 'invalid_json' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, reason: 'invalid_payload' };
  }
  const canonical = canonicalJson(parsed);
  const expected = await hmacSha512Hex(secret, canonical);
  const provided = signatureHeader.trim().toLowerCase();
  const valid = timingSafeEqual(expected, provided);
  if (!valid) {
    return { valid: false, reason: 'signature_mismatch', parsed, canonical };
  }
  return { valid: true, parsed, canonical };
}

export async function signNowPaymentsBody(
  body: unknown,
  secret: string,
): Promise<{ rawBody: string; signature: string }> {
  const parsed = typeof body === 'string' ? (JSON.parse(body) as unknown) : body;
  const rawBody = canonicalJson(parsed);
  const signature = await hmacSha512Hex(secret, rawBody);
  return { rawBody, signature };
}

export async function webhookDedupeKey(provider: string, rawBody: string): Promise<string> {
  let canonical = rawBody;
  try {
    canonical = canonicalJson(JSON.parse(rawBody) as unknown);
  } catch {
    canonical = rawBody;
  }
  const hash = await sha256Hex(canonical);
  return `${provider}:${hash}`;
}
