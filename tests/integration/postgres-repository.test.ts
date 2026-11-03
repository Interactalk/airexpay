import { SIMULATION_API_KEYS, SIMULATION_ORG_IDS } from '@airexpay/configuration';
import { signNowPaymentsBody, verifyMerchantWebhook } from '@airexpay/payment-core';
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.ts';
import { PostgresRepository } from '../../apps/api/src/db/postgres.ts';
import type { SqlPool } from '../../apps/api/src/db/repository.ts';
import { runOutboxWorker } from '../../apps/api/src/services/outbox-worker.ts';
import { embeddedDatabase } from '../helpers/database.ts';
import { TEST_WEBHOOK_KEYS } from '../helpers/webhook-key.ts';

function asSqlPool(db: PGlite): SqlPool {
  return {
    query: (text, params) => db.query(text, params ? [...params] : []),
    transaction: (run) =>
      db.transaction(async (tx) =>
        run({
          query: (text, params) => tx.query(text, params ? [...params] : []),
        }),
      ),
  };
}

async function seeded() {
  const pg = await embeddedDatabase();
  await pg.query(
    `insert into public.organizations (id, legal_name, display_name) values
      ($1::uuid, 'Alpha LLC', 'Northwind Studio'),
      ($2::uuid, 'Beta LLC', 'Harbor Goods')`,
    [SIMULATION_ORG_IDS.alpha, SIMULATION_ORG_IDS.beta],
  );
  const db = new PostgresRepository(asSqlPool(pg), TEST_WEBHOOK_KEYS);
  const api = createApp({
    db,
    environment: 'dev',
    allowedModesRaw: 'mock',
    ipnSecret: 'simulation-ipn-secret',
    checkoutBaseUrl: 'https://staging.airexpay.com',
  });
  return { pg, db, api };
}

const invoiceBody = {
  price_amount: '49.00',
  price_currency: 'usd',
  pay_currency: 'btc',
  order_id: 'order_pg',
  description: "'); drop table public.invoices; --",
};

async function postInvoice(
  api: ReturnType<typeof createApp>,
  key: string,
  idempotencyKey: string,
  body: Record<string, unknown> = invoiceBody,
) {
  return api.request('/v1/invoices', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'idempotency-key': idempotencyKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('postgres repository', () => {
  it('isolates tenants, replays idempotency, and guards transitions', async () => {
    const { pg, db, api } = await seeded();
    const created = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_pg_alpha');
    expect(created.status).toBe(201);
    const alpha = (await created.json()) as {
      id: string;
      public_id: string;
      pay_address: string;
      pay_amount: string;
      checkout_url: string;
      payment: { id: string; provider_payment_id: string };
    };
    expect(alpha.checkout_url.startsWith('https://staging.airexpay.com/pay/')).toBe(true);

    const replay = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_pg_alpha');
    expect(replay.headers.get('idempotency-replayed')).toBe('true');
    const replayed = (await replay.json()) as { id: string };
    expect(replayed.id).toBe(alpha.id);

    const conflict = await postInvoice(api, SIMULATION_API_KEYS.alpha, 'idem_pg_alpha', {
      ...invoiceBody,
      order_id: 'other',
    });
    expect(conflict.status).toBe(409);

    const beta = await postInvoice(api, SIMULATION_API_KEYS.beta, 'idem_pg_beta', {
      ...invoiceBody,
      order_id: 'beta_order',
      description: 'beta only',
    });
    const betaBody = (await beta.json()) as { id: string; pay_address: string };
    const cross = await api.request(`/v1/invoices/${alpha.id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.beta}` },
    });
    expect(cross.status).toBe(404);
    const hidden = await db.getInvoice(alpha.id, SIMULATION_ORG_IDS.beta);
    expect(hidden).toBeNull();
    const own = await db.getInvoice(betaBody.id, SIMULATION_ORG_IDS.beta);
    expect(own?.payAddress).toBe(betaBody.pay_address);
    expect(own?.payAddress).not.toBe(alpha.pay_address);

    const tables = await pg.query<{ count: string }>(
      `select count(*)::text as count from public.invoices`,
    );
    expect(Number(tables.rows[0]?.count)).toBeGreaterThan(0);

    const checkout = await api.request(`/v1/checkout/${alpha.public_id}`);
    expect(checkout.status).toBe(200);
    const view = (await checkout.json()) as Record<string, unknown>;
    expect(view.status).toBe('waiting');
    expect(view.pay_address).toBe(alpha.pay_address);
    expect(JSON.stringify(view)).not.toContain(betaBody.pay_address);
    expect(JSON.stringify(view)).not.toMatch(
      /provider_payment_id|organization_id|ipn|secret|api_key/i,
    );

    const signed = await signNowPaymentsBody(
      {
        payment_id: alpha.payment.provider_payment_id,
        payment_status: 'refunded',
        pay_amount: alpha.pay_amount,
        actually_paid: '0',
      },
      'simulation-ipn-secret',
    );
    const rejected = await api.request('/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': signed.signature },
      body: signed.rawBody,
    });
    expect(rejected.status).toBe(200);
    const rejectedBody = (await rejected.json()) as { applied: boolean; reason: string };
    expect(rejectedBody.applied).toBe(false);
    expect(rejectedBody.reason).toBe('forbidden_transition');
    const still = await db.getInvoice(alpha.id, SIMULATION_ORG_IDS.alpha);
    expect(still?.status).toBe('waiting');
    const audits = await db.listAudits();
    expect(audits.some((row) => row.action === 'payment.transition_rejected')).toBe(true);

    const finished = await signNowPaymentsBody(
      {
        payment_id: alpha.payment.provider_payment_id,
        payment_status: 'finished',
        pay_amount: alpha.pay_amount,
        actually_paid: alpha.pay_amount,
      },
      'simulation-ipn-secret',
    );
    const paid = await api.request('/api/webhooks/nowpayments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': finished.signature },
      body: finished.rawBody,
    });
    expect(paid.status).toBe(200);
    const after = await db.getInvoice(alpha.id, SIMULATION_ORG_IDS.alpha);
    expect(after?.status).toBe('paid');
    expect(after?.paymentStatus).toBe('finished');

    await expect(
      pg.query(`update public.payments set status = 'failed' where id = $1::uuid`, [
        alpha.payment.id,
      ]),
    ).rejects.toThrow(/apply_payment_event/);

    const endpoint = await db.saveWebhookEndpoint({
      organizationId: SIMULATION_ORG_IDS.alpha,
      url: 'https://merchant.example/hooks',
      secret: 'merchant-webhook-secret',
      events: ['payment.finished'],
    });
    const calls: { body: string; header: string; timestamp: string }[] = [];
    const report = await runOutboxWorker(db, {
      environment: 'dev',
      now: () => new Date('2026-11-03T14:10:00.000Z'),
      fetchImpl: async (url, init) => {
        expect(url).toBe(endpoint.url);
        calls.push({
          body: init.body,
          header: init.headers['AirExpay-Signature'] ?? '',
          timestamp: init.headers['AirExpay-Timestamp'] ?? '',
        });
        return { status: 204 };
      },
    });
    expect(report.delivered).toBe(1);
    expect(calls).toHaveLength(1);
    expect(
      await verifyMerchantWebhook(
        'merchant-webhook-secret',
        calls[0]?.body ?? '',
        calls[0]?.timestamp ?? '',
        calls[0]?.header ?? '',
      ),
    ).toBe(true);
    const stored = await pg.query<{ secret: string }>(
      `select convert_from(secret_ciphertext, 'UTF8') as secret
       from public.webhook_endpoints where id = $1::uuid`,
      [endpoint.id],
    );
    const ciphertext = stored.rows[0]?.secret ?? '';
    expect(ciphertext.startsWith('v1.')).toBe(true);
    expect(ciphertext).not.toContain('merchant-webhook-secret');

    const past = new Date(Date.now() - 1000).toISOString();
    await db.saveIdempotency({
      organizationId: SIMULATION_ORG_IDS.alpha,
      key: 'idem_expired_key',
      requestHash: 'hash',
      statusCode: 201,
      response: { ok: true },
      expiresAt: past,
    });
    expect(
      await db.getIdempotency(
        SIMULATION_ORG_IDS.alpha,
        'idem_expired_key',
        new Date().toISOString(),
      ),
    ).toBeNull();
    expect(
      await db.getIdempotency(SIMULATION_ORG_IDS.beta, 'idem_pg_alpha', new Date().toISOString()),
    ).toBeNull();
  });
});
