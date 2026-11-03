import { isDecimalString, type InvoiceStatus } from '@airexpay/shared';
import { apiUrl } from '../apiBase.ts';
import { isInvoiceStatus } from '../lib/status.ts';

export interface PublicCheckout {
  object: 'checkout';
  livemode: false;
  public_id: string;
  status: InvoiceStatus;
  merchant_name: string;
  price_amount: string;
  price_currency: string;
  pay_amount: string;
  pay_currency: string;
  pay_address: string;
  actually_paid: string | null;
  network: string | null;
  description: string | null;
  expires_at: string;
  overpaid: boolean;
  late_payment_review: boolean;
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly kind: 'not_found' | 'invalid' | 'network' | 'live_disabled',
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CheckoutError('This checkout could not be shown.', 'invalid');
  }
  return value;
}

function optionalString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new CheckoutError('This checkout could not be shown.', 'invalid');
  }
  return value;
}

function decimalField(row: Record<string, unknown>, key: string): string {
  const value = stringField(row, key);
  if (!isDecimalString(value)) {
    throw new CheckoutError('This checkout could not be shown.', 'invalid');
  }
  return value;
}

/** Trust only a parsed server payload. Unknown or live-mode payloads are rejected. */
export function parsePublicCheckout(value: unknown): PublicCheckout {
  if (!value || typeof value !== 'object') {
    throw new CheckoutError('This checkout could not be shown.', 'invalid');
  }
  const row = value as Record<string, unknown>;
  if (row.livemode !== false) {
    throw new CheckoutError('Live checkout is not available in this build.', 'live_disabled');
  }
  const status = row.status;
  if (typeof status !== 'string' || !isInvoiceStatus(status)) {
    throw new CheckoutError('This checkout could not be shown.', 'invalid');
  }
  const actuallyPaid = optionalString(row, 'actually_paid');
  if (actuallyPaid !== null && !isDecimalString(actuallyPaid)) {
    throw new CheckoutError('This checkout could not be shown.', 'invalid');
  }
  return {
    object: 'checkout',
    livemode: false,
    public_id: stringField(row, 'public_id'),
    status,
    merchant_name: stringField(row, 'merchant_name'),
    price_amount: decimalField(row, 'price_amount'),
    price_currency: stringField(row, 'price_currency'),
    pay_amount: decimalField(row, 'pay_amount'),
    pay_currency: stringField(row, 'pay_currency'),
    pay_address: stringField(row, 'pay_address'),
    actually_paid: actuallyPaid,
    network: optionalString(row, 'network'),
    description: optionalString(row, 'description'),
    expires_at: stringField(row, 'expires_at'),
    overpaid: row.overpaid === true,
    late_payment_review: row.late_payment_review === true,
  };
}

export async function fetchPublicCheckout(publicId: string): Promise<PublicCheckout> {
  let response: Response;
  try {
    response = await fetch(apiUrl(`/v1/checkout/${encodeURIComponent(publicId)}`));
  } catch {
    throw new CheckoutError('The checkout service is not reachable.', 'network');
  }
  if (response.status === 404) {
    throw new CheckoutError('This checkout was not found.', 'not_found');
  }
  if (!response.ok) {
    throw new CheckoutError('This checkout could not be shown.', 'invalid');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CheckoutError('This checkout could not be shown.', 'invalid');
  }
  return parsePublicCheckout(body);
}

export async function createSimulationInvoice(input: {
  priceAmount: string;
  orderId: string;
}): Promise<PublicCheckout> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/dev/checkout/invoices'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `idem_${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        price_amount: input.priceAmount,
        price_currency: 'usd',
        pay_currency: 'btc',
        order_id: input.orderId,
        description: 'Simulated checkout',
      }),
    });
  } catch {
    throw new CheckoutError('The simulation API is not reachable.', 'network');
  }
  if (!response.ok) {
    throw new CheckoutError(
      'The invoice was not created. Check the amount and try again.',
      'invalid',
    );
  }
  return parsePublicCheckout(await response.json());
}

export async function simulateCheckoutPayment(
  publicId: string,
  paymentStatus: string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/dev/checkout/${encodeURIComponent(publicId)}/simulate`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payment_status: paymentStatus }),
    });
  } catch {
    throw new CheckoutError('The simulation API is not reachable.', 'network');
  }
  if (!response.ok) {
    throw new CheckoutError('The simulation was not accepted.', 'invalid');
  }
}
