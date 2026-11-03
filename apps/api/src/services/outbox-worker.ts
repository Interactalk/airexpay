import {
  merchantWebhookBackoffMs,
  merchantWebhookBody,
  MERCHANT_WEBHOOK_MAX_ATTEMPTS,
  signMerchantWebhook,
} from '@airexpay/payment-core';
import type { InvoiceRepository, OutboxRecord, WebhookEndpointRecord } from '../db/repository.ts';

export interface OutboxWorkerDeps {
  environment?: string | undefined;
  now: () => Date;
  fetchImpl: (
    url: string,
    init: { method: 'POST'; headers: Record<string, string>; body: string },
  ) => Promise<{ status: number }>;
  maxAttempts?: number;
  backoffMs?: (attempt: number) => number;
  limit?: number;
}

export interface OutboxWorkerResult {
  delivered: number;
  retrying: number;
  deadLettered: number;
  skipped: number;
}

/** Refuses staging and production. Callers pass fetch; global network is not used. */
export function assertLocalOutboxWorker(environment: string | undefined): void {
  if (environment === 'production' || environment === 'staging') {
    throw new Error('The merchant webhook worker runs locally only');
  }
}

function endpointWants(endpoint: WebhookEndpointRecord, eventType: string): boolean {
  if (!endpoint.active) return false;
  if (endpoint.events.length === 0) return true;
  return endpoint.events.includes(eventType) || endpoint.events.includes('*');
}

export async function runOutboxWorker(
  db: InvoiceRepository,
  deps: OutboxWorkerDeps,
): Promise<OutboxWorkerResult> {
  assertLocalOutboxWorker(deps.environment);
  const maxAttempts = deps.maxAttempts ?? MERCHANT_WEBHOOK_MAX_ATTEMPTS;
  const backoff = deps.backoffMs ?? merchantWebhookBackoffMs;
  const now = deps.now();
  const nowIso = now.toISOString();
  const due = await db.listDueOutbox(nowIso, deps.limit ?? 50, maxAttempts);
  const result: OutboxWorkerResult = { delivered: 0, retrying: 0, deadLettered: 0, skipped: 0 };
  for (const event of due) {
    const outcome = await deliverOne(db, event, deps, now, nowIso, maxAttempts, backoff);
    result[outcome] += 1;
  }
  return result;
}

async function deliverOne(
  db: InvoiceRepository,
  event: OutboxRecord,
  deps: OutboxWorkerDeps,
  now: Date,
  nowIso: string,
  maxAttempts: number,
  backoff: (attempt: number) => number,
): Promise<'delivered' | 'retrying' | 'deadLettered' | 'skipped'> {
  const endpoints = await db.listEndpoints(event.organizationId);
  const targets = endpoints.filter((endpoint) => endpointWants(endpoint, event.eventType));
  if (targets.length === 0) return 'skipped';
  const attempt = event.attempts + 1;
  const body = merchantWebhookBody(event);
  const timestamp = String(Math.floor(now.getTime() / 1000));
  let failures = 0;
  for (const endpoint of targets) {
    const signed = await signMerchantWebhook(endpoint.secret, body, timestamp);
    let status = 0;
    try {
      const response = await deps.fetchImpl(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'AirExpay-Signature': signed.header,
          'AirExpay-Timestamp': timestamp,
        },
        body,
      });
      status = response.status;
    } catch {
      status = 0;
    }
    const ok = status >= 200 && status < 300;
    if (!ok) failures += 1;
    const giveUp = !ok && attempt >= maxAttempts;
    const nextRetryAt =
      !ok && !giveUp ? new Date(now.getTime() + backoff(attempt)).toISOString() : null;
    await db.insertDelivery({
      endpointId: endpoint.id,
      outboxEventId: event.id,
      attempt,
      statusCode: status > 0 ? status : null,
      nextRetryAt,
    });
  }
  if (failures === 0) {
    await db.markOutboxPublished(event.id, nowIso, attempt);
    return 'delivered';
  }
  if (attempt >= maxAttempts) {
    await db.markOutboxDeadLetter(event.id, nowIso, attempt);
    return 'deadLettered';
  }
  await db.markOutboxRetry(
    event.id,
    attempt,
    new Date(now.getTime() + backoff(attempt)).toISOString(),
  );
  return 'retrying';
}
