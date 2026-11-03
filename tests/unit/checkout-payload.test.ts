import { buildPaymentUri, DEMO_CHECKOUT_STATES, DEMO_INVOICES } from '@airexpay/shared';
import { describe, expect, it } from 'vitest';

describe('hosted checkout payloads', () => {
  it('encodes the simulated address and amount for every preview state', () => {
    for (const state of DEMO_CHECKOUT_STATES) {
      const invoice = DEMO_INVOICES[state];
      expect(invoice.status).toBe(state);
      expect(buildPaymentUri(invoice.payCurrency, invoice.payAddress, invoice.payAmount)).toBe(
        `bitcoin:${invoice.payAddress}?amount=${invoice.payAmount}`,
      );
    }
  });
});
