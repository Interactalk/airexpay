import {
  SIMULATION_API_KEYS,
  SIMULATION_ORG_IDS,
  type ProviderMode,
} from '@airexpay/configuration';
import {
  getProvider,
  quoteConfiguredFee,
  timingSafeEqual,
  type ProviderContext,
} from '@airexpay/payment-core';
import { newPublicId } from '@airexpay/shared';
import {
  createInvoiceSchema,
  idempotencyKeySchema,
  type CreateInvoiceBody,
} from '@airexpay/validation';
import type { Context } from 'hono';
import type { SimulationRateLimit } from '../rate-limit.ts';
import type { InvoiceRecord, InvoiceRepository } from '../db/repository.ts';
import { errorBody, logEvent } from '../http.ts';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface InvoiceDeps {
  db: InvoiceRepository;
  ipnSecret: string;
  allowedModes: readonly ProviderMode[];
  modeAEnv: string | undefined;
  checkoutBaseUrl: string;
  environment: string;
  livemode: boolean;
  rateLimit: SimulationRateLimit;
}

export function organizationForApiKey(token: string): string | null {
  if (timingSafeEqual(token, SIMULATION_API_KEYS.alpha)) return SIMULATION_ORG_IDS.alpha;
  if (timingSafeEqual(token, SIMULATION_API_KEYS.beta)) return SIMULATION_ORG_IDS.beta;
  return null;
}

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function invoiceJson(record: InvoiceRecord) {
  return {
    id: record.id,
    public_id: record.publicId,
    object: 'invoice',
    livemode: false,
    status: record.status,
    number: record.number,
    price_amount: record.priceAmount,
    price_currency: record.priceCurrency,
    pay_amount: record.payAmount,
    pay_currency: record.payCurrency,
    pay_address: record.payAddress,
    actually_paid: record.actuallyPaid,
    network: record.network,
    order_id: record.orderId,
    description: record.description,
    checkout_url: record.checkoutUrl,
    expires_at: record.expiresAt,
    overpaid: record.overpaid,
    late_payment_review: record.latePaymentReview,
    provider: record.provider,
    payment: {
      id: record.paymentId,
      provider_payment_id: record.providerPaymentId,
      status: record.paymentStatus,
      raw_status: record.rawStatus,
    },
    fee: record.feeSnapshot
      ? {
          plan_id: record.feeSnapshot.planId,
          plan_version: record.feeSnapshot.planVersion,
          effective_from: record.feeSnapshot.effectiveFrom,
          quoted_at: record.feeSnapshot.quotedAt,
          provider_fee_rate: record.feeSnapshot.providerFeeRate,
          margin_multiplier: record.feeSnapshot.marginMultiplier,
          provider_fee: record.feeSnapshot.providerFee,
          margin: record.feeSnapshot.margin,
          total_fee: record.feeSnapshot.totalFee,
          network_fee: record.feeSnapshot.networkFee,
          network_fee_charged: record.feeSnapshot.networkFeeCharged,
          network_fee_marked_up: record.feeSnapshot.networkFeeMarkedUp,
          currency: record.feeSnapshot.currency,
          rounding: record.feeSnapshot.rounding,
        }
      : null,
  };
}

export async function createInvoice(c: Context, deps: InvoiceDeps): Promise<Response> {
  const requestId = c.get('requestId') as string;
  const organizationId = organizationForApiKey(readBearer(c.req.header('authorization')) ?? '');
  if (!organizationId) {
    return c.json(
      errorBody(requestId, 'authentication_error', 'invalid_api_key', 'API key was not recognized'),
      401,
    );
  }
  const keyParsed = idempotencyKeySchema.safeParse(c.req.header('idempotency-key'));
  if (!keyParsed.success) {
    return c.json(
      errorBody(
        requestId,
        'invalid_request_error',
        'idempotency_key_required',
        'Idempotency-Key is required (8–255 printable characters)',
      ),
      400,
    );
  }
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'invalid_json', 'Request body must be JSON'),
      400,
    );
  }
  const parsed = createInvoiceSchema.safeParse(payload);
  if (!parsed.success) {
    return c.json(
      errorBody(
        requestId,
        'invalid_request_error',
        'validation_failed',
        parsed.error.issues.map((issue) => issue.message).join('; '),
      ),
      400,
    );
  }
  const body: CreateInvoiceBody = parsed.data;
  const requestHash = JSON.stringify(body);
  const now = new Date();
  const nowIso = now.toISOString();
  const existing = await deps.db.getIdempotency(organizationId, keyParsed.data, nowIso);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      return c.json(
        errorBody(
          requestId,
          'idempotency_error',
          'idempotency_key_reuse',
          'This Idempotency-Key was already used with a different request body',
        ),
        409,
      );
    }
    c.header('Idempotency-Replayed', 'true');
    return c.json(existing.response, existing.statusCode as 201);
  }

  if (!deps.allowedModes.includes('mock')) {
    return c.json(
      errorBody(requestId, 'provider_error', 'mock_unavailable', 'Mock provider is not allowed'),
      503,
    );
  }

  const provider = getProvider({
    mode: 'mock',
    allowedModes: deps.allowedModes,
    modeAEnv: deps.modeAEnv,
  });
  const ctx: ProviderContext = {
    organizationId,
    connectionId: 'sim_conn_mock',
    mode: 'mock',
    credentials: { apiKey: 'simulation', ipnSecret: deps.ipnSecret },
    sandbox: true,
  };
  const payment = await provider.createPayment(ctx, {
    priceAmount: body.price_amount,
    priceCurrency: body.price_currency,
    payCurrency: (body.pay_currency ?? 'BTC').toLowerCase(),
    orderId: body.order_id,
    ...(body.description ? { description: body.description } : {}),
    callbackUrl: '/api/webhooks/nowpayments',
    ...(body.success_url ? { successUrl: body.success_url } : {}),
    ...(body.cancel_url ? { cancelUrl: body.cancel_url } : {}),
  });
  const raw = payment.raw as { invoice_id?: string; network?: string };
  const publicId = newPublicId('inv');
  const feeSnapshot = quoteConfiguredFee({
    at: nowIso,
    priceAmount: body.price_amount,
    currency: body.price_currency,
    networkFee: '0',
  });
  const record = await deps.db.createInvoice({
    organizationId,
    publicId,
    priceAmount: body.price_amount,
    priceCurrency: body.price_currency,
    payCurrency: (payment.payCurrency ?? body.pay_currency ?? 'BTC').toUpperCase(),
    payAmount: payment.payAmount ?? '0',
    payAddress: payment.payAddress ?? '',
    providerInvoiceId: raw.invoice_id ?? publicId,
    providerPaymentId: payment.providerPaymentId,
    orderId: body.order_id,
    description: body.description ?? null,
    checkoutUrl: `${deps.checkoutBaseUrl.replace(/\/$/, '')}/pay/${publicId}`,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    createdAt: nowIso,
    network: raw.network ?? null,
    feeSnapshot,
  });
  const response = invoiceJson(record);
  await deps.db.saveIdempotency({
    organizationId,
    key: keyParsed.data,
    requestHash,
    statusCode: 201,
    response,
    expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS).toISOString(),
  });
  logEvent({
    level: 'info',
    msg: 'invoice.created',
    request_id: requestId,
    organization_id: organizationId,
    invoice_id: record.id,
    status: record.status,
  });
  return c.json(response, 201);
}

export async function getInvoice(c: Context, deps: InvoiceDeps): Promise<Response> {
  const requestId = c.get('requestId') as string;
  const organizationId = organizationForApiKey(readBearer(c.req.header('authorization')) ?? '');
  if (!organizationId) {
    return c.json(
      errorBody(requestId, 'authentication_error', 'invalid_api_key', 'API key was not recognized'),
      401,
    );
  }
  const id = c.req.param('id');
  if (!id) {
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'not_found', 'Invoice not found'),
      404,
    );
  }
  const record = await deps.db.getInvoice(id, organizationId);
  if (!record) {
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'not_found', 'Invoice not found'),
      404,
    );
  }
  return c.json(invoiceJson(record), 200);
}
