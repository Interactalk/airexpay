import { INVOICE_STATUSES, type InvoiceStatus } from '@airexpay/shared';

const INVOICE_STATUS_SET = new Set<string>(INVOICE_STATUSES);

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return INVOICE_STATUS_SET.has(value);
}

const NETWORK_LABELS: Record<string, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  tron: 'Tron',
  polygon: 'Polygon',
  base: 'Base',
};

export function networkLabel(network: string): string {
  return NETWORK_LABELS[network.toLowerCase()] ?? network;
}

export function dashboardStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'waiting':
      return 'Waiting for payment';
    case 'confirming':
      return 'Confirming';
    case 'paid':
      return 'Paid';
    case 'underpaid':
      return 'Underpaid';
    case 'expired':
      return 'Expired';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
    case 'canceled':
      return 'Canceled';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

/** Customer-facing checkout label. Underpaid is "Partially paid" and is never paid. */
export function checkoutStatusLabel(status: InvoiceStatus, network?: string | null): string {
  if (status === 'underpaid') return 'Partially paid';
  if (status === 'confirming') {
    const name = network ? networkLabel(network) : null;
    return name ? `Confirming on ${name}` : 'Confirming';
  }
  return dashboardStatusLabel(status);
}

export const UNDERPAID_GUIDANCE =
  'The customer can contact you to arrange the remaining amount. This invoice stays Underpaid.';

export const PAID_VOLUME_LABEL = 'Paid invoice volume (USD equivalent, not a balance)';

export const PRICING_HEADING = 'Pricing coming soon';
