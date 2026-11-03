import { bufferToHex, sha256Hex } from '@airexpay/shared';
import {
  canonicalJson,
  materializeJsonNumbers,
  parseJsonPreservingNumbers,
} from './json-canonical.ts';

export {
  canonicalJson,
  materializeJsonNumbers,
  parseJsonPreservingNumbers,
  sortJsonValue,
} from './json-canonical.ts';

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

async function hmacHex(
  secret: string,
  message: string,
  hash: 'SHA-256' | 'SHA-512',
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bufferToHex(signature);
}

export function hmacSha512Hex(secret: string, message: string): Promise<string> {
  return hmacHex(secret, message, 'SHA-512');
}

export function hmacSha256Hex(secret: string, message: string): Promise<string> {
  return hmacHex(secret, message, 'SHA-256');
}

export interface SignatureCheck {
  valid: boolean;
  reason?: string;
  parsed?: unknown;
  canonical?: string;
}

/**
 * NOWPayments IPN: HMAC-SHA512 over the recursively key-sorted body.
 * Number tokens are copied from the raw body so re-serialization does not
 * respell decimals or large integers. The digest is hex. Comparison is constant-time.
 * See docs/DECISIONS.md D-020.
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
  let tree: unknown;
  try {
    tree = parseJsonPreservingNumbers(rawBody);
  } catch {
    return { valid: false, reason: 'invalid_json' };
  }
  if (tree === null || typeof tree !== 'object' || Array.isArray(tree)) {
    return { valid: false, reason: 'invalid_payload' };
  }
  const canonical = canonicalJson(tree);
  const expected = await hmacSha512Hex(secret, canonical);
  const provided = signatureHeader.trim().toLowerCase();
  const valid = timingSafeEqual(expected, provided);
  const parsed = materializeJsonNumbers(tree);
  if (!valid) {
    return { valid: false, reason: 'signature_mismatch', parsed, canonical };
  }
  return { valid: true, parsed, canonical };
}

export async function signNowPaymentsBody(
  body: unknown,
  secret: string,
): Promise<{ rawBody: string; signature: string }> {
  const parsed = typeof body === 'string' ? parseJsonPreservingNumbers(body) : body;
  const rawBody = canonicalJson(parsed);
  const signature = await hmacSha512Hex(secret, rawBody);
  return { rawBody, signature };
}

export async function webhookDedupeKey(provider: string, rawBody: string): Promise<string> {
  let canonical = rawBody;
  try {
    canonical = canonicalJson(parseJsonPreservingNumbers(rawBody));
  } catch {
    canonical = rawBody;
  }
  const hash = await sha256Hex(canonical);
  return `${provider}:${hash}`;
}
