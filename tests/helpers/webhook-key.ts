/**
 * AES-256 fixture keys (base64 of 32 ASCII bytes).
 * They encrypt test rows only. They are not deployed and they are not credentials.
 */
export const TEST_WEBHOOK_SECRET_KEY = 'dGVzdC13ZWJob29rLXNlY3JldC1rZXktMzJieXRlcyE=';
export const TEST_WEBHOOK_SECRET_KEY_NEXT = 'bmV4dC13ZWJob29rLXNlY3JldC1rZXktMzJieXRlcyE=';

export const TEST_WEBHOOK_KEYS = {
  current: TEST_WEBHOOK_SECRET_KEY,
} as const;
