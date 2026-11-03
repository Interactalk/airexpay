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

  it('preserves decimal spelling, large integers, and nested key order', async () => {
    const raw = [
      '{',
      '"z":{"b":1,"a":0.10000000},',
      '"payment_status":"finished",',
      '"payment_id":9007199254740993,',
      '"nested":{"m":[2,{"y":true,"x":"0.10000000"}]}',
      '}',
    ].join('');
    expect(String(JSON.parse('9007199254740993'))).toBe('9007199254740992');
    expect(JSON.stringify(JSON.parse('{"a":0.10000000}'))).toBe('{"a":0.1}');

    const signed = await signNowPaymentsBody(raw, SECRET);
    expect(signed.rawBody).toContain('0.10000000');
    expect(signed.rawBody).toContain('9007199254740993');
    expect(signed.rawBody).not.toContain('9007199254740992');
    expect(signed.rawBody).toContain('"x":"0.10000000"');
    expect(signed.rawBody.startsWith('{"nested"')).toBe(true);
    const hostParsed = canonicalJson(JSON.parse(raw));
    expect(hostParsed).toContain('"a":0.1');
    expect(hostParsed).not.toContain('"a":0.10000000');

    const reordered = raw
      .replace('"payment_status":"finished",', '')
      .replace(
        '"payment_id":9007199254740993,',
        '"payment_id":9007199254740993,"payment_status":"finished",',
      );
    expect(reordered).not.toBe(raw);
    const result = await verifyNowPaymentsSignature(reordered, signed.signature, SECRET);
    expect(result.valid).toBe(true);
    const parsed = result.parsed as { payment_id: string; z: { a: string } };
    expect(parsed.payment_id).toBe('9007199254740993');
    expect(parsed.z.a).toBe('0.10000000');

    const tampered = reordered.replace('0.10000000', '0.10000001');
    const rejected = await verifyNowPaymentsSignature(tampered, signed.signature, SECRET);
    expect(rejected.valid).toBe(false);
    expect(rejected.reason).toBe('signature_mismatch');
  });

  it('keeps exponent spelling instead of rewriting the token', async () => {
    const raw = '{"actually_paid":1.0e-7,"payment_id":"pay_1","payment_status":"finished"}';
    const signed = await signNowPaymentsBody(raw, SECRET);
    expect(signed.rawBody).toContain('1.0e-7');
    expect(signed.rawBody).not.toContain('1e-7');
    const result = await verifyNowPaymentsSignature(raw, signed.signature, SECRET);
    expect(result.valid).toBe(true);
  });
});
