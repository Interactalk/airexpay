/**
 * Document bytes at rest.
 *
 * Ciphertext is `v1.` plus base64url(12-byte IV || AES-256-GCM ciphertext).
 * The key material is base64url of 32 bytes, the same shape as the webhook key.
 * Callers encrypt before a Durable Object or any later R2 object sees the bytes.
 * Stored objects stay private.
 */

const VERSION = 'v1';

export async function encryptDocumentBytes(
  plaintext: Uint8Array,
  keyMaterial: string,
): Promise<string> {
  const key = await importAesKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, copyBytes(plaintext));
  const packed = new Uint8Array(iv.byteLength + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.byteLength);
  return `${VERSION}.${bytesToBase64Url(packed)}`;
}

export async function decryptDocumentBytes(
  stored: string,
  keyMaterial: string,
): Promise<Uint8Array> {
  const packed = unpack(stored);
  const iv = copyBytes(packed.subarray(0, 12));
  const cipher = copyBytes(packed.subarray(12));
  const key = await importAesKey(keyMaterial);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new Uint8Array(plain);
  } catch {
    throw new Error('Document ciphertext could not be decrypted');
  }
}

export function randomDocumentKey(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function importAesKey(keyMaterial: string): Promise<CryptoKey> {
  const bytes = copyBytes(decodeKey(keyMaterial));
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function decodeKey(keyMaterial: string): Uint8Array {
  const bytes = base64UrlToBytes(keyMaterial.trim());
  if (bytes.byteLength !== 32) {
    throw new Error('Document encryption key must decode to 32 bytes');
  }
  return bytes;
}

function unpack(stored: string): Uint8Array {
  const dot = stored.indexOf('.');
  const version = dot === -1 ? '' : stored.slice(0, dot);
  const payload = dot === -1 ? '' : stored.slice(dot + 1);
  if (version !== VERSION || !payload) {
    throw new Error('Unsupported document ciphertext version');
  }
  const packed = base64UrlToBytes(payload);
  if (packed.byteLength <= 12) throw new Error('Document ciphertext is truncated');
  return packed;
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  const copy = new Uint8Array(buffer);
  copy.set(bytes);
  return copy;
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
