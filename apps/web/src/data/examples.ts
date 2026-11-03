import type { InvoiceStatus } from '@airexpay/shared';
import { UNDERPAID_GUIDANCE } from '../lib/status.ts';

export const EXAMPLE_ADDRESS = 'TExampLeAddr3ssNotReaL000000';
export const TX_1045 = '9f2c4e1a7b3d5f6081c2e4a6b8d0f1327a5c9e0b4d6f8a1c3e5b7d9f0a2c4e6b';

export interface TimelineEntry {
  tone: 'ok' | 'info' | 'warn' | 'muted';
  label: string;
  at: string;
}

export interface ExampleInvoice {
  id: string;
  customer: string;
  email: string;
  amount: string;
  asset: string;
  network: string;
  status: InvoiceStatus;
  created: string;
  createdDetail: string;
  expires: string;
  reference: string;
  received: string | null;
  outstanding: string | null;
  txHash: string | null;
  timeline: TimelineEntry[];
  guidance: string | null;
}

const created = (
  id: string,
  customer: string,
  email: string,
  amount: string,
  asset: string,
  network: string,
  status: InvoiceStatus,
  createdAt: string,
): ExampleInvoice => ({
  id,
  customer,
  email,
  amount,
  asset,
  network,
  status,
  created: createdAt,
  createdDetail: `${createdAt} (UTC+6)`,
  expires: 'Nov 3, 2026, 12:10 (UTC+6)',
  reference: 'order_example',
  received: null,
  outstanding: null,
  txHash: null,
  timeline: [{ tone: 'ok', label: 'Invoice created', at: createdAt }],
  guidance: null,
});

export const EXAMPLE_INVOICES: ExampleInvoice[] = [
  created(
    'INV-1048',
    'Example customer A',
    'a@example.com',
    '1,250.00',
    'USDC',
    'Ethereum',
    'paid',
    'Nov 3, 14:02',
  ),
  created(
    'INV-1047',
    'Example customer B',
    'b@example.com',
    '89.90',
    'USDT',
    'Tron',
    'confirming',
    'Nov 3, 13:48',
  ),
  created(
    'INV-1046',
    'Example customer C',
    'c@example.com',
    '420.00',
    'USDT',
    'Tron',
    'waiting',
    'Nov 3, 13:15',
  ),
  {
    id: 'INV-1045',
    customer: 'Example customer D',
    email: 'd@example.com',
    amount: '300.00',
    asset: 'USDT',
    network: 'Tron',
    status: 'underpaid',
    created: 'Nov 3, 11:40',
    createdDetail: 'Nov 3, 2026, 11:40 (UTC+6)',
    expires: 'Nov 3, 2026, 12:10 (UTC+6)',
    reference: 'order_8812',
    received: '250.00 USDT',
    outstanding: '50.00 USDT',
    txHash: TX_1045,
    guidance: UNDERPAID_GUIDANCE,
    timeline: [
      { tone: 'ok', label: 'Invoice created', at: 'Nov 3, 11:40:02' },
      { tone: 'info', label: 'Payment detected · 250.00 USDT', at: 'Nov 3, 11:52:17' },
      { tone: 'info', label: 'Confirmed on-chain (19/19)', at: 'Nov 3, 11:53:05' },
      { tone: 'warn', label: 'Marked underpaid · 50.00 USDT outstanding', at: 'Nov 3, 11:53:06' },
      { tone: 'muted', label: 'Webhook invoice.underpaid → 200 OK', at: 'Nov 3, 11:53:07' },
    ],
  },
  created(
    'INV-1044',
    'Example customer E',
    'e@example.com',
    '0.0150',
    'BTC',
    'Bitcoin',
    'paid',
    'Nov 2, 19:22',
  ),
  created(
    'INV-1043',
    'Example customer F',
    'f@example.com',
    '75.00',
    'USDC',
    'Polygon',
    'expired',
    'Nov 2, 16:05',
  ),
  created(
    'INV-1042',
    'Example customer G',
    'g@example.com',
    '2,000.00',
    'USDT',
    'Ethereum',
    'failed',
    'Nov 2, 10:31',
  ),
  created(
    'INV-1041',
    'Example customer H',
    'h@example.com',
    '149.00',
    'USDC',
    'Base',
    'refunded',
    'Nov 1, 18:12',
  ),
  created(
    'INV-1040',
    'Example customer I',
    'i@example.com',
    '64.50',
    'USDT',
    'Tron',
    'paid',
    'Nov 1, 09:57',
  ),
];

export type InvoiceTab = 'all' | 'open' | 'paid' | 'attention' | 'expired';

export const INVOICE_TABS: { id: InvoiceTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'paid', label: 'Paid' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'expired', label: 'Expired' },
];

export function invoiceMatchesTab(status: InvoiceStatus, tab: InvoiceTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'open':
      return status === 'waiting' || status === 'confirming';
    case 'paid':
      return status === 'paid';
    case 'attention':
      return status === 'underpaid' || status === 'failed';
    case 'expired':
      return status === 'expired';
    default: {
      const unreachable: never = tab;
      return unreachable;
    }
  }
}

export function invoiceMatchesQuery(invoice: ExampleInvoice, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [invoice.id, invoice.customer, invoice.email, invoice.txHash ?? '', invoice.reference]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function findInvoice(id: string | undefined): ExampleInvoice | null {
  if (!id) return null;
  return EXAMPLE_INVOICES.find((invoice) => invoice.id === id) ?? null;
}

export interface ExampleLink {
  name: string;
  url: string;
  price: string;
  accepted: string;
  status: 'Active' | 'Archived';
  paidInvoices: string;
}

export const EXAMPLE_LINKS: ExampleLink[] = [
  {
    name: 'Design consultation',
    url: 'pay.airexpay.com/l/ex-001',
    price: '150.00 USD',
    accepted: 'USDC, USDT',
    status: 'Active',
    paidInvoices: '23',
  },
  {
    name: 'Monthly retainer — example',
    url: 'pay.airexpay.com/l/ex-002',
    price: '1,200.00 USD',
    accepted: 'USDC',
    status: 'Active',
    paidInvoices: '4',
  },
  {
    name: 'Workshop seat',
    url: 'pay.airexpay.com/l/ex-003',
    price: 'Customer chooses',
    accepted: 'USDC, USDT, BTC',
    status: 'Active',
    paidInvoices: '11',
  },
  {
    name: 'Spring promo (ended)',
    url: 'pay.airexpay.com/l/ex-004',
    price: '49.00 USD',
    accepted: 'USDT',
    status: 'Archived',
    paidInvoices: '62',
  },
];

export interface ExampleKey {
  name: string;
  mask: string;
  permissions: string;
  created: string;
  lastUsed: string;
}

export const EXAMPLE_TEST_KEYS: ExampleKey[] = [
  {
    name: 'Server key — staging',
    mask: 'sk_test_ex…4f2a',
    permissions: 'Full access',
    created: 'Nov 1, 2026',
    lastUsed: '2 min ago',
  },
  {
    name: 'Read-only reporting',
    mask: 'rk_test_ex…91bc',
    permissions: 'Read only',
    created: 'Oct 22, 2026',
    lastUsed: 'Yesterday',
  },
  {
    name: 'Old integration',
    mask: 'sk_test_ex…77d0',
    permissions: 'Full access',
    created: 'Sep 30, 2026',
    lastUsed: 'Never',
  },
];

export const EXAMPLE_LIVE_KEY = {
  name: 'Live server key',
  mask: 'sk_live_ex…a7c1',
  issued: 'Nov 2, 2026 by AirExpay',
  lastUsed: 'Never',
};

export interface ExampleDelivery {
  event: string;
  invoice: string;
  http: string;
  duration: string;
  sent: string;
  tone: 'paid' | 'failed' | 'underpaid';
  result: string;
}

export const EXAMPLE_DELIVERIES: ExampleDelivery[] = [
  {
    event: 'invoice.paid',
    invoice: 'INV-1048',
    http: '200',
    duration: '142 ms',
    sent: 'Nov 3, 14:02:11',
    tone: 'paid',
    result: 'Delivered',
  },
  {
    event: 'invoice.confirming',
    invoice: 'INV-1047',
    http: '200',
    duration: '98 ms',
    sent: 'Nov 3, 13:49:30',
    tone: 'paid',
    result: 'Delivered',
  },
  {
    event: 'invoice.underpaid',
    invoice: 'INV-1045',
    http: '200',
    duration: '120 ms',
    sent: 'Nov 3, 11:53:07',
    tone: 'paid',
    result: 'Delivered',
  },
  {
    event: 'invoice.failed',
    invoice: 'INV-1042',
    http: '500',
    duration: '2,004 ms',
    sent: 'Nov 2, 10:33:40',
    tone: 'failed',
    result: 'Failed · retry 3 of 8',
  },
  {
    event: 'invoice.expired',
    invoice: 'INV-1043',
    http: '—',
    duration: 'Timeout',
    sent: 'Nov 2, 16:35:12',
    tone: 'underpaid',
    result: 'Retrying in 4 min',
  },
  {
    event: 'invoice.paid',
    invoice: 'INV-1044',
    http: '200',
    duration: '131 ms',
    sent: 'Nov 2, 19:24:02',
    tone: 'paid',
    result: 'Delivered',
  },
];

export interface ExampleMember {
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Invited';
  initial: string;
}

export const EXAMPLE_MEMBERS: ExampleMember[] = [
  { name: 'Alex Kim', email: 'alex@example.com', role: 'Owner', status: 'Active', initial: 'A' },
  { name: 'Sam Rivera', email: 'sam@example.com', role: 'Admin', status: 'Active', initial: 'S' },
  {
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    role: 'Developer',
    status: 'Active',
    initial: 'J',
  },
  { name: 'priya@example.com', email: '—', role: 'Viewer', status: 'Invited', initial: 'P' },
];

export const CHECKLIST = [
  {
    title: 'Add a settlement wallet address',
    body: 'Payments go straight to wallets you control.',
    done: true,
  },
  { title: 'Create your first invoice', body: 'Try it in simulation mode.', done: true },
  { title: 'Create an API key', body: 'Use a test key while in simulation.', done: false },
  { title: 'Add a webhook endpoint', body: 'Receive signed payment events.', done: false },
  {
    title: 'Request go-live review',
    body: 'We review your account before live payments.',
    done: false,
  },
] as const;

export const VOLUME_BARS = [4, 6, 5, 8, 7, 9, 6, 10, 8, 11, 9, 12, 10, 13] as const;
