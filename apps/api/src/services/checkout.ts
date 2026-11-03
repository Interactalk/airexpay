import { SIMULATION_API_KEYS, simulationCheckoutAllowed } from '@airexpay/configuration';
import { signNowPaymentsBody } from '@airexpay/payment-core';
import { divideDecimal, isPaymentStatus } from '@airexpay/shared';
import type { Context } from 'hono';
import type { InvoiceRecord } from '../db/repository.ts';
import { errorBody } from '../http.ts';
import { simulationClientKey } from '../rate-limit.ts';
import type { InvoiceDeps } from './invoices.ts';

export function toPublicCheckout(record: InvoiceRecord) {
  return {
    object: 'checkout' as const,
    livemode: false as const,
    public_id: record.publicId,
    status: record.status,
    merchant_name: record.merchantName,
    price_amount: record.priceAmount,
    price_currency: record.priceCurrency,
    pay_amount: record.payAmount,
    pay_currency: record.payCurrency,
    pay_address: record.payAddress,
    actually_paid: record.actuallyPaid,
    network: record.network,
    description: record.description,
    expires_at: record.expiresAt,
    overpaid: record.overpaid,
    late_payment_review: record.latePaymentReview,
  };
}

function notFound(c: Context, requestId: string): Response {
  return c.json(errorBody(requestId, 'invalid_request_error', 'not_found', 'Route not found'), 404);
}

export async function getPublicCheckout(c: Context, deps: InvoiceDeps): Promise<Response> {
  const requestId = c.get('requestId') as string;
  const publicId = c.req.param('publicId');
  if (!publicId) return notFound(c, requestId);
  const record = await deps.db.getByPublicId(publicId);
  if (!record) {
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'not_found', 'Checkout not found'),
      404,
    );
  }
  return c.json(toPublicCheckout(record), 200);
}

async function rejectSimulation(c: Context, deps: InvoiceDeps): Promise<Response | null> {
  const requestId = c.get('requestId') as string;
  if (
    !simulationCheckoutAllowed({
      environment: deps.environment,
      allowedModes: deps.allowedModes,
      livemode: deps.livemode,
    })
  ) {
    return notFound(c, requestId);
  }
  const decision = await deps.rateLimit.take(simulationClientKey(c.req.raw.headers), Date.now());
  if (!decision.allowed) {
    c.header('Retry-After', String(decision.retryAfterSeconds));
    return c.json(
      errorBody(
        requestId,
        'rate_limit_error',
        'rate_limited',
        'Too many simulation checkout requests',
      ),
      429,
    );
  }
  return null;
}

export async function createDevCheckout(
  c: Context,
  deps: InvoiceDeps,
  forward: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
  const requestId = c.get('requestId') as string;
  const rejected = await rejectSimulation(c, deps);
  if (rejected) return rejected;
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'invalid_json', 'Request body must be JSON'),
      400,
    );
  }
  const upstream = await Promise.resolve(
    forward(
      new Request('http://airexpay.internal/v1/invoices', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${SIMULATION_API_KEYS.alpha}`,
          'content-type': 'application/json',
          'idempotency-key': c.req.header('idempotency-key') ?? '',
          'x-request-id': requestId,
        },
        body: JSON.stringify(payload),
      }),
    ),
  );
  if (!upstream.ok) {
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  }
  const created = (await upstream.json()) as { public_id?: string };
  if (!created.public_id) {
    return c.json(
      errorBody(requestId, 'api_error', 'internal_error', 'Checkout was not created'),
      500,
    );
  }
  const record = await deps.db.getByPublicId(created.public_id);
  if (!record) {
    return c.json(
      errorBody(requestId, 'api_error', 'internal_error', 'Checkout was not created'),
      500,
    );
  }
  return c.json(toPublicCheckout(record), 201);
}

export async function simulateDevCheckout(
  c: Context,
  deps: InvoiceDeps,
  forward: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
  const requestId = c.get('requestId') as string;
  const rejected = await rejectSimulation(c, deps);
  if (rejected) return rejected;
  const publicId = c.req.param('publicId');
  if (!publicId) return notFound(c, requestId);
  const record = await deps.db.getByPublicId(publicId);
  if (!record) {
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'not_found', 'Checkout not found'),
      404,
    );
  }
  let paymentStatus = 'finished';
  const raw = await c.req.text();
  if (raw.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return c.json(
        errorBody(requestId, 'invalid_request_error', 'invalid_json', 'Request body must be JSON'),
        400,
      );
    }
    if (body && typeof body === 'object' && 'payment_status' in body) {
      const requested = (body as { payment_status?: unknown }).payment_status;
      if (typeof requested !== 'string' || !isPaymentStatus(requested)) {
        return c.json(
          errorBody(
            requestId,
            'invalid_request_error',
            'validation_failed',
            'Unknown payment status',
          ),
          400,
        );
      }
      paymentStatus = requested;
    }
  }
  const actuallyPaid =
    paymentStatus === 'partially_paid'
      ? partialAmount(record.payAmount)
      : paymentStatus === 'expired' || paymentStatus === 'failed' || paymentStatus === 'waiting'
        ? '0'
        : record.payAmount;
  const signed = await signNowPaymentsBody(
    {
      payment_id: record.providerPaymentId,
      payment_status: paymentStatus,
      pay_amount: record.payAmount,
      actually_paid: actuallyPaid,
      pay_currency: record.payCurrency.toLowerCase(),
      price_amount: record.priceAmount,
      price_currency: record.priceCurrency.toLowerCase(),
      order_id: record.orderId,
      pay_address: record.payAddress,
    },
    deps.ipnSecret,
  );
  const webhook = await Promise.resolve(
    forward(
      new Request('http://airexpay.internal/api/webhooks/nowpayments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-nowpayments-sig': signed.signature,
          'x-request-id': requestId,
        },
        body: signed.rawBody,
      }),
    ),
  );
  const payload = (await webhook.json()) as unknown;
  if (!webhook.ok) {
    return c.json({ simulated: false, webhook: payload }, 422);
  }
  return c.json({ simulated: true, webhook: payload }, 200);
}

function partialAmount(payAmount: string): string {
  try {
    return divideDecimal(payAmount, '2', 8);
  } catch {
    return '0';
  }
}
