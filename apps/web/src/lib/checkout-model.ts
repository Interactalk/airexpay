import type { InvoiceStatus } from '@airexpay/shared';
import type { PublicCheckout } from '../api/public-checkout.ts';
import { formatCountdown, type CountdownParts } from './countdown.ts';
import { subtractAmounts } from './money.ts';
import { checkoutStatusLabel, networkLabel } from './status.ts';

export interface CheckoutLine {
  label: string;
  amount: string;
}

export interface CheckoutFailure {
  expected: string;
  detected: string;
  reference: string;
}

export interface CheckoutView {
  source: 'example' | 'server';
  status: InvoiceStatus;
  badgeLabel: string;
  title: string;
  body: string;
  merchantName: string;
  invoiceRef: string;
  priceAmount: string;
  priceCurrency: string;
  payAmount: string;
  payCurrency: string;
  networkLabel: string;
  payAddress: string;
  actuallyPaid: string | null;
  remaining: string | null;
  countdown: CountdownParts | null;
  confirmations: { current: number; total: number } | null;
  transactionHash: string | null;
  paidAt: string | null;
  lineItems: CheckoutLine[] | null;
  failure: CheckoutFailure | null;
  livemode: boolean;
  description: string | null;
  sendCallout: string | null;
  overpaid: boolean;
  latePaymentReview: boolean;
}

const EXAMPLE_ADDRESS = 'TExampLeAddr3ssNotReaL000000';
const TX_TRON = '3c7e0a9b1d5f2e4c6a8b0d1f3e5c7a9b2d4f6e8a0c1b3d5f7e9a2c4b6d8f0e1a';
const TX_ETH = '0x5b1e8d2c4a6f9e0b3d7c1a5e8f2b4d6c9a0e3f7b1d5c8a2e6f4b9d0c3a7e1f5b';

export const EXAMPLE_TX = { tron: TX_TRON, eth: TX_ETH, address: EXAMPLE_ADDRESS };

const EXAMPLE_LINES: CheckoutLine[] = [
  { label: 'Brand identity package — example', amount: '380.00' },
  { label: 'Rush delivery — example', amount: '40.00' },
];

function baseExample(status: InvoiceStatus): CheckoutView {
  return {
    source: 'example',
    status,
    badgeLabel: checkoutStatusLabel(status, status === 'confirming' ? 'Tron' : null),
    title: '',
    body: '',
    merchantName: 'Northwind Studio',
    invoiceRef: 'INV-1046',
    priceAmount: '420.00',
    priceCurrency: 'USD',
    payAmount: '420.00',
    payCurrency: 'USDT',
    networkLabel: 'Tron (TRC-20)',
    payAddress: EXAMPLE_ADDRESS,
    actuallyPaid: null,
    remaining: null,
    countdown: null,
    confirmations: null,
    transactionHash: null,
    paidAt: null,
    lineItems: EXAMPLE_LINES,
    failure: null,
    livemode: false,
    description: 'Brand identity package — example',
    sendCallout: null,
    overpaid: false,
    latePaymentReview: false,
  };
}

export function exampleCheckout(status: InvoiceStatus): CheckoutView {
  const view = baseExample(status);
  switch (status) {
    case 'waiting':
      return {
        ...view,
        badgeLabel: 'Waiting for payment',
        title: 'Waiting for payment',
        countdown: {
          clock: '14:32',
          minutes: 14,
          label: 'Time left 14 minutes 32 seconds',
        },
        sendCallout:
          'Send exactly 420.00 USDT on Tron. Network fees are paid by your wallet and are not included in this amount.',
      };
    case 'confirming':
      return {
        ...view,
        badgeLabel: 'Confirming on Tron',
        title: 'Payment detected',
        body: 'We found your transaction and are waiting for network confirmations. You can keep this page open or close it — the merchant will be notified.',
        actuallyPaid: '420.00',
        confirmations: { current: 7, total: 12 },
        transactionHash: TX_TRON,
      };
    case 'paid':
      return {
        ...view,
        badgeLabel: 'Paid',
        title: 'Payment complete',
        body: 'Thank you. Northwind Studio has been notified and will follow up by email.',
        actuallyPaid: '420.00',
        paidAt: 'Nov 3, 2026, 13:21 (UTC+6)',
        transactionHash: TX_TRON,
      };
    case 'underpaid':
      return {
        ...view,
        badgeLabel: 'Partially paid',
        title: 'We received less than the invoice amount',
        body: 'Send the remaining amount to the same address to complete this payment.',
        actuallyPaid: '380.00',
        remaining: '40.00',
        countdown: {
          clock: '09:48',
          minutes: 9,
          label: 'Time left 9 minutes 48 seconds',
        },
      };
    case 'expired':
      return {
        ...view,
        badgeLabel: 'Expired',
        title: 'This payment window has closed',
        body: 'The quote for this invoice expired at 13:45 (UTC+6). Do not send funds to the previous address.',
      };
    case 'failed':
      return {
        ...view,
        badgeLabel: 'Failed',
        title: 'We couldn’t complete this payment',
        body: 'The transaction was sent on a network this invoice does not accept, so it can’t be matched automatically.',
        transactionHash: TX_ETH,
        failure: {
          expected: '420.00 USDT on Tron',
          detected: 'USDT on Ethereum',
          reference: 'ERR-NETWORK-MISMATCH',
        },
      };
    case 'refunded':
      return {
        ...view,
        badgeLabel: 'Refunded',
        title: 'This payment was refunded',
        body: 'A refunded invoice is not a new paid invoice. Contact the merchant if you still need to pay.',
      };
    case 'canceled':
      return {
        ...view,
        badgeLabel: 'Canceled',
        title: 'This invoice was canceled',
        body: 'Do not send funds for this invoice.',
      };
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

function serverTitle(status: InvoiceStatus): string {
  switch (status) {
    case 'waiting':
      return 'Waiting for payment';
    case 'confirming':
      return 'Payment detected';
    case 'paid':
      return 'Payment complete';
    case 'underpaid':
      return 'We received less than the invoice amount';
    case 'expired':
      return 'This payment window has closed';
    case 'failed':
      return 'We couldn’t complete this payment';
    case 'refunded':
      return 'This payment was refunded';
    case 'canceled':
      return 'This invoice was canceled';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

function serverBody(record: PublicCheckout, network: string): string {
  switch (record.status) {
    case 'waiting':
      return 'No payment has been reported by the server yet. This invoice stays unpaid.';
    case 'confirming':
      return 'A payment was reported and is waiting for network confirmations. Confirming is not paid.';
    case 'paid':
      return `${record.merchant_name} has been notified. Paid is shown only because the server status is paid.`;
    case 'underpaid':
      return 'The server reported a partial payment. Send the remaining amount to complete it. This invoice is not paid.';
    case 'expired':
      return 'The payment window has closed. Do not send funds to the previous address.';
    case 'failed':
      return record.description ?? 'The payment failed. Failed is a terminal status.';
    case 'refunded':
      return 'The server marked this payment refunded. It is not a paid invoice.';
    case 'canceled':
      return 'This invoice was canceled. Do not send funds.';
    default:
      return `Status from the server for ${network}.`;
  }
}

export function checkoutFromServer(record: PublicCheckout, now = Date.now()): CheckoutView {
  const network = record.network ? networkLabel(record.network) : record.pay_currency.toUpperCase();
  const remaining =
    record.status === 'underpaid' && record.actually_paid
      ? subtractAmounts(record.pay_amount, record.actually_paid)
      : null;
  return {
    source: 'server',
    status: record.status,
    badgeLabel: checkoutStatusLabel(record.status, record.network ?? network),
    title: serverTitle(record.status),
    body: serverBody(record, network),
    merchantName: record.merchant_name,
    invoiceRef: record.public_id,
    priceAmount: record.price_amount,
    priceCurrency: record.price_currency.toUpperCase(),
    payAmount: record.pay_amount,
    payCurrency: record.pay_currency.toUpperCase(),
    networkLabel: network,
    payAddress: record.pay_address,
    actuallyPaid: record.actually_paid,
    remaining,
    countdown:
      record.status === 'waiting' || record.status === 'underpaid'
        ? formatCountdown(record.expires_at, now)
        : null,
    confirmations: null,
    transactionHash: null,
    paidAt: null,
    lineItems: record.description
      ? [{ label: record.description, amount: record.price_amount }]
      : null,
    failure: null,
    livemode: record.livemode,
    description: record.description,
    overpaid: record.overpaid,
    latePaymentReview: record.late_payment_review,
    sendCallout:
      record.status === 'waiting'
        ? `Send exactly ${record.pay_amount} ${record.pay_currency.toUpperCase()} on ${network}. Network fees are paid by your wallet and are not included in this amount.`
        : null,
  };
}
