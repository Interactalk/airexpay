import { SIMULATION_ORG_IDS } from '@airexpay/configuration';
import type {
  AuditRecord,
  PaymentSnapshot,
  TransitionResult,
  UsageAccrual,
  UsageStatement,
} from '@airexpay/payment-core';
import {
  applyPaymentTransition,
  decryptWebhookSecret,
  emptyPaymentSnapshot,
  encryptWebhookSecret,
  ModeBUsageLedger,
  requireWebhookKey,
  selectFeeCollection,
  type WebhookSecretKeyring,
} from '@airexpay/payment-core';
import type {
  AcceptWebhookInput,
  AcceptWebhookResult,
  CreateInvoiceInput,
  DeliveryInput,
  IdempotencyRecord,
  InvoiceRecord,
  InvoiceRepository,
  OutboxRecord,
  WebhookEndpointRecord,
  WebhookRecord,
} from './repository.ts';
import { OnboardingRecords, type OnboardingSnapshot } from './onboarding-store.ts';

interface StoredEndpoint {
  id: string;
  organizationId: string;
  url: string;
  secretCiphertext: string;
  events: string[];
  active: boolean;
}

export interface MemorySnapshot {
  invoiceSequence: number;
  invoices: InvoiceRecord[];
  snapshots: Array<[string, PaymentSnapshot]>;
  webhooks: WebhookRecord[];
  idempotency: IdempotencyRecord[];
  endpoints: StoredEndpoint[];
  outbox: OutboxRecord[];
  deliveries: DeliveryInput[];
  audits: AuditRecord[];
  onboarding?: OnboardingSnapshot;
  /** Mode B merchant usage lines. Absent on snapshots written before pricing. */
  usageLedger?: UsageAccrual[];
}

export type {
  AcceptWebhookInput,
  AcceptWebhookResult,
  CreateInvoiceInput,
  IdempotencyRecord,
  InvoiceRecord,
  WebhookRecord,
} from './repository.ts';

function merchantNameFor(organizationId: string): string {
  if (organizationId === SIMULATION_ORG_IDS.alpha) return 'Northwind Studio';
  if (organizationId === SIMULATION_ORG_IDS.beta) return 'Harbor Goods';
  return 'Merchant';
}

function toEndpointRecord(row: StoredEndpoint, secret: string): WebhookEndpointRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    url: row.url,
    secret,
    events: [...row.events],
    active: row.active,
  };
}

export class MemoryDatabase implements InvoiceRepository {
  private readonly invoices = new Map<string, InvoiceRecord>();
  private readonly byPublicId = new Map<string, string>();
  private readonly byProviderPayment = new Map<string, string>();
  private readonly snapshots = new Map<string, PaymentSnapshot>();
  private readonly webhooks = new Map<string, WebhookRecord>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly audits: AuditRecord[] = [];
  private readonly endpoints = new Map<string, StoredEndpoint>();
  private readonly outbox = new Map<string, OutboxRecord>();
  private readonly deliveries: DeliveryInput[] = [];
  private invoiceSequence = 1000;
  private readonly usage = selectFeeCollection(new ModeBUsageLedger());
  readonly onboarding = new OnboardingRecords();

  constructor(private readonly webhookKeys: WebhookSecretKeyring = {}) {}

  /** Plain JSON state. Webhook secrets in this object are ciphertext, not the signing secret. */
  snapshot(): MemorySnapshot {
    return {
      invoiceSequence: this.invoiceSequence,
      invoices: [...this.invoices.values()].map((row) => structuredClone(row)),
      snapshots: [...this.snapshots.entries()].map(
        ([id, snapshot]) => [id, structuredClone(snapshot)] as [string, PaymentSnapshot],
      ),
      webhooks: [...this.webhooks.values()].map((row) => structuredClone(row)),
      idempotency: [...this.idempotency.values()].map((row) => structuredClone(row)),
      endpoints: [...this.endpoints.values()].map((row) => structuredClone(row)),
      outbox: [...this.outbox.values()].map((row) => structuredClone(row)),
      deliveries: this.deliveries.map((row) => structuredClone(row)),
      audits: this.audits.map((row) => structuredClone(row)),
      onboarding: this.onboarding.snapshot(),
      usageLedger: this.usage.list(),
    };
  }

  static fromSnapshot(
    snapshot: MemorySnapshot | undefined,
    keys: WebhookSecretKeyring = {},
  ): MemoryDatabase {
    const db = new MemoryDatabase(keys);
    if (!snapshot) return db;
    const copy = structuredClone(snapshot);
    db.invoiceSequence = copy.invoiceSequence;
    for (const invoice of copy.invoices) {
      db.invoices.set(invoice.id, invoice);
      db.byPublicId.set(invoice.publicId, invoice.id);
      db.byProviderPayment.set(invoice.providerPaymentId, invoice.id);
    }
    for (const [id, payment] of copy.snapshots) db.snapshots.set(id, payment);
    for (const webhook of copy.webhooks) db.webhooks.set(webhook.dedupeKey, webhook);
    for (const row of copy.idempotency) {
      db.idempotency.set(`${row.organizationId}:${row.key}`, row);
    }
    for (const endpoint of copy.endpoints) db.endpoints.set(endpoint.id, endpoint);
    for (const event of copy.outbox) db.outbox.set(event.id, event);
    db.deliveries.push(...copy.deliveries);
    db.audits.push(...copy.audits);
    db.onboarding.restore(copy.onboarding);
    db.usage.restore(copy.usageLedger ?? []);
    return db;
  }

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

  getByPublicId(publicId: string): InvoiceRecord | null {
    const internal = this.byPublicId.get(publicId);
    if (!internal) return null;
    return this.invoices.get(internal) ?? null;
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
      merchantName: merchantNameFor(input.organizationId),
      ...(input.feeSnapshot ? { feeSnapshot: structuredClone(input.feeSnapshot) } : {}),
    };
    this.invoices.set(record.id, record);
    this.byPublicId.set(record.publicId, record.id);
    this.byProviderPayment.set(record.providerPaymentId, record.id);
    this.snapshots.set(paymentId, opened.snapshot);
    this.rememberOutbox(opened.snapshot);
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
   * and do not re-apply a transition. Rejected transitions still keep their audit row.
   */
  acceptWebhook(input: AcceptWebhookInput): AcceptWebhookResult {
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
          this.rememberOutbox(transition.snapshot);
          invoice.paymentStatus = transition.snapshot.status;
          invoice.rawStatus = input.toStatus;
          invoice.status = transition.invoiceStatus;
          invoice.overpaid = transition.snapshot.overpaid;
          invoice.latePaymentReview = transition.snapshot.latePaymentReview;
          invoice.actuallyPaid = transition.snapshot.actuallyPaid;
          if (transition.snapshot.payAmount) invoice.payAmount = transition.snapshot.payAmount;
          if (transition.invoiceStatus === 'paid') {
            this.usage.accrue({
              invoiceId: invoice.id,
              organizationId: invoice.organizationId,
              status: 'paid',
              paidAt: input.receivedAt,
              snapshot: invoice.feeSnapshot ?? null,
            });
          }
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

  async saveWebhookEndpoint(input: {
    id?: string;
    organizationId: string;
    url: string;
    secret: string;
    events: string[];
    active?: boolean;
  }): Promise<WebhookEndpointRecord> {
    const record: StoredEndpoint = {
      id: input.id ?? crypto.randomUUID(),
      organizationId: input.organizationId,
      url: input.url,
      secretCiphertext: await encryptWebhookSecret(
        input.secret,
        requireWebhookKey(this.webhookKeys),
      ),
      events: [...input.events],
      active: input.active ?? true,
    };
    this.endpoints.set(record.id, record);
    return toEndpointRecord(record, input.secret);
  }

  async listEndpoints(organizationId: string): Promise<readonly WebhookEndpointRecord[]> {
    const rows = [...this.endpoints.values()].filter(
      (endpoint) => endpoint.organizationId === organizationId && endpoint.active,
    );
    const key = requireWebhookKey(this.webhookKeys);
    const listed: WebhookEndpointRecord[] = [];
    for (const row of rows) {
      listed.push(
        toEndpointRecord(
          row,
          await decryptWebhookSecret(row.secretCiphertext, key, this.webhookKeys.previous),
        ),
      );
    }
    return listed;
  }

  listDueOutbox(nowIso: string, limit: number, maxAttempts: number): readonly OutboxRecord[] {
    return [...this.outbox.values()]
      .filter((event) => {
        if (event.publishedAt || event.deadLetteredAt) return false;
        if (event.attempts >= maxAttempts) return false;
        if (event.nextRetryAt && event.nextRetryAt > nowIso) return false;
        return true;
      })
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
      )
      .slice(0, limit);
  }

  insertDelivery(input: DeliveryInput): void {
    this.deliveries.push(input);
  }

  markOutboxPublished(id: string, at: string, attempts: number): void {
    const event = this.requireOutbox(id);
    event.publishedAt = at;
    event.attempts = attempts;
    event.nextRetryAt = null;
    event.deadLetteredAt = null;
  }

  markOutboxRetry(id: string, attempts: number, nextRetryAt: string): void {
    const event = this.requireOutbox(id);
    event.attempts = attempts;
    event.nextRetryAt = nextRetryAt;
  }

  markOutboxDeadLetter(id: string, at: string, attempts: number): void {
    const event = this.requireOutbox(id);
    event.attempts = attempts;
    event.deadLetteredAt = at;
    event.nextRetryAt = null;
  }

  getOutbox(id: string): OutboxRecord | null {
    return this.outbox.get(id) ?? null;
  }

  usageEntries(organizationId: string): readonly UsageAccrual[] {
    return this.usage.entriesFor(organizationId);
  }

  usageStatement(organizationId: string, month: string): UsageStatement {
    return this.usage.statement(organizationId, month);
  }

  private requireOutbox(id: string): OutboxRecord {
    const event = this.outbox.get(id);
    if (!event) throw new Error('outbox event not found');
    return event;
  }

  private rememberOutbox(snapshot: PaymentSnapshot): void {
    for (const event of snapshot.outbox) {
      if (this.outbox.has(event.id)) continue;
      this.outbox.set(event.id, {
        id: event.id,
        organizationId: event.organizationId,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: event.createdAt,
        attempts: event.attempts,
        publishedAt: event.publishedAt,
        deadLetteredAt: null,
        nextRetryAt: null,
      });
    }
  }
}
