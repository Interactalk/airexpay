import { SIMULATION_API_KEYS, SIMULATION_ORG_IDS } from '@airexpay/configuration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from 'wrangler';
import { TEST_WEBHOOK_SECRET_KEY } from '../helpers/webhook-key.ts';

const SECRET = 'merchant-webhook-secret';

describe('durable object invoice store', () => {
  const server: TestHarness = createTestHarness({
    workers: [
      {
        configPath: './apps/api/wrangler.toml',
        env: 'staging',
        secrets: { WEBHOOK_SECRET_ENCRYPTION_KEY: TEST_WEBHOOK_SECRET_KEY },
      },
    ],
  });

  beforeAll(async () => {
    await server.listen();
  }, 60_000);

  afterAll(async () => {
    await server.close();
  }, 60_000);

  it('keeps invoices and IPNs on the organization object across eviction', async () => {
    const worker = server.getWorker();
    const created = await worker.fetch('/api/dev/checkout/invoices', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'idem_do_checkout',
      },
      body: JSON.stringify({
        price_amount: '49.00',
        price_currency: 'usd',
        pay_currency: 'btc',
        order_id: 'do-order',
        description: 'Durable checkout',
      }),
    });
    expect(created.status).toBe(201);
    const checkout = (await created.json()) as { public_id: string; status: string };
    expect(checkout.status).toBe('waiting');

    const orgName = `org:${SIMULATION_ORG_IDS.alpha}`;
    const storage = await worker.getDurableObjectStorage('InvoiceStore', { name: orgName });
    const rows = await storage.exec<{ body: string }>('SELECT body FROM state WHERE id = 1');
    expect(rows[0]?.body).toContain(checkout.public_id);

    await worker.evictDurableObject('InvoiceStore', { name: orgName });
    await worker.evictDurableObject('InvoiceStore', { name: 'directory' });

    const polled = await worker.fetch(`/v1/checkout/${checkout.public_id}`);
    expect(polled.status).toBe(200);
    expect(((await polled.json()) as { status: string }).status).toBe('waiting');

    const simulated = await worker.fetch(`/api/dev/checkout/${checkout.public_id}/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payment_status: 'finished' }),
    });
    expect(simulated.status).toBe(200);
    expect(((await simulated.json()) as { simulated: boolean }).simulated).toBe(true);

    await worker.evictDurableObject('InvoiceStore', { name: orgName });
    const paid = await worker.fetch(`/v1/checkout/${checkout.public_id}`);
    expect(((await paid.json()) as { status: string }).status).toBe('paid');

    const hidden = await worker.fetch(`/v1/invoices/${checkout.public_id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.beta}` },
    });
    expect(hidden.status).toBe(404);
    const owner = await worker.fetch(`/v1/invoices/${checkout.public_id}`, {
      headers: { authorization: `Bearer ${SIMULATION_API_KEYS.alpha}` },
    });
    expect(owner.status).toBe(200);
  }, 60_000);

  it('reads checkout state from Durable Object storage, not isolate memory', async () => {
    const worker = server.getWorker();
    const created = await worker.fetch('/v1/invoices', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SIMULATION_API_KEYS.beta}`,
        'content-type': 'application/json',
        'idempotency-key': 'idem_do_beta',
      },
      body: JSON.stringify({
        price_amount: '12.00',
        price_currency: 'usd',
        pay_currency: 'btc',
        order_id: 'beta-do',
      }),
    });
    expect(created.status).toBe(201);
    const invoice = (await created.json()) as { public_id: string };
    const orgName = `org:${SIMULATION_ORG_IDS.beta}`;
    const storage = await worker.getDurableObjectStorage('InvoiceStore', { name: orgName });
    await storage.exec('DELETE FROM state');
    const missing = await worker.fetch(`/v1/checkout/${invoice.public_id}`);
    expect(missing.status).toBe(404);
  }, 60_000);

  it('stores the merchant webhook secret as ciphertext and limits by client key', async () => {
    const worker = server.getWorker<{
      INVOICE_STORE: {
        getByName(name: string): {
          saveWebhookEndpoint(input: {
            organizationId: string;
            url: string;
            secret: string;
            events: string[];
          }): Promise<{ id: string; secret: string }>;
          listEndpoints(organizationId: string): Promise<Array<{ secret: string }>>;
          take(
            nowMs: number,
            limit: number,
            windowMs: number,
          ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
        };
      };
    }>();
    const env = await worker.getEnv();
    const org = env.INVOICE_STORE.getByName(`org:${SIMULATION_ORG_IDS.alpha}`);
    const saved = await org.saveWebhookEndpoint({
      organizationId: SIMULATION_ORG_IDS.alpha,
      url: 'https://merchant.example/hooks',
      secret: SECRET,
      events: ['payment.finished'],
    });
    expect(saved.secret).toBe(SECRET);
    const storage = await worker.getDurableObjectStorage('InvoiceStore', {
      name: `org:${SIMULATION_ORG_IDS.alpha}`,
    });
    const rows = await storage.exec<{ body: string }>('SELECT body FROM state WHERE id = 1');
    expect(rows[0]?.body).toContain('v1.');
    expect(rows[0]?.body).not.toContain(SECRET);
    const listed = await org.listEndpoints(SIMULATION_ORG_IDS.alpha);
    expect(listed.some((endpoint) => endpoint.secret === SECRET)).toBe(true);

    const rate = env.INVOICE_STORE.getByName('rate:203.0.113.9');
    expect((await rate.take(1_000, 1, 60_000)).allowed).toBe(true);
    const blocked = await rate.take(1_100, 1, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  }, 60_000);
});
