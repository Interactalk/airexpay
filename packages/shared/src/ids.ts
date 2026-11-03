const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomToken(bytes = 16): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let out = '';
  for (const value of buffer) {
    out += ALPHABET[value % ALPHABET.length] ?? 'a';
  }
  return out;
}

export function newPublicId(prefix: string): string {
  return `${prefix}_${randomToken(12)}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bufferToHex(digest);
}

export function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
