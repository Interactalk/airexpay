import {
  DEFAULT_MARGIN_MULTIPLIER,
  DEFAULT_PROVIDER_FEE_RATE,
  MODE_A_FEATURE_FLAG,
  PRICING_PLANS,
} from '@airexpay/configuration';
import {
  ModeBUsageLedger,
  PlatformSplitCollection,
  quoteConfiguredFee,
  quoteFee,
  roundHalfAway,
  selectFeeCollection,
  selectPlan,
  type PricingPlan,
} from '@airexpay/payment-core';
import { describe, expect, it } from 'vitest';
import { MemoryDatabase } from '../../apps/api/src/db/memory.ts';

const AT_V1 = '2026-10-15T00:00:00.000Z';
const AT_V2 = '2026-11-03T08:00:00.000Z';

function invoiceInput(
  providerPaymentId: string,
  fee = quoteConfiguredFee({
    at: AT_V2,
    priceAmount: '100.00',
    currency: 'USD',
  }),
) {
  return {
    organizationId: '11111111-1111-4111-8111-111111111111',
    publicId: `inv_${providerPaymentId}`,
    priceAmount: '100.00',
    priceCurrency: 'USD',
    payCurrency: 'BTC',
    payAmount: '0.00100000',
    payAddress: 'tb1qsim',
    providerInvoiceId: `mockinv_${providerPaymentId}`,
    providerPaymentId,
    orderId: `order_${providerPaymentId}`,
    description: null,
    checkoutUrl: 'http://localhost:5173/pay/inv',
    expiresAt: '2026-11-03T15:00:00.000Z',
    createdAt: AT_V2,
    network: 'bitcoin',
    feeSnapshot: fee,
  };
}

describe('pricing engine', () => {
  it('stores the owner provider cost of 1.5% and a 1.5 margin multiplier as config', () => {
    expect(DEFAULT_PROVIDER_FEE_RATE).toBe('0.015');
    expect(DEFAULT_MARGIN_MULTIPLIER).toBe('1.5');
    const current = selectPlan(PRICING_PLANS, AT_V2);
    expect(current.providerFeeRate).toBe('0.015');
    expect(current.marginMultiplier).toBe('1.5');
    expect(current.markupNetworkFee).toBe(false);
    expect(MODE_A_FEATURE_FLAG).toBe(false);
  });

  it('charges 1.50 provider fee, 0.75 margin, and 2.25 total on a 100.00 USD invoice', () => {
    const quote = quoteConfiguredFee({
      at: AT_V2,
      priceAmount: '100.00',
      currency: 'USD',
    });
    expect(quote.providerFeeRate).toBe('0.015');
    expect(quote.marginMultiplier).toBe('1.5');
    expect(quote.providerFee).toBe('1.50');
    expect(quote.margin).toBe('0.75');
    expect(quote.totalFee).toBe('2.25');
    expect(quote.rounding).toBe('half_away_from_zero');
    expect(quote.currency).toBe('USD');
  });

  it('rounds half away from zero after multiplying', () => {
    expect(roundHalfAway(-15n, 1, 0)).toBe(-2n);
    const halfCent = quoteConfiguredFee({
      at: AT_V2,
      priceAmount: '1.00',
      currency: 'USD',
    });
    expect(halfCent.providerFee).toBe('0.02');
    expect(halfCent.totalFee).toBe('0.03');
    expect(halfCent.margin).toBe('0.01');
  });

  it('selects the plan version by effective date', () => {
    expect(selectPlan(PRICING_PLANS, AT_V1).version).toBe(1);
    expect(selectPlan(PRICING_PLANS, '2026-10-31T23:59:59.000Z').providerFeeRate).toBe('0.010');
    expect(selectPlan(PRICING_PLANS, '2026-11-01T00:00:00.000Z').providerFeeRate).toBe('0.015');
    const earlier = quoteConfiguredFee({
      at: AT_V1,
      priceAmount: '100.00',
      currency: 'USD',
    });
    expect(earlier.planVersion).toBe(1);
    expect(earlier.providerFee).toBe('1.00');
    expect(earlier.totalFee).toBe('1.50');
    expect(earlier.margin).toBe('0.50');
    expect(() => selectPlan(PRICING_PLANS, '2025-12-31T00:00:00.000Z')).toThrow(/No pricing plan/);
  });

  it('passes network fees through unless the plan marks them up', () => {
    const passed = quoteConfiguredFee({
      at: AT_V2,
      priceAmount: '100.00',
      currency: 'USD',
      networkFee: '1.25',
    });
    expect(passed.networkFee).toBe('1.25');
    expect(passed.networkFeeCharged).toBe('1.25');
    expect(passed.networkFeeMarkedUp).toBe(false);
    expect(passed.totalFee).toBe('2.25');

    const markupPlan: PricingPlan = {
      id: 'markup',
      version: 1,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      providerFeeRate: '0.015',
      marginMultiplier: '1.5',
      markupNetworkFee: true,
      minorScale: 2,
    };
    const marked = quoteFee({
      plans: [markupPlan],
      at: AT_V2,
      priceAmount: '100.00',
      currency: 'USD',
      networkFee: '1.25',
    });
    expect(marked.networkFee).toBe('1.25');
    expect(marked.networkFeeCharged).toBe('1.88');
    expect(marked.totalFee).toBe('2.25');
  });

  it('accrues a paid invoice once and skips underpaid', () => {
    const ledger = new ModeBUsageLedger();
    const snapshot = quoteConfiguredFee({
      at: AT_V2,
      priceAmount: '100.00',
      currency: 'USD',
    });
    expect(
      ledger.accrue({
        invoiceId: 'inv_under',
        organizationId: 'org',
        status: 'underpaid',
        paidAt: AT_V2,
        snapshot,
      }),
    ).toBeNull();
    const first = ledger.accrue({
      invoiceId: 'inv_paid',
      organizationId: 'org',
      status: 'paid',
      paidAt: AT_V2,
      snapshot,
    });
    const second = ledger.accrue({
      invoiceId: 'inv_paid',
      organizationId: 'org',
      status: 'paid',
      paidAt: '2026-11-04T00:00:00.000Z',
      snapshot,
    });
    expect(first?.providerFee).toBe('1.50');
    expect(first?.margin).toBe('0.75');
    expect(first?.totalFee).toBe('2.25');
    expect(second).toEqual(first);
    expect(ledger.statement('org', '2026-11').entries).toHaveLength(1);
    expect(ledger.statement('org', '2026-11').totals[0]?.totalFee).toBe('2.25');
    expect(() => new PlatformSplitCollection().capture()).toThrow(/unimplemented/);
    expect(selectFeeCollection(ledger).mode).toBe('merchant_usage');
  });
});

describe('usage ledger on the memory invoice store', () => {
  it('accrues only when a payment finishes, then keeps that line through refund and snapshot restore', () => {
    const db = new MemoryDatabase();
    const paid = db.createInvoice(invoiceInput('mockpay_paid'));
    const payAmount = paid.payAmount;
    db.acceptWebhook({
      dedupeKey: 'nowpayments:under',
      signatureValid: true,
      headers: {},
      payload: {},
      receivedAt: AT_V2,
      providerPaymentId: paid.providerPaymentId,
      toStatus: 'partially_paid',
      actuallyPaid: '0.00010000',
      payAmount,
      reason: null,
    });
    expect(db.usageEntries(paid.organizationId)).toHaveLength(0);
    expect(paid.payAmount).toBe(payAmount);

    db.acceptWebhook({
      dedupeKey: 'nowpayments:paid',
      signatureValid: true,
      headers: {},
      payload: {},
      receivedAt: AT_V2,
      providerPaymentId: paid.providerPaymentId,
      toStatus: 'finished',
      actuallyPaid: payAmount,
      payAmount,
      reason: null,
    });
    db.acceptWebhook({
      dedupeKey: 'nowpayments:paid-again',
      signatureValid: true,
      headers: {},
      payload: {},
      receivedAt: '2026-11-03T09:00:00.000Z',
      providerPaymentId: paid.providerPaymentId,
      toStatus: 'finished',
      actuallyPaid: payAmount,
      payAmount,
      reason: null,
    });
    expect(db.usageEntries(paid.organizationId)).toHaveLength(1);
    expect(db.usageEntries(paid.organizationId)[0]?.totalFee).toBe('2.25');
    expect(paid.status).toBe('paid');
    expect(paid.payAmount).toBe(payAmount);

    db.acceptWebhook({
      dedupeKey: 'nowpayments:refund',
      signatureValid: true,
      headers: {},
      payload: {},
      receivedAt: '2026-11-03T10:00:00.000Z',
      providerPaymentId: paid.providerPaymentId,
      toStatus: 'refunded',
      reason: null,
    });
    expect(paid.status).toBe('refunded');
    expect(db.usageStatement(paid.organizationId, '2026-11').entries).toHaveLength(1);

    const restored = MemoryDatabase.fromSnapshot(db.snapshot());
    expect(restored.usageEntries(paid.organizationId)).toHaveLength(1);
    expect(restored.getInvoice(paid.id, paid.organizationId)?.feeSnapshot?.totalFee).toBe('2.25');
    expect(restored.getInvoice(paid.id, paid.organizationId)?.feeSnapshot?.providerFee).toBe(
      '1.50',
    );
    expect(restored.getInvoice(paid.id, paid.organizationId)?.feeSnapshot?.margin).toBe('0.75');
  });
});
