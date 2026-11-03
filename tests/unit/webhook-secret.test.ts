import { decryptWebhookSecret, encryptWebhookSecret } from '@airexpay/payment-core';
import { describe, expect, it } from 'vitest';
import { MemoryDatabase } from '../../apps/api/src/db/memory.ts';
import {
  TEST_WEBHOOK_KEYS,
  TEST_WEBHOOK_SECRET_KEY,
  TEST_WEBHOOK_SECRET_KEY_NEXT,
} from '../helpers/webhook-key.ts';

const SECRET = 'merchant-webhook-secret';

describe('webhook secret encryption', () => {
  it('round-trips AES-GCM and rejects a tampered ciphertext or the wrong key', async () => {
    const first = await encryptWebhookSecret(SECRET, TEST_WEBHOOK_SECRET_KEY);
    const second = await encryptWebhookSecret(SECRET, TEST_WEBHOOK_SECRET_KEY);
    expect(first.startsWith('v1.')).toBe(true);
    expect(first).not.toBe(second);
    expect(first).not.toContain(SECRET);
    expect(await decryptWebhookSecret(first, TEST_WEBHOOK_SECRET_KEY)).toBe(SECRET);
    await expect(decryptWebhookSecret(first, TEST_WEBHOOK_SECRET_KEY_NEXT)).rejects.toThrow(
      /could not be decrypted/,
    );
    await expect(decryptWebhookSecret('v0.aaaa', TEST_WEBHOOK_SECRET_KEY)).rejects.toThrow(
      /version/,
    );
    await expect(encryptWebhookSecret(SECRET, 'aaaa')).rejects.toThrow(/32 bytes/);
    const flipped = `${first.slice(0, -2)}${first.endsWith('A') ? 'B' : 'A'}`;
    await expect(decryptWebhookSecret(flipped, TEST_WEBHOOK_SECRET_KEY)).rejects.toThrow(
      /could not be decrypted|Expected base64|truncated/,
    );
  });

  it('decrypts with the previous key and re-saves under the current key', async () => {
    const stored = await encryptWebhookSecret(SECRET, TEST_WEBHOOK_SECRET_KEY);
    expect(
      await decryptWebhookSecret(stored, TEST_WEBHOOK_SECRET_KEY_NEXT, TEST_WEBHOOK_SECRET_KEY),
    ).toBe(SECRET);

    const db = new MemoryDatabase({ current: TEST_WEBHOOK_SECRET_KEY });
    const endpoint = await db.saveWebhookEndpoint({
      organizationId: '11111111-1111-4111-8111-111111111111',
      url: 'https://merchant.example/hooks',
      secret: SECRET,
      events: ['payment.finished'],
    });
    const before = db.snapshot();
    expect(JSON.stringify(before)).not.toContain(SECRET);
    expect(before.endpoints[0]?.secretCiphertext.startsWith('v1.')).toBe(true);

    const rotated = MemoryDatabase.fromSnapshot(before, {
      current: TEST_WEBHOOK_SECRET_KEY_NEXT,
      previous: TEST_WEBHOOK_SECRET_KEY,
    });
    const listed = await rotated.listEndpoints(endpoint.organizationId);
    expect(listed[0]?.secret).toBe(SECRET);
    await rotated.saveWebhookEndpoint({
      id: endpoint.id,
      organizationId: endpoint.organizationId,
      url: endpoint.url,
      secret: listed[0]?.secret ?? '',
      events: [...endpoint.events],
    });
    const after = rotated.snapshot();
    expect(
      await decryptWebhookSecret(
        after.endpoints[0]?.secretCiphertext ?? '',
        TEST_WEBHOOK_SECRET_KEY_NEXT,
      ),
    ).toBe(SECRET);
    await expect(
      decryptWebhookSecret(after.endpoints[0]?.secretCiphertext ?? '', TEST_WEBHOOK_SECRET_KEY),
    ).rejects.toThrow(/could not be decrypted/);
  });

  it('refuses to store a webhook secret without a key', async () => {
    const db = new MemoryDatabase();
    await expect(
      db.saveWebhookEndpoint({
        organizationId: '11111111-1111-4111-8111-111111111111',
        url: 'https://merchant.example/hooks',
        secret: SECRET,
        events: [],
      }),
    ).rejects.toThrow(/WEBHOOK_SECRET_ENCRYPTION_KEY/);
  });
});

describe('memory snapshot', () => {
  it('restores an invoice after the object is rebuilt from JSON', () => {
    const db = new MemoryDatabase(TEST_WEBHOOK_KEYS);
    const created = db.createInvoice({
      organizationId: '11111111-1111-4111-8111-111111111111',
      publicId: 'inv_snap',
      priceAmount: '10.00',
      priceCurrency: 'USD',
      payCurrency: 'BTC',
      payAmount: '0.00020000',
      payAddress: 'tb1qsim',
      providerInvoiceId: 'mockinv_snap',
      providerPaymentId: 'mockpay_snap',
      orderId: 'order_snap',
      description: null,
      checkoutUrl: 'http://localhost:5173/pay/inv_snap',
      expiresAt: '2026-11-03T15:00:00.000Z',
      createdAt: '2026-11-03T14:00:00.000Z',
      network: 'bitcoin',
    });
    db.acceptWebhook({
      dedupeKey: 'nowpayments:snap',
      signatureValid: true,
      headers: {},
      payload: { payment_status: 'finished' },
      receivedAt: '2026-11-03T14:05:00.000Z',
      providerPaymentId: created.providerPaymentId,
      toStatus: 'finished',
      actuallyPaid: created.payAmount,
      payAmount: created.payAmount,
      reason: null,
    });
    const restored = MemoryDatabase.fromSnapshot(
      JSON.parse(JSON.stringify(db.snapshot())) as ReturnType<MemoryDatabase['snapshot']>,
      TEST_WEBHOOK_KEYS,
    );
    expect(restored.getByPublicId('inv_snap')?.status).toBe('paid');
    expect(restored.getByPublicId('inv_snap')?.paymentStatus).toBe('finished');
  });
});
