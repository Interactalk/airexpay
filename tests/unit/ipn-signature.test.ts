import {
  canonicalJson,
  signNowPaymentsBody,
  timingSafeEqual,
  verifyNowPaymentsSignature,
} from '@airexpay/payment-core';
import { describe, expect, it } from 'vitest';

const SECRET = 'simulation-ipn-secret';

const payment = {
  payment_id: 'pay_123',
  payment_status: 'finished',
  pay_address: 'tb1qsimulation',
  price_amount: '49.00',
  price_currency: 'usd',
  pay_amount: '0.00098',
  actually_paid: '0.00098',
  pay_currency: 'btc',
  order_id: 'ord_1',
  nested: { z: 1, a: { d: true, c: 'x' } },
};

describe('NOWPayments IPN signature', () => {
  it('accepts a valid HMAC-SHA512 signature over sorted JSON', async () => {
    const signed = await signNowPaymentsBody(payment, SECRET);
    const result = await verifyNowPaymentsSignature(signed.rawBody, signed.signature, SECRET);
    expect(result.valid).toBe(true);
    expect(signed.signature).toHaveLength(128);
    expect(result.canonical?.startsWith('{"actually_paid"')).toBe(true);
  });

  it('accepts a body whose keys were serialized in a different order', async () => {
    const signed = await signNowPaymentsBody(payment, SECRET);
    const shuffled = JSON.stringify({
      order_id: payment.order_id,
      payment_status: payment.payment_status,
      nested: { a: { c: 'x', d: true }, z: 1 },
      pay_currency: payment.pay_currency,
      actually_paid: payment.actually_paid,
      pay_amount: payment.pay_amount,
      price_currency: payment.price_currency,
      price_amount: payment.price_amount,
      pay_address: payment.pay_address,
      payment_id: payment.payment_id,
    });
    expect(shuffled).not.toBe(signed.rawBody);
    expect(canonicalJson(JSON.parse(shuffled))).toBe(signed.rawBody);
    const result = await verifyNowPaymentsSignature(shuffled, signed.signature, SECRET);
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const signed = await signNowPaymentsBody(payment, SECRET);
    const wrong = 'ab'.repeat(64);
    const result = await verifyNowPaymentsSignature(signed.rawBody, wrong, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('rejects a tampered body', async () => {
    const signed = await signNowPaymentsBody(payment, SECRET);
    const tampered = signed.rawBody.replace('finished', 'waiting');
    expect(tampered).not.toBe(signed.rawBody);
    const result = await verifyNowPaymentsSignature(tampered, signed.signature, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  it('rejects a signature made with a different secret', async () => {
    const signed = await signNowPaymentsBody(payment, 'other-secret-value');
    const result = await verifyNowPaymentsSignature(signed.rawBody, signed.signature, SECRET);
    expect(result.valid).toBe(false);
  });

  it('rejects a missing signature without throwing', async () => {
    const signed = await signNowPaymentsBody(payment, SECRET);
    const result = await verifyNowPaymentsSignature(signed.rawBody, null, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('missing_signature');
  });

  it('compares equal and unequal strings without early content match', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});
