import { SIMULATION_API_KEYS, SIMULATION_ORG_IDS } from '@airexpay/configuration';
import { quoteConfiguredFee, signNowPaymentsBody } from '@airexpay/payment-core';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.ts';
import { MemoryDatabase } from '../../apps/api/src/db/memory.ts';
import { MemoryRateLimiter } from '../../apps/api/src/rate-limit.ts';

function app() {
  const db = new MemoryDatabase();
  return {
    db,
    api: createApp({
      db,
      environment: 'dev',
      allowedModesRaw: 'mock',
      modeAEnv: 'false',
      ipnSecret: 'simulation-ipn-secret',
      checkoutBaseUrl: 'http://localhost:5173',
    }),
  };
}

async function postInvoice(
  api: ReturnType<typeof createApp>,
  key: string,
  idempotencyKey: string,
  body: Record<string, unknown>,
) {
  return api.request('/v1/invoices', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'idempotency-key': idempotencyKey,
      'content-type': 'application/json',
      'x-request-id': 'req_test_invoice',
    },
    body: JSON.stringify(body),
  });
}

const invoiceBody = {
  price_amount: '49.00',
  price_currency: 'usd',
  pay_currency: 'btc',
  order_id: 'order_49',
  description: 'Simulated retainer',
};

describe('POST/GET /v1/invoices', () => {
  it('requires an API key and an idempotency key', async () => {
    const { api } = app();
    const unauthenticated = await api.request('/v1/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'idem_12345678' },
      body: JSON.stringify(invoiceBody),
    });
    expect(unauthenticated.status).toBe(401);
    const missingKey = await postInvoice(api, SIMULATION_API_KEYS.alpha, '', invoiceBody);
    expect(missingKey.status).toBe(400);
    const error = (await missingKey.json()) as { error: { code: string; request_id: string } };
    expect(error.error.code).toBe('idempotency_key_required');
    expect(error.error.request_id).toBeTruthy();
  });

  it('creates a mock invoice and replays the same idempotency key', async () => {
    const { api, db } = app();
    const created = await postInvoice(
      api,
      SIMULATION_API_KEYS.alpha,
      'idem_create_01',
      invoiceBody,
    );
    expect(created.status).toBe(201);
    expect(created.headers.get('x-request-id')).toBe('req_test_invoice');
    const body = (await created.json()) as {
      id: string;
      public_id: string;
      status: string;
      livemode: boolean;
      pay_address: string;
      pay_amount: string;
      provider: string;
      payment: { provider_payment_id: string; status: string };
      fee: {
        quoted_at: string;
        provider_fee: string;
        margin: string;
        total_fee: string;
        margin_multiplier: string;
        provider_fee_rate: string;
        network_fee: string;
        network_fee_charged: string;
        network_fee_marked_up: boolean;
        rounding: string;
        plan_version: number;
      };
    };
    expect(body.livemode).toBe(false);
    expect(body.fee.margin_multiplier).toBe('1.5');
    expect(body.fee.rounding).toBe('half_away_from_zero');
    expect(body.fee.network_fee_marked_up).toBe(false);
    const quoted = quoteConfiguredFee({
      at: body.fee.quoted_at,
      priceAmount: '49.00',
      currency: 'USD',
      networkFee: '0',
    });
    expect(body.fee.provider_fee_rate).toBe(quoted.providerFeeRate);
    expect(body.fee.plan_version).toBe(quoted.planVersion);
    expect(body.fee.provider_fee).toBe(quoted.providerFee);
    expect(body.fee.margin).toBe(quoted.margin);
    expect(body.fee.total_fee).toBe(quoted.totalFee);
    expect(body.fee.network_fee).toBe('0.00');
    expect(body.fee.network_fee_charged).toBe('0.00');
    expect(body.status).toBe('waiting');
    expect(body.provider).toBe('mock');
    expect(body.pay_address.startsWith('tb1qsim')).toBe(true);
    expect(body.payment.status).toBe('waiting');

    const replay = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_create_01', invoiceBody);
    expect(replay.status).toBe(201);
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    const replayed = (await replay.json()) as { id: string };
    expect(replayed.id).toBe(body.id);
    expect(db.listWebhooks()).toHaveLength(0);

    const conflict = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_create_01', {
      ...invoiceBody,
      order_id: 'other',
    });
    expect(conflict.status).toBe(409);
    const conflictBody = (await conflict.json()) as { error: { code: string } };
    expect(conflictBody.error.code).toBe('idempotency_key_reuse');

    const fetched = await api.request(`/v1/invoices/${body.public_id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.alpha}` },
    });
    expect(fetched.status).toBe(200);
    const view = (await fetched.json()) as { id: string; status: string };
    expect(view.id).toBe(body.id);
    expect(view.status).toBe('waiting');
  });

  it('hides invoices from another organization', async () => {
    const { api } = app();
    const created = await postInvoice(
      api,
      SIMULATION_API_KEYS.alpha,
      'idem_org_alpha',
      invoiceBody,
    );
    const body = (await created.json()) as { id: string };
    const cross = await api.request(`/v1/invoices/${body.id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.beta}` },
    });
    expect(cross.status).toBe(404);
    expect(SIMULATION_ORG_IDS.alpha).not.toBe(SIMULATION_ORG_IDS.beta);
  });

  it('snapshots a 100.00 USD invoice as provider fee 1.50, margin 0.75, and total 2.25', async () => {
    const { api } = app();
    const created = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_fee_100', {
      ...invoiceBody,
      price_amount: '100.00',
      order_id: 'order_100',
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      fee: {
        provider_fee_rate: string;
        margin_multiplier: string;
        provider_fee: string;
        margin: string;
        total_fee: string;
        network_fee_marked_up: boolean;
      };
    };
    expect(body.fee.provider_fee_rate).toBe('0.015');
    expect(body.fee.margin_multiplier).toBe('1.5');
    expect(body.fee.provider_fee).toBe('1.50');
    expect(body.fee.margin).toBe('0.75');
    expect(body.fee.total_fee).toBe('2.25');
    expect(body.fee.network_fee_marked_up).toBe(false);
  });

  it('applies a finished IPN once and ignores the duplicate', async () => {
    const { api, db } = app();
    const created = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_ipn_once', invoiceBody);
    const invoice = (await created.json()) as {
      id: string;
      pay_amount: string;
      pay_address: string;
      payment: { id: string; provider_payment_id: string };
      fee: { provider_fee: string; margin: string; total_fee: string };
    };
    const signed = await signNowPaymentsBody(
      {
        payment_id: invoice.payment.provider_payment_id,
        payment_status: 'finished',
        pay_amount: invoice.pay_amount,
        actually_paid: invoice.pay_amount,
        pay_address: invoice.pay_address,
        pay_currency: 'btc',
        order_id: 'order_49',
      },
      'simulation-ipn-secret',
    );
    const first = await api.request('/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': signed.signature },
      body: signed.rawBody,
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { applied: boolean; duplicate: boolean };
    expect(firstBody.applied).toBe(true);
    expect(firstBody.duplicate).toBe(false);

    const second = await api.request('/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': signed.signature },
      body: signed.rawBody,
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { duplicate: boolean; applied: boolean };
    expect(secondBody.duplicate).toBe(true);
    expect(secondBody.applied).toBe(false);
    expect(db.listWebhooks()).toHaveLength(1);

    const fetched = await api.request(`/v1/invoices/${invoice.id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.alpha}` },
    });
    const view = (await fetched.json()) as { status: string; payment: { status: string } };
    expect(view.status).toBe('paid');
    expect(view.payment.status).toBe('finished');
    const fulfillment = db
      .outboxFor(invoice.payment.id)
      .filter((event) => event.eventType === 'payment.finished');
    expect(fulfillment).toHaveLength(1);
    const usage = db.usageEntries(SIMULATION_ORG_IDS.alpha);
    expect(usage).toHaveLength(1);
    expect(usage[0]?.providerFee).toBe(invoice.fee.provider_fee);
    expect(usage[0]?.margin).toBe(invoice.fee.margin);
    expect(usage[0]?.totalFee).toBe(invoice.fee.total_fee);
  });

  it('stores an underpaid invoice and does not fulfill it', async () => {
    const { api, db } = app();
    const created = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_partial', invoiceBody);
    const invoice = (await created.json()) as {
      id: string;
      pay_amount: string;
      payment: { id: string; provider_payment_id: string };
    };
    const signed = await signNowPaymentsBody(
      {
        payment_id: invoice.payment.provider_payment_id,
        payment_status: 'partially_paid',
        pay_amount: invoice.pay_amount,
        actually_paid: '0.0001',
        pay_currency: 'btc',
      },
      'simulation-ipn-secret',
    );
    const response = await api.request('/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': signed.signature },
      body: signed.rawBody,
    });
    expect(response.status).toBe(200);
    const fetched = await api.request(`/v1/invoices/${invoice.id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.alpha}` },
    });
    const view = (await fetched.json()) as { status: string };
    expect(view.status).toBe('underpaid');
    expect(
      db.outboxFor(invoice.payment.id).some((event) => event.eventType === 'payment.finished'),
    ).toBe(false);
    expect(db.usageEntries(SIMULATION_ORG_IDS.alpha)).toHaveLength(0);
  });

  it('rejects a tampered IPN and leaves the invoice waiting', async () => {
    const { api, db } = app();
    const created = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_tamper', invoiceBody);
    const invoice = (await created.json()) as {
      id: string;
      pay_amount: string;
      payment: { provider_payment_id: string };
    };
    const signed = await signNowPaymentsBody(
      {
        payment_id: invoice.payment.provider_payment_id,
        payment_status: 'finished',
        pay_amount: invoice.pay_amount,
        actually_paid: invoice.pay_amount,
      },
      'simulation-ipn-secret',
    );
    const tampered = signed.rawBody.replace('finished', 'finished ');
    const response = await api.request('/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': signed.signature },
      body: tampered,
    });
    expect(response.status).toBe(401);
    const again = await api.request('/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': 'deadbeef' },
      body: tampered,
    });
    expect(again.status).toBe(401);
    expect(db.listWebhooks().every((row) => row.signatureValid === false)).toBe(true);
    const fetched = await api.request(`/v1/invoices/${invoice.id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.alpha}` },
    });
    const view = (await fetched.json()) as { status: string };
    expect(view.status).toBe('waiting');
  });
});

describe('public checkout', () => {
  it('creates through the dev route, polls status, and shows paid only after the server confirms', async () => {
    const { api } = app();
    const created = await api.request('/api/dev/checkout/invoices', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'idem_checkout_01',
      },
      body: JSON.stringify(invoiceBody),
    });
    expect(created.status).toBe(201);
    const checkout = (await created.json()) as Record<string, unknown>;
    expect(checkout.status).toBe('waiting');
    expect(Object.keys(checkout).sort()).toEqual(
      [
        'actually_paid',
        'description',
        'expires_at',
        'late_payment_review',
        'livemode',
        'merchant_name',
        'network',
        'object',
        'overpaid',
        'pay_address',
        'pay_amount',
        'pay_currency',
        'price_amount',
        'price_currency',
        'public_id',
        'status',
      ].sort(),
    );
    expect(JSON.stringify(checkout)).not.toMatch(
      /provider_payment|organization_id|ipn|secret|api_key/i,
    );
    expect(created.headers.get('authorization')).toBeNull();

    const other = await postInvoice(api, SIMULATION_API_KEYS.beta, 'idem_checkout_beta', {
      ...invoiceBody,
      order_id: 'beta_hidden',
    });
    const beta = (await other.json()) as { pay_address: string };
    const polled = await api.request(`/v1/checkout/${String(checkout.public_id)}`);
    expect(polled.status).toBe(200);
    const waiting = (await polled.json()) as { status: string; pay_address: string };
    expect(waiting.status).toBe('waiting');
    expect(waiting.pay_address).not.toBe(beta.pay_address);

    const simulated = await api.request(
      `/api/dev/checkout/${String(checkout.public_id)}/simulate`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment_status: 'finished' }),
      },
    );
    expect(simulated.status).toBe(200);
    const simulation = (await simulated.json()) as { simulated: boolean; status?: string };
    expect(simulation.simulated).toBe(true);
    expect(simulation.status).toBeUndefined();

    const confirmed = await api.request(`/v1/checkout/${String(checkout.public_id)}`);
    const paid = (await confirmed.json()) as { status: string };
    expect(paid.status).toBe('paid');
  });

  it('keeps dev simulation off outside dev and echoes only the checkout origin', async () => {
    const closed = createApp({
      db: new MemoryDatabase(),
      environment: 'test',
      allowedModesRaw: 'mock',
      checkoutBaseUrl: 'https://staging.airexpay.com',
    });
    const hidden = await closed.request('/api/dev/checkout/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'idem_hidden_1' },
      body: JSON.stringify(invoiceBody),
    });
    expect(hidden.status).toBe(404);

    const open = createApp({
      db: new MemoryDatabase(),
      environment: 'dev',
      allowedModesRaw: 'mock',
      checkoutBaseUrl: 'https://staging.airexpay.com',
    });
    const allowed = await open.request('/health', {
      headers: { origin: 'https://staging.airexpay.com' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://staging.airexpay.com');
    const blocked = await open.request('/health', { headers: { origin: 'https://evil.example' } });
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('records a rejected transition without changing the invoice', async () => {
    const { api, db } = app();
    const created = await postInvoice(
      api,
      SIMULATION_API_KEYS.alpha,
      'idem_reject_01',
      invoiceBody,
    );
    const invoice = (await created.json()) as {
      id: string;
      pay_amount: string;
      payment: { provider_payment_id: string };
    };
    const signed = await signNowPaymentsBody(
      {
        payment_id: invoice.payment.provider_payment_id,
        payment_status: 'refunded',
        pay_amount: invoice.pay_amount,
        actually_paid: '0',
      },
      'simulation-ipn-secret',
    );
    const response = await api.request('/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': signed.signature },
      body: signed.rawBody,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { applied: boolean; reason: string };
    expect(body.applied).toBe(false);
    expect(body.reason).toBe('forbidden_transition');
    const view = await api.request(`/v1/invoices/${invoice.id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.alpha}` },
    });
    expect(((await view.json()) as { status: string }).status).toBe('waiting');
    expect(db.listAudits().some((row) => row.action === 'payment.transition_rejected')).toBe(true);
  });
});

describe('simulation checkout gate', () => {
  const body = JSON.stringify(invoiceBody);

  async function post(environment: string, allowedModes: string, livemode = false) {
    const api = createApp({
      db: new MemoryDatabase(),
      environment,
      allowedModesRaw: allowedModes,
      livemode,
      checkoutBaseUrl: 'https://staging.airexpay.com',
    });
    return api.request('/api/dev/checkout/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'idem_gate_1' },
      body,
    });
  }

  it('rejects the routes in production, when livemode is on, and when a real provider is allowed', async () => {
    expect((await post('production', 'mock')).status).toBe(404);
    const production = createApp({
      db: new MemoryDatabase(),
      environment: 'production',
      allowedModesRaw: 'mock',
      checkoutBaseUrl: 'https://staging.airexpay.com',
    });
    expect(
      (
        await production.request('/api/dev/checkout/inv_missing/simulate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ payment_status: 'finished' }),
        })
      ).status,
    ).toBe(404);
    expect((await post('staging', 'mock', true)).status).toBe(404);
    expect((await post('dev', 'mock', true)).status).toBe(404);
    expect((await post('staging', 'mock,nowpayments_direct')).status).toBe(404);
    expect((await post('staging', 'nowpayments_direct')).status).toBe(404);
  });

  it('allows the staging mock simulation route and rate-limits it', async () => {
    const opened = await post('staging', 'mock', false);
    expect(opened.status).toBe(201);

    const limiter = new MemoryRateLimiter(2, 60_000);
    const api = createApp({
      db: new MemoryDatabase(),
      environment: 'dev',
      allowedModesRaw: 'mock',
      livemode: false,
      rateLimit: limiter,
      checkoutBaseUrl: 'http://localhost:5173',
    });
    const first = await api.request('/api/dev/checkout/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'idem_rate_1' },
      body,
    });
    const second = await api.request('/api/dev/checkout/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'idem_rate_2' },
      body,
    });
    const third = await api.request('/api/dev/checkout/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'idem_rate_3' },
      body,
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
    const payload = (await third.json()) as { error: { code: string } };
    expect(payload.error.code).toBe('rate_limited');
  });
});

describe('health', () => {
  it('reports simulation mode', async () => {
    const { api } = app();
    const response = await api.request('/health');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      livemode: boolean;
      mode_a_enabled: boolean;
    };
    expect(body.status).toBe('ok');
    expect(body.livemode).toBe(false);
    expect(body.mode_a_enabled).toBe(false);
  });
});
