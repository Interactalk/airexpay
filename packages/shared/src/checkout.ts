import type { InvoiceStatus } from './status.ts';

export const DEMO_CHECKOUT_STATES = [
  'waiting',
  'confirming',
  'paid',
  'underpaid',
  'expired',
  'failed',
] as const;

export type DemoCheckoutState = (typeof DEMO_CHECKOUT_STATES)[number];

export interface DemoInvoice {
  publicId: string;
  status: DemoCheckoutState;
  priceAmount: string;
  priceCurrency: string;
  payAmount: string;
  payCurrency: string;
  payAddress: string;
  merchant: string;
  description: string;
  actuallyPaid: string;
}

export const DEMO_INVOICES: Record<DemoCheckoutState, DemoInvoice> = {
  waiting: {
    publicId: 'demo_waiting',
    status: 'waiting',
    priceAmount: '128.00',
    priceCurrency: 'USD',
    payAmount: '0.00256',
    payCurrency: 'BTC',
    payAddress: 'tb1qsimulationairexpaywaiting0000000000000',
    merchant: 'Northwind Studio',
    description: 'Design retainer — simulated',
    actuallyPaid: '0',
  },
  confirming: {
    publicId: 'demo_confirming',
    status: 'confirming',
    priceAmount: '128.00',
    priceCurrency: 'USD',
    payAmount: '0.00256',
    payCurrency: 'BTC',
    payAddress: 'tb1qsimulationairexpayconfirming000000000',
    merchant: 'Northwind Studio',
    description: 'Design retainer — simulated',
    actuallyPaid: '0.00256',
  },
  paid: {
    publicId: 'demo_paid',
    status: 'paid',
    priceAmount: '128.00',
    priceCurrency: 'USD',
    payAmount: '0.00256',
    payCurrency: 'BTC',
    payAddress: 'tb1qsimulationairexpaypaid000000000000000',
    merchant: 'Northwind Studio',
    description: 'Design retainer — simulated',
    actuallyPaid: '0.00256',
  },
  underpaid: {
    publicId: 'demo_underpaid',
    status: 'underpaid',
    priceAmount: '128.00',
    priceCurrency: 'USD',
    payAmount: '0.00256',
    payCurrency: 'BTC',
    payAddress: 'tb1qsimulationairexpayunderpaid0000000000',
    merchant: 'Northwind Studio',
    description: 'Design retainer — simulated',
    actuallyPaid: '0.001',
  },
  expired: {
    publicId: 'demo_expired',
    status: 'expired',
    priceAmount: '128.00',
    priceCurrency: 'USD',
    payAmount: '0.00256',
    payCurrency: 'BTC',
    payAddress: 'tb1qsimulationairexpayexpired00000000000',
    merchant: 'Northwind Studio',
    description: 'Design retainer — simulated',
    actuallyPaid: '0',
  },
  failed: {
    publicId: 'demo_failed',
    status: 'failed',
    priceAmount: '128.00',
    priceCurrency: 'USD',
    payAmount: '0.00256',
    payCurrency: 'BTC',
    payAddress: 'tb1qsimulationairexpayfailed000000000000',
    merchant: 'Northwind Studio',
    description: 'Design retainer — simulated',
    actuallyPaid: '0',
  },
};

export function isDemoCheckoutState(value: string): value is DemoCheckoutState {
  return (DEMO_CHECKOUT_STATES as readonly string[]).includes(value);
}

export function buildPaymentUri(currency: string, address: string, amount: string): string {
  const scheme = currency.toLowerCase() === 'btc' ? 'bitcoin' : currency.toLowerCase();
  const params = new URLSearchParams({ amount });
  return `${scheme}:${address}?${params.toString()}`;
}

export const CHECKOUT_STATUS_COPY: Record<DemoCheckoutState, { title: string; body: string }> = {
  waiting: {
    title: 'Waiting for payment',
    body: 'No simulated payment has been seen yet. The invoice stays unpaid.',
  },
  confirming: {
    title: 'Confirming',
    body: 'A simulated payment is confirming. Confirming is not paid.',
  },
  paid: {
    title: 'Paid',
    body: 'The provider status is finished. Finished is the only status AirExpay treats as paid.',
  },
  underpaid: {
    title: 'Underpaid',
    body: 'The provider reported partially paid. This invoice is not fulfilled.',
  },
  expired: {
    title: 'Expired',
    body: 'The payment window ended. A late payment would be flagged for review.',
  },
  failed: {
    title: 'Failed',
    body: 'The simulated payment failed. Failed is a terminal status.',
  },
};

export function checkoutStatusCopy(status: InvoiceStatus | DemoCheckoutState): {
  title: string;
  body: string;
} {
  if (isDemoCheckoutState(status)) {
    return CHECKOUT_STATUS_COPY[status];
  }
  return {
    title: status,
    body: 'This status is shown for review. It is not a paid invoice unless the status is paid.',
  };
}
