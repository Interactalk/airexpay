import { canonicalJson } from './json-canonical.ts';
import { hmacSha256Hex, timingSafeEqual } from './hmac.ts';

/** Local outbox worker stops after this many failed deliveries. */
export const MERCHANT_WEBHOOK_MAX_ATTEMPTS = 5;

export interface MerchantWebhookEvent {
  id: string;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

/**
 * HMAC-SHA256 over `${timestamp}.${body}`.
 * Header shape matches the API architecture: `t=<unix>,v1=<hex>`.
 */
export async function signMerchantWebhook(
  secret: string,
  body: string,
  timestamp: string,
): Promise<{ timestamp: string; signature: string; header: string }> {
  const signature = await hmacSha256Hex(secret, `${timestamp}.${body}`);
  return { timestamp, signature, header: `t=${timestamp},v1=${signature}` };
}

export async function verifyMerchantWebhook(
  secret: string,
  body: string,
  timestamp: string,
  header: string,
): Promise<boolean> {
  const expected = await signMerchantWebhook(secret, body, timestamp);
  return timingSafeEqual(expected.header, header.trim());
}

export function merchantWebhookBody(event: MerchantWebhookEvent): string {
  return canonicalJson({
    id: event.id,
    type: event.eventType,
    created_at: event.createdAt,
    data: event.payload,
  });
}

/** attempt is the 1-based failure count: 1s, 2s, 4s, … capped at one hour. */
export function merchantWebhookBackoffMs(attempt: number): number {
  const exponent = Math.min(Math.max(attempt, 1), 12) - 1;
  return Math.min(1000 * 2 ** exponent, 3_600_000);
}
