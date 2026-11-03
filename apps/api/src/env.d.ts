interface Env {
  /** Wrangler secret. Base64 of 32 bytes. Not a var. */
  WEBHOOK_SECRET_ENCRYPTION_KEY?: string;
  /** Decrypt-only key used while webhook secrets are re-saved under the current key. */
  WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS?: string;
}
