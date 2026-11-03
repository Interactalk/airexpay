import {
  merchantWebhookBackoffMs,
  MERCHANT_WEBHOOK_MAX_ATTEMPTS,
  signMerchantWebhook,
  verifyMerchantWebhook,
} from '@airexpay/payment-core';
import { describe, expect, it } from 'vitest';
import { MemoryDatabase } from '../../apps/api/src/db/memory.ts';
import { runOutboxWorker } from '../../apps/api/src/services/outbox-worker.ts';
import { TEST_WEBHOOK_KEYS } from '../helpers/webhook-key.ts';

const SECRET = 'merchant-webhook-secret';

describe('merchant webhook signatures', () => {
  it('binds the timestamp into an HMAC-SHA256 header', async () => {
    const body = '{"id":"evt_1","type":"payment.finished"}';
    const signed = await signMerchantWebhook(SECRET, body, '1700000000');
    expect(signed.signature).toHaveLength(64);
    expect(signed.header).toBe(`t=1700000000,v1=${signed.signature}`);
    expect(await verifyMerchantWebhook(SECRET, body, '1700000000', signed.header)).toBe(true);
    expect(await verifyMerchantWebhook(SECRET, body, '1700000001', signed.header)).toBe(false);
    expect(await verifyMerchantWebhook('other-secret', body, '1700000000', signed.header)).toBe(
      false,
    );
  });

  it('backs off and then stops', () => {
    expect(merchantWebhookBackoffMs(1)).toBe(1000);
    expect(merchantWebhookBackoffMs(2)).toBe(2000);
    expect(merchantWebhookBackoffMs(3)).toBe(4000);
    expect(MERCHANT_WEBHOOK_MAX_ATTEMPTS).toBe(5);
  });
});

describe('outbox worker', () => {
  it('delivers once, retries, and dead-letters without calling the network itself', async () => {
    const db = new MemoryDatabase(TEST_WEBHOOK_KEYS);
    const invoice = db.createInvoice({
      organizationId: '11111111-1111-4111-8111-111111111111',
      publicId: 'inv_outbox',
      priceAmount: '10.00',
      priceCurrency: 'USD',
      payCurrency: 'BTC',
      payAmount: '0.00020000',
      payAddress: 'tb1qsim',
      providerInvoiceId: 'mockinv_1',
      providerPaymentId: 'mockpay_1',
      orderId: 'order_1',
      description: null,
      checkoutUrl: 'http://localhost:5173/pay/inv_outbox',
      expiresAt: '2026-11-03T15:00:00.000Z',
      createdAt: '2026-11-03T14:00:00.000Z',
      network: 'bitcoin',
    });
    db.acceptWebhook({
      dedupeKey: 'nowpayments:finished',
      signatureValid: true,
      headers: {},
      payload: { payment_status: 'finished' },
      receivedAt: '2026-11-03T14:05:00.000Z',
      providerPaymentId: invoice.providerPaymentId,
      toStatus: 'finished',
      actuallyPaid: invoice.payAmount,
      payAmount: invoice.payAmount,
      reason: null,
    });
    const endpoint = await db.saveWebhookEndpoint({
      organizationId: invoice.organizationId,
      url: 'https://merchant.example/hooks',
      secret: SECRET,
      events: ['payment.finished'],
    });
    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    const fetchImpl = async (
      url: string,
      init: { headers: Record<string, string>; body: string },
    ) => {
      calls.push({ url, headers: init.headers, body: init.body });
      return { status: 204 };
    };
    const first = await runOutboxWorker(db, {
      environment: 'dev',
      now: () => new Date('2026-11-03T14:06:00.000Z'),
      fetchImpl,
    });
    expect(first.delivered).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(endpoint.url);
    const header = calls[0]?.headers['AirExpay-Signature'] ?? '';
    const timestamp = calls[0]?.headers['AirExpay-Timestamp'] ?? '';
    expect(await verifyMerchantWebhook(SECRET, calls[0]?.body ?? '', timestamp, header)).toBe(true);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toMatchObject({ type: 'payment.finished' });

    const again = await runOutboxWorker(db, {
      environment: 'dev',
      now: () => new Date('2026-11-03T14:07:00.000Z'),
      fetchImpl,
    });
    expect(again.delivered).toBe(0);
    expect(calls).toHaveLength(1);

    const failing = new MemoryDatabase(TEST_WEBHOOK_KEYS);
    const second = failing.createInvoice({
      organizationId: invoice.organizationId,
      publicId: 'inv_fail',
      priceAmount: '10.00',
      priceCurrency: 'USD',
      payCurrency: 'BTC',
      payAmount: '0.00020000',
      payAddress: 'tb1qsimfail',
      providerInvoiceId: 'mockinv_2',
      providerPaymentId: 'mockpay_2',
      orderId: 'order_2',
      description: null,
      checkoutUrl: 'http://localhost:5173/pay/inv_fail',
      expiresAt: '2026-11-03T15:00:00.000Z',
      createdAt: '2026-11-03T14:00:00.000Z',
      network: 'bitcoin',
    });
    failing.acceptWebhook({
      dedupeKey: 'nowpayments:fail',
      signatureValid: true,
      headers: {},
      payload: {},
      receivedAt: '2026-11-03T14:05:00.000Z',
      providerPaymentId: second.providerPaymentId,
      toStatus: 'finished',
      actuallyPaid: second.payAmount,
      payAmount: second.payAmount,
      reason: null,
    });
    await failing.saveWebhookEndpoint({
      organizationId: second.organizationId,
      url: 'https://merchant.example/hooks',
      secret: SECRET,
      events: ['payment.finished'],
    });
    let attempts = 0;
    let cursor = Date.parse('2026-11-03T14:06:00.000Z');
    const failFetch = async () => {
      attempts += 1;
      return { status: 500 };
    };
    for (let step = 0; step < MERCHANT_WEBHOOK_MAX_ATTEMPTS; step += 1) {
      const report = await runOutboxWorker(failing, {
        environment: 'test',
        now: () => new Date(cursor),
        fetchImpl: failFetch,
        backoffMs: () => 1_000,
      });
      if (step < MERCHANT_WEBHOOK_MAX_ATTEMPTS - 1) {
        expect(report.retrying).toBe(1);
      } else {
        expect(report.deadLettered).toBe(1);
      }
      cursor += 1_000;
    }
    expect(attempts).toBe(MERCHANT_WEBHOOK_MAX_ATTEMPTS);
    const parked = await runOutboxWorker(failing, {
      environment: 'test',
      now: () => new Date(cursor + 10_000),
      fetchImpl: failFetch,
    });
    expect(parked.deadLettered).toBe(0);
    expect(parked.delivered).toBe(0);
    expect(attempts).toBe(MERCHANT_WEBHOOK_MAX_ATTEMPTS);

    await expect(
      runOutboxWorker(db, {
        environment: 'production',
        now: () => new Date(),
        fetchImpl,
      }),
    ).rejects.toThrow(/locally only/);
  });
});
