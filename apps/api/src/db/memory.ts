import type { AuditRecord, PaymentSnapshot, TransitionResult } from '@airexpay/payment-core';
import { applyPaymentTransition, emptyPaymentSnapshot } from '@airexpay/payment-core';
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
}

export class MemoryDatabase {
  private readonly invoices = new Map<string, InvoiceRecord>();
  private readonly byPublicId = new Map<string, string>();
  private readonly byProviderPayment = new Map<string, string>();
  private readonly snapshots = new Map<string, PaymentSnapshot>();
  private readonly webhooks = new Map<string, WebhookRecord>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly audits: AuditRecord[] = [];
  private invoiceSequence = 1000;

  listWebhooks(): readonly WebhookRecord[] {
    return [...this.webhooks.values()];
  }

  listAudits(): readonly AuditRecord[] {
    return [...this.audits];
  }

  outboxFor(paymentId: string): PaymentSnapshot['outbox'] {
    return this.snapshots.get(paymentId)?.outbox ?? [];
  }

  eventsFor(paymentId: string): PaymentSnapshot['events'] {
    return this.snapshots.get(paymentId)?.events ?? [];
  }

  getInvoice(idOrPublicId: string, organizationId: string): InvoiceRecord | null {
    const byId = this.invoices.get(idOrPublicId);
    if (byId && byId.organizationId === organizationId) return byId;
    const internal = this.byPublicId.get(idOrPublicId);
    if (!internal) return null;
    const invoice = this.invoices.get(internal);
    if (!invoice || invoice.organizationId !== organizationId) return null;
    return invoice;
  }

  createInvoice(input: CreateInvoiceInput): InvoiceRecord {
    this.invoiceSequence += 1;
    const paymentId = crypto.randomUUID();
    const opened = applyPaymentTransition(
      emptyPaymentSnapshot(),
      {
        to: 'waiting',
        source: 'mock',
        organizationId: input.organizationId,
        paymentId,
        payAmount: input.payAmount,
        actuallyPaid: '0',
      },
      { now: () => input.createdAt, id: () => crypto.randomUUID() },
    );
    if (!opened.applied || !opened.snapshot.status) {
      throw new Error('Failed to open payment in waiting');
    }
    const record: InvoiceRecord = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      publicId: input.publicId,
      number: `INV-${this.invoiceSequence}`,
      priceAmount: input.priceAmount,
      priceCurrency: input.priceCurrency,
      payCurrency: input.payCurrency,
      payAmount: input.payAmount,
      payAddress: input.payAddress,
      status: 'waiting',
      provider: 'mock',
      providerInvoiceId: input.providerInvoiceId,
      providerPaymentId: input.providerPaymentId,
      paymentId,
      orderId: input.orderId,
      description: input.description,
      checkoutUrl: input.checkoutUrl,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      overpaid: false,
      latePaymentReview: false,
      actuallyPaid: '0',
      paymentStatus: 'waiting',
      rawStatus: 'waiting',
      network: input.network,
    };
    this.invoices.set(record.id, record);
    this.byPublicId.set(record.publicId, record.id);
    this.byProviderPayment.set(record.providerPaymentId, record.id);
    this.snapshots.set(paymentId, opened.snapshot);
    return record;
  }

  getIdempotency(organizationId: string, key: string, nowIso: string): IdempotencyRecord | null {
    const row = this.idempotency.get(`${organizationId}:${key}`);
    if (!row) return null;
    if (row.expiresAt <= nowIso) {
      this.idempotency.delete(`${organizationId}:${key}`);
      return null;
    }
    return row;
  }

  saveIdempotency(record: IdempotencyRecord): void {
    this.idempotency.set(`${record.organizationId}:${record.key}`, record);
  }

  /**
   * Persist the raw webhook once. Exact duplicate dedupe keys do not insert again
   * and do not re-apply a transition.
   */
  acceptWebhook(input: {
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
  }): {
    duplicate: boolean;
    webhook: WebhookRecord;
    transition: TransitionResult | null;
    matched: boolean;
  } {
    const existing = this.webhooks.get(input.dedupeKey);
    if (existing) {
      return { duplicate: true, webhook: existing, transition: null, matched: false };
    }
    const webhook: WebhookRecord = {
      id: crypto.randomUUID(),
      provider: 'nowpayments',
      signatureValid: input.signatureValid,
      headers: input.headers,
      payload: input.payload,
      dedupeKey: input.dedupeKey,
      receivedAt: input.receivedAt,
      processedAt: null,
      reason: input.reason,
    };
    let transition: TransitionResult | null = null;
    let matched = false;
    if (input.signatureValid && input.providerPaymentId && input.toStatus) {
      const invoiceId = this.byProviderPayment.get(input.providerPaymentId);
      const invoice = invoiceId ? this.invoices.get(invoiceId) : undefined;
      if (invoice) {
        matched = true;
        const snapshot = this.snapshots.get(invoice.paymentId) ?? emptyPaymentSnapshot();
        transition = applyPaymentTransition(
          snapshot,
          {
            to: input.toStatus,
            source: 'ipn',
            organizationId: invoice.organizationId,
            paymentId: invoice.paymentId,
            providerWebhookId: webhook.id,
            ...(input.payAmount ? { payAmount: input.payAmount } : {}),
            ...(input.actuallyPaid ? { actuallyPaid: input.actuallyPaid } : {}),
          },
          { now: () => input.receivedAt, id: () => crypto.randomUUID() },
        );
        if (transition.audit) this.audits.push(transition.audit);
        if (transition.applied && transition.snapshot.status && transition.invoiceStatus) {
          this.snapshots.set(invoice.paymentId, transition.snapshot);
          invoice.paymentStatus = transition.snapshot.status;
          invoice.rawStatus = input.toStatus;
          invoice.status = transition.invoiceStatus;
          invoice.overpaid = transition.snapshot.overpaid;
          invoice.latePaymentReview = transition.snapshot.latePaymentReview;
          invoice.actuallyPaid = transition.snapshot.actuallyPaid;
          if (transition.snapshot.payAmount) invoice.payAmount = transition.snapshot.payAmount;
        }
        webhook.processedAt = input.receivedAt;
        webhook.reason = transition.reason;
      } else {
        webhook.reason = 'unmatched_payment';
      }
    }
    this.webhooks.set(input.dedupeKey, webhook);
    return { duplicate: false, webhook, transition, matched };
  }
}
