/**
 * Merchant webhook secrets at rest.
 *
 * Ciphertext is `v1.` plus base64url(12-byte IV || AES-256-GCM ciphertext).
 * WebCrypto appends the authentication tag to the ciphertext. Each call uses a
 * new random IV, so the same secret does not encrypt to the same string.
 *
 * `current` is WEBHOOK_SECRET_ENCRYPTION_KEY (base64 of 32 bytes).
 * `previous` is WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS and is decrypt-only.
 * Writes always use the current key. See docs/DECISIONS.md D-030 for rotation.
 */

export interface WebhookSecretKeyring {
  current?: string | undefined;
  previous?: string | undefined;
}

const VERSION = 'v1';

export function webhookKeyring(
  current: string | undefined,
  previous?: string | undefined,
): WebhookSecretKeyring {
  return { current: blank(current), previous: blank(previous) };
}

export function requireWebhookKey(keys: WebhookSecretKeyring | undefined): string {
  const current = keys?.current?.trim() ?? '';
  if (!current) {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY is required to store a merchant webhook secret');
  }
  return current;
}

export async function encryptWebhookSecret(
  plaintext: string,
  keyMaterial: string,
): Promise<string> {
  const key = await importAesKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const packed = new Uint8Array(iv.byteLength + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.byteLength);
  return `${VERSION}.${bytesToBase64Url(packed)}`;
}

export async function decryptWebhookSecret(
  stored: string,
  keyMaterial: string,
  previousKeyMaterial?: string | undefined,
): Promise<string> {
  try {
    return await decryptWith(stored, keyMaterial);
  } catch (error) {
    const previous = previousKeyMaterial?.trim() ?? '';
    if (!previous || previous === keyMaterial.trim()) throw error;
    return decryptWith(stored, previous);
  }
}

async function decryptWith(stored: string, keyMaterial: string): Promise<string> {
  const packed = unpack(stored);
  const iv = copyBytes(packed.subarray(0, 12));
  const cipher = copyBytes(packed.subarray(12));
  const key = await importAesKey(keyMaterial);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('Webhook secret ciphertext could not be decrypted');
  }
}

function unpack(stored: string): Uint8Array {
  const dot = stored.indexOf('.');
  const version = dot === -1 ? '' : stored.slice(0, dot);
  const payload = dot === -1 ? '' : stored.slice(dot + 1);
  if (version !== VERSION || !payload) {
    throw new Error('Unsupported webhook secret ciphertext version');
  }
  const packed = base64UrlToBytes(payload);
  if (packed.byteLength <= 12) {
    throw new Error('Webhook secret ciphertext is truncated');
  }
  return packed;
}

async function importAesKey(keyMaterial: string): Promise<CryptoKey> {
  const bytes = copyBytes(decodeKey(keyMaterial));
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  const copy = new Uint8Array(buffer);
  copy.set(bytes);
  return copy;
}

function decodeKey(keyMaterial: string): Uint8Array {
  const bytes = base64UrlToBytes(keyMaterial.trim());
  if (bytes.byteLength !== 32) {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.trim().replaceAll('-', '+').replaceAll('_', '/');
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error('Expected base64');
  }
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}
