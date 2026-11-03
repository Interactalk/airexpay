import type {
  AuditRecord,
  FeeSnapshot,
  PaymentSnapshot,
  TransitionResult,
} from '@airexpay/payment-core';
import type { InvoiceStatus, PaymentStatus } from '@airexpay/shared';

export interface InvoiceRecord {
  id: string;
  organizationId: string;
  publicId: string;
  number: string;
  priceAmount: string;
  priceCurrency: string;
  payCurrency: string;
  payAmount: string;
  payAddress: string;
  status: InvoiceStatus;
  provider: 'mock';
  providerInvoiceId: string;
  providerPaymentId: string;
  paymentId: string;
  orderId: string;
  description: string | null;
  checkoutUrl: string;
  expiresAt: string;
  createdAt: string;
  overpaid: boolean;
  latePaymentReview: boolean;
  actuallyPaid: string | null;
  paymentStatus: PaymentStatus;
  rawStatus: string;
  network: string | null;
  merchantName: string;
  /** Present for invoices created after the pricing snapshot. Not a SQL column. */
  feeSnapshot?: FeeSnapshot;
}

export interface WebhookRecord {
  id: string;
  provider: 'nowpayments';
  signatureValid: boolean;
  headers: Record<string, string>;
  payload: unknown;
  dedupeKey: string;
  receivedAt: string;
  processedAt: string | null;
  reason: string | null;
}

export interface IdempotencyRecord {
  organizationId: string;
  key: string;
  requestHash: string;
  statusCode: number;
  response: unknown;
  expiresAt: string;
}

export interface CreateInvoiceInput {
  organizationId: string;
  publicId: string;
  priceAmount: string;
  priceCurrency: string;
  payCurrency: string;
  payAmount: string;
  payAddress: string;
  providerInvoiceId: string;
  providerPaymentId: string;
  orderId: string;
  description: string | null;
  checkoutUrl: string;
  expiresAt: string;
  createdAt: string;
  network: string | null;
  feeSnapshot?: FeeSnapshot;
}

export interface AcceptWebhookInput {
  dedupeKey: string;
  signatureValid: boolean;
  headers: Record<string, string>;
  payload: unknown;
  receivedAt: string;
  providerPaymentId?: string;
  toStatus?: PaymentStatus;
  actuallyPaid?: string | null;
  payAmount?: string | null;
  reason: string | null;
}

export interface AcceptWebhookResult {
  duplicate: boolean;
  webhook: WebhookRecord;
  transition: TransitionResult | null;
  matched: boolean;
}

export interface WebhookEndpointRecord {
  id: string;
  organizationId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

export interface OutboxRecord {
  id: string;
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  publishedAt: string | null;
  deadLetteredAt: string | null;
  nextRetryAt: string | null;
}

export interface DeliveryInput {
  endpointId: string;
  outboxEventId: string;
  attempt: number;
  statusCode: number | null;
  nextRetryAt: string | null;
}

export type MaybePromise<T> = T | Promise<T>;

/**
 * Invoice storage. Memory is the default. Postgres uses parameterized SQL
 * against the Phase 1 schema and is constructed with an injected client.
 */
export interface InvoiceRepository {
  listWebhooks(): MaybePromise<readonly WebhookRecord[]>;
  listAudits(): MaybePromise<readonly AuditRecord[]>;
  outboxFor(paymentId: string): MaybePromise<PaymentSnapshot['outbox']>;
  eventsFor(paymentId: string): MaybePromise<PaymentSnapshot['events']>;
  getInvoice(idOrPublicId: string, organizationId: string): MaybePromise<InvoiceRecord | null>;
  getByPublicId(publicId: string): MaybePromise<InvoiceRecord | null>;
  createInvoice(input: CreateInvoiceInput): MaybePromise<InvoiceRecord>;
  getIdempotency(
    organizationId: string,
    key: string,
    nowIso: string,
  ): MaybePromise<IdempotencyRecord | null>;
  saveIdempotency(record: IdempotencyRecord): MaybePromise<void>;
  acceptWebhook(input: AcceptWebhookInput): MaybePromise<AcceptWebhookResult>;
  saveWebhookEndpoint(input: {
    id?: string;
    organizationId: string;
    url: string;
    secret: string;
    events: string[];
    active?: boolean;
  }): MaybePromise<WebhookEndpointRecord>;
  listEndpoints(organizationId: string): MaybePromise<readonly WebhookEndpointRecord[]>;
  listDueOutbox(
    nowIso: string,
    limit: number,
    maxAttempts: number,
  ): MaybePromise<readonly OutboxRecord[]>;
  insertDelivery(input: DeliveryInput): MaybePromise<void>;
  markOutboxPublished(id: string, at: string, attempts: number): MaybePromise<void>;
  markOutboxRetry(id: string, attempts: number, nextRetryAt: string): MaybePromise<void>;
  markOutboxDeadLetter(id: string, at: string, attempts: number): MaybePromise<void>;
  getOutbox(id: string): MaybePromise<OutboxRecord | null>;
}

export interface SqlQueryResult<T extends Record<string, unknown> = Record<string, unknown>> {
  rows: T[];
}

export interface SqlClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<T>>;
}

export interface SqlPool extends SqlClient {
  transaction<T>(run: (tx: SqlClient) => Promise<T>): Promise<T>;
}
