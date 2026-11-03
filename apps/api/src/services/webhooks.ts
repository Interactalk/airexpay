import {
  decimalFromProviderValue,
  verifyNowPaymentsSignature,
  webhookDedupeKey,
} from '@airexpay/payment-core';
import { isPaymentStatus } from '@airexpay/shared';
import { nowPaymentsIpnSchema } from '@airexpay/validation';
import type { Context } from 'hono';
import type { InvoiceRepository } from '../db/repository.ts';
import { errorBody, logEvent, redactHeaders } from '../http.ts';

const MAX_BODY = 1_000_000;

export async function handleNowPaymentsWebhook(
  c: Context,
  deps: { db: InvoiceRepository; ipnSecret: string },
): Promise<Response> {
  const requestId = c.get('requestId') as string;
  const raw = await c.req.text();
  if (raw.length > MAX_BODY) {
    return c.json(
      errorBody(
        requestId,
        'invalid_request_error',
        'payload_too_large',
        'Webhook body is too large',
      ),
      413,
    );
  }
  const receivedAt = new Date().toISOString();
  const signature = c.req.header('x-nowpayments-sig') ?? null;
  const verification = await verifyNowPaymentsSignature(raw, signature, deps.ipnSecret);
  const dedupeKey = await webhookDedupeKey('nowpayments', raw);
  const headers = redactHeaders(c.req.raw.headers);

  let payload: unknown = verification.parsed ?? null;
  if (payload === null) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = { unparsed: true };
    }
  }

  if (!verification.valid) {
    const stored = await deps.db.acceptWebhook({
      dedupeKey,
      signatureValid: false,
      headers,
      payload,
      receivedAt,
      reason: verification.reason ?? 'invalid',
    });
    logEvent({
      level: 'warn',
      msg: 'webhook.rejected',
      request_id: requestId,
      reason: verification.reason ?? 'invalid',
      duplicate: stored.duplicate,
    });
    return c.json(
      errorBody(
        requestId,
        'authentication_error',
        'invalid_signature',
        'NOWPayments signature verification failed',
      ),
      401,
    );
  }

  const parsed = nowPaymentsIpnSchema.safeParse(verification.parsed);
  if (!parsed.success) {
    await deps.db.acceptWebhook({
      dedupeKey,
      signatureValid: true,
      headers,
      payload,
      receivedAt,
      reason: 'invalid_payload',
    });
    return c.json(
      errorBody(
        requestId,
        'invalid_request_error',
        'invalid_payload',
        'Webhook payload is not a payment IPN',
      ),
      422,
    );
  }

  const rawStatus = parsed.data.payment_status;
  const toStatus = isPaymentStatus(rawStatus) ? rawStatus : undefined;
  const result = await deps.db.acceptWebhook({
    dedupeKey,
    signatureValid: true,
    headers,
    payload,
    receivedAt,
    providerPaymentId: String(parsed.data.payment_id),
    ...(toStatus ? { toStatus } : {}),
    actuallyPaid: decimalFromProviderValue(parsed.data.actually_paid) ?? null,
    payAmount: decimalFromProviderValue(parsed.data.pay_amount) ?? null,
    reason: toStatus ? null : 'unknown_status',
  });

  logEvent({
    level: 'info',
    msg: 'webhook.acked',
    request_id: requestId,
    duplicate: result.duplicate,
    matched: result.matched,
    applied: result.transition?.applied ?? false,
    reason: result.duplicate ? 'duplicate' : (result.transition?.reason ?? result.webhook.reason),
  });

  return c.json(
    {
      received: true,
      duplicate: result.duplicate,
      matched: result.duplicate ? undefined : result.matched,
      applied: result.transition?.applied ?? false,
      reason: result.duplicate ? 'duplicate' : (result.transition?.reason ?? result.webhook.reason),
    },
    200,
  );
}
