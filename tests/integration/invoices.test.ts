import { SIMULATION_API_KEYS, SIMULATION_ORG_IDS } from '@airexpay/configuration';
import { signNowPaymentsBody } from '@airexpay/payment-core';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.ts';
import { MemoryDatabase } from '../../apps/api/src/db/memory.ts';

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
    };
    expect(body.livemode).toBe(false);
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

  it('applies a finished IPN once and ignores the duplicate', async () => {
    const { api, db } = app();
    const created = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_ipn_once', invoiceBody);
    const invoice = (await created.json()) as {
      id: string;
      pay_amount: string;
      pay_address: string;
      payment: { id: string; provider_payment_id: string };
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
