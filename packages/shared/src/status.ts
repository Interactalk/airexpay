export const PAYMENT_STATUSES = [
  'waiting',
  'confirming',
  'confirmed',
  'sending',
  'partially_paid',
  'finished',
  'failed',
  'refunded',
  'expired',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const INVOICE_STATUSES = [
  'waiting',
  'confirming',
  'paid',
  'underpaid',
  'expired',
  'failed',
  'refunded',
  'canceled',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const TERMINAL_PAYMENT_STATUSES = [
  'failed',
  'refunded',
] as const satisfies readonly PaymentStatus[];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Only provider `finished` becomes invoice `paid`.
 * `partially_paid` becomes `underpaid` and is never fulfillment.
 */
export function invoiceStatusFromPayment(status: PaymentStatus): InvoiceStatus {
  switch (status) {
    case 'finished':
      return 'paid';
    case 'partially_paid':
      return 'underpaid';
    case 'expired':
      return 'expired';
    case 'failed':
      return 'failed';
    case 'refunded':
      return 'refunded';
    case 'waiting':
      return 'waiting';
    case 'confirming':
    case 'confirmed':
    case 'sending':
      return 'confirming';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
