import { SIMULATION_CHECKOUT_LIMIT, SIMULATION_CHECKOUT_WINDOW_MS } from '@airexpay/configuration';
import type { AuditRecord, PaymentSnapshot } from '@airexpay/payment-core';
import {
  durableObjectRateName,
  type RateLimitDecision,
  type SimulationRateLimit,
} from '../rate-limit.ts';
import type { DirectoryRegistration } from './invoice-store.ts';
import type { OnboardingSnapshot } from './onboarding-store.ts';
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

export interface InvoiceStoreRpc {
  createInvoice(input: CreateInvoiceInput): Promise<InvoiceRecord>;
  getInvoice(idOrPublicId: string, organizationId: string): Promise<InvoiceRecord | null>;
  getByPublicId(publicId: string): Promise<InvoiceRecord | null>;
  getIdempotency(
    organizationId: string,
    key: string,
    nowIso: string,
  ): Promise<IdempotencyRecord | null>;
  saveIdempotency(record: IdempotencyRecord): Promise<void>;
  acceptWebhook(input: AcceptWebhookInput): Promise<AcceptWebhookResult>;
  saveWebhookEndpoint(input: {
    id?: string;
    organizationId: string;
    url: string;
    secret: string;
    events: string[];
    active?: boolean;
  }): Promise<WebhookEndpointRecord>;
  listEndpoints(organizationId: string): Promise<readonly WebhookEndpointRecord[]>;
  listDueOutbox(
    nowIso: string,
    limit: number,
    maxAttempts: number,
  ): Promise<readonly OutboxRecord[]>;
  insertDelivery(input: DeliveryInput): Promise<void>;
  markOutboxPublished(id: string, at: string, attempts: number): Promise<void>;
  markOutboxRetry(id: string, attempts: number, nextRetryAt: string): Promise<void>;
  markOutboxDeadLetter(id: string, at: string, attempts: number): Promise<void>;
  getOutbox(id: string): Promise<OutboxRecord | null>;
  listOrgWebhooks(): Promise<readonly WebhookRecord[]>;
  listAudits(): Promise<readonly AuditRecord[]>;
  outboxFor(paymentId: string): Promise<PaymentSnapshot['outbox']>;
  eventsFor(paymentId: string): Promise<PaymentSnapshot['events']>;
  registerInvoice(entry: DirectoryRegistration): Promise<void>;
  lookupPublicId(publicId: string): Promise<string | null>;
  lookupProviderPayment(providerPaymentId: string): Promise<string | null>;
  listOrganizations(): Promise<readonly string[]>;
  acceptUnmatchedWebhook(input: AcceptWebhookInput): Promise<AcceptWebhookResult>;
  listDirectoryWebhooks(): Promise<readonly WebhookRecord[]>;
  take(nowMs: number, limit: number, windowMs: number): Promise<RateLimitDecision>;
  loadDirectoryOnboarding(): Promise<OnboardingSnapshot>;
  saveDirectoryOnboarding(snapshot: OnboardingSnapshot): Promise<void>;
}

export interface InvoiceStoreClient {
  getByName(name: string): InvoiceStoreRpc;
}

/**
 * One organization object owns that tenant's rows. The directory object only
 * maps public ids and provider payment ids, so checkout and IPN lookups from
 * any isolate find the same organization object.
 */
export class DurableObjectRepository implements InvoiceRepository {
  constructor(private readonly store: InvoiceStoreClient) {}

  async listWebhooks(): Promise<readonly WebhookRecord[]> {
    const organizations = await this.directory().listOrganizations();
    const rows = [...(await this.directory().listDirectoryWebhooks())];
    for (const organizationId of organizations) {
      rows.push(...(await this.org(organizationId).listOrgWebhooks()));
    }
    return rows;
  }

  async listAudits(): Promise<readonly AuditRecord[]> {
    const organizations = await this.directory().listOrganizations();
    const rows: AuditRecord[] = [];
    for (const organizationId of organizations) {
      rows.push(...(await this.org(organizationId).listAudits()));
    }
    return rows;
  }

  async outboxFor(paymentId: string): Promise<PaymentSnapshot['outbox']> {
    for (const organizationId of await this.directory().listOrganizations()) {
      const rows = await this.org(organizationId).outboxFor(paymentId);
      if (rows.length > 0) return rows;
    }
    return [];
  }

  async eventsFor(paymentId: string): Promise<PaymentSnapshot['events']> {
    for (const organizationId of await this.directory().listOrganizations()) {
      const rows = await this.org(organizationId).eventsFor(paymentId);
      if (rows.length > 0) return rows;
    }
    return [];
  }

  async getInvoice(idOrPublicId: string, organizationId: string): Promise<InvoiceRecord | null> {
    return this.org(organizationId).getInvoice(idOrPublicId, organizationId);
  }

  async getByPublicId(publicId: string): Promise<InvoiceRecord | null> {
    const organizationId = await this.directory().lookupPublicId(publicId);
    if (!organizationId) return null;
    return this.org(organizationId).getByPublicId(publicId);
  }

  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceRecord> {
    const record = await this.org(input.organizationId).createInvoice(input);
    await this.directory().registerInvoice({
      publicId: record.publicId,
      providerPaymentId: record.providerPaymentId,
      organizationId: record.organizationId,
      invoiceId: record.id,
    });
    return record;
  }

  async getIdempotency(
    organizationId: string,
    key: string,
    nowIso: string,
  ): Promise<IdempotencyRecord | null> {
    return this.org(organizationId).getIdempotency(organizationId, key, nowIso);
  }

  async saveIdempotency(record: IdempotencyRecord): Promise<void> {
    await this.org(record.organizationId).saveIdempotency(record);
  }

  async acceptWebhook(input: AcceptWebhookInput): Promise<AcceptWebhookResult> {
    if (input.providerPaymentId) {
      const organizationId = await this.directory().lookupProviderPayment(input.providerPaymentId);
      if (organizationId) return this.org(organizationId).acceptWebhook(input);
    }
    return this.directory().acceptUnmatchedWebhook(input);
  }

  async saveWebhookEndpoint(input: {
    id?: string;
    organizationId: string;
    url: string;
    secret: string;
    events: string[];
    active?: boolean;
  }): Promise<WebhookEndpointRecord> {
    return this.org(input.organizationId).saveWebhookEndpoint(input);
  }

  async listEndpoints(organizationId: string): Promise<readonly WebhookEndpointRecord[]> {
    return this.org(organizationId).listEndpoints(organizationId);
  }

  async listDueOutbox(
    nowIso: string,
    limit: number,
    maxAttempts: number,
  ): Promise<readonly OutboxRecord[]> {
    const rows: OutboxRecord[] = [];
    for (const organizationId of await this.directory().listOrganizations()) {
      rows.push(...(await this.org(organizationId).listDueOutbox(nowIso, limit, maxAttempts)));
    }
    return rows
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
      )
      .slice(0, limit);
  }

  async insertDelivery(input: DeliveryInput): Promise<void> {
    const organizationId = await this.organizationForOutbox(input.outboxEventId);
    await this.org(organizationId).insertDelivery(input);
  }

  async markOutboxPublished(id: string, at: string, attempts: number): Promise<void> {
    const organizationId = await this.organizationForOutbox(id);
    await this.org(organizationId).markOutboxPublished(id, at, attempts);
  }

  async markOutboxRetry(id: string, attempts: number, nextRetryAt: string): Promise<void> {
    const organizationId = await this.organizationForOutbox(id);
    await this.org(organizationId).markOutboxRetry(id, attempts, nextRetryAt);
  }

  async markOutboxDeadLetter(id: string, at: string, attempts: number): Promise<void> {
    const organizationId = await this.organizationForOutbox(id);
    await this.org(organizationId).markOutboxDeadLetter(id, at, attempts);
  }

  async getOutbox(id: string): Promise<OutboxRecord | null> {
    for (const organizationId of await this.directory().listOrganizations()) {
      const row = await this.org(organizationId).getOutbox(id);
      if (row) return row;
    }
    return null;
  }

  loadOnboarding(): Promise<OnboardingSnapshot> {
    return this.directory().loadDirectoryOnboarding();
  }

  saveOnboarding(snapshot: OnboardingSnapshot): Promise<void> {
    return this.directory().saveDirectoryOnboarding(snapshot);
  }

  private org(organizationId: string): InvoiceStoreRpc {
    return this.store.getByName(`org:${organizationId}`);
  }

  private directory(): InvoiceStoreRpc {
    return this.store.getByName('directory');
  }

  private async organizationForOutbox(id: string): Promise<string> {
    for (const organizationId of await this.directory().listOrganizations()) {
      const row = await this.org(organizationId).getOutbox(id);
      if (row) return organizationId;
    }
    throw new Error('outbox event not found');
  }
}

export class DurableObjectRateLimit implements SimulationRateLimit {
  constructor(private readonly store: InvoiceStoreClient) {}

  take(key: string, nowMs: number): Promise<RateLimitDecision> {
    return this.store
      .getByName(durableObjectRateName(key))
      .take(nowMs, SIMULATION_CHECKOUT_LIMIT, SIMULATION_CHECKOUT_WINDOW_MS);
  }
}
