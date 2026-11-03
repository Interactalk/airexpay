import { DurableObject } from 'cloudflare:workers';
import type { WebhookRecord } from './repository.ts';
import { MemoryDatabase, type MemorySnapshot } from './memory.ts';
import type {
  AcceptWebhookInput,
  AcceptWebhookResult,
  CreateInvoiceInput,
  DeliveryInput,
  IdempotencyRecord,
  InvoiceRecord,
  OutboxRecord,
  WebhookEndpointRecord,
} from './repository.ts';
import { webhookKeyring, type WebhookSecretKeyring } from '@airexpay/payment-core';
import type { AuditRecord, PaymentSnapshot } from '@airexpay/payment-core';

export interface DirectoryRegistration {
  publicId: string;
  providerPaymentId: string;
  organizationId: string;
  invoiceId: string;
}

interface DirectoryState {
  publicIds: Record<string, string>;
  providerPayments: Record<string, string>;
  organizations: string[];
  webhooks: WebhookRecord[];
}

type StoreEnv = Env & {
  WEBHOOK_SECRET_ENCRYPTION_KEY?: string;
  WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS?: string;
};

/**
 * SQLite Durable Object for simulation state.
 *
 * `org:{organizationId}` is the consistency boundary for that organization's
 * invoices, payments, idempotency, endpoints, and outbox.
 * `directory` maps public ids and provider payment ids to an organization.
 * `rate:{client}` is the consistency boundary for one simulation rate-limit key.
 *
 * `blockConcurrencyWhile` stays held across WebCrypto so a snapshot read and
 * the following write cannot interleave. It does not wrap outbound fetch.
 */
export class InvoiceStore extends DurableObject<StoreEnv> {
  constructor(ctx: DurableObjectState, env: StoreEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          body TEXT NOT NULL
        )`,
      );
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rate_hits (at_ms INTEGER NOT NULL)');
    });
  }

  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceRecord> {
    return this.mutateOrg((db) => db.createInvoice(input));
  }

  async getInvoice(idOrPublicId: string, organizationId: string): Promise<InvoiceRecord | null> {
    return this.readOrg((db) => db.getInvoice(idOrPublicId, organizationId));
  }

  async getByPublicId(publicId: string): Promise<InvoiceRecord | null> {
    return this.readOrg((db) => db.getByPublicId(publicId));
  }

  async getIdempotency(
    organizationId: string,
    key: string,
    nowIso: string,
  ): Promise<IdempotencyRecord | null> {
    return this.readOrg((db) => db.getIdempotency(organizationId, key, nowIso));
  }

  async saveIdempotency(record: IdempotencyRecord): Promise<void> {
    await this.mutateOrg((db) => {
      db.saveIdempotency(record);
    });
  }

  async acceptWebhook(input: AcceptWebhookInput): Promise<AcceptWebhookResult> {
    return this.mutateOrg((db) => db.acceptWebhook(input));
  }

  async saveWebhookEndpoint(input: {
    id?: string;
    organizationId: string;
    url: string;
    secret: string;
    events: string[];
    active?: boolean;
  }): Promise<WebhookEndpointRecord> {
    return this.mutateOrg((db) => db.saveWebhookEndpoint(input));
  }

  async listEndpoints(organizationId: string): Promise<WebhookEndpointRecord[]> {
    return this.readOrg(async (db) => [...(await db.listEndpoints(organizationId))]);
  }

  async listDueOutbox(nowIso: string, limit: number, maxAttempts: number): Promise<OutboxRecord[]> {
    return this.readOrg((db) => [...db.listDueOutbox(nowIso, limit, maxAttempts)]);
  }

  async insertDelivery(input: DeliveryInput): Promise<void> {
    await this.mutateOrg((db) => {
      db.insertDelivery(input);
    });
  }

  async markOutboxPublished(id: string, at: string, attempts: number): Promise<void> {
    await this.mutateOrg((db) => {
      db.markOutboxPublished(id, at, attempts);
    });
  }

  async markOutboxRetry(id: string, attempts: number, nextRetryAt: string): Promise<void> {
    await this.mutateOrg((db) => {
      db.markOutboxRetry(id, attempts, nextRetryAt);
    });
  }

  async markOutboxDeadLetter(id: string, at: string, attempts: number): Promise<void> {
    await this.mutateOrg((db) => {
      db.markOutboxDeadLetter(id, at, attempts);
    });
  }

  async getOutbox(id: string): Promise<OutboxRecord | null> {
    return this.readOrg((db) => db.getOutbox(id));
  }

  async listOrgWebhooks(): Promise<WebhookRecord[]> {
    return this.readOrg((db) => [...db.listWebhooks()]);
  }

  async listAudits(): Promise<AuditRecord[]> {
    return this.readOrg((db) => [...db.listAudits()]);
  }

  async outboxFor(paymentId: string): Promise<PaymentSnapshot['outbox']> {
    return this.readOrg((db) => [...db.outboxFor(paymentId)]);
  }

  async eventsFor(paymentId: string): Promise<PaymentSnapshot['events']> {
    return this.readOrg((db) => [...db.eventsFor(paymentId)]);
  }

  async registerInvoice(entry: DirectoryRegistration): Promise<void> {
    await this.mutateDirectory((state) => {
      state.publicIds[entry.publicId] = entry.organizationId;
      state.providerPayments[entry.providerPaymentId] = entry.organizationId;
      if (!state.organizations.includes(entry.organizationId)) {
        state.organizations.push(entry.organizationId);
      }
    });
  }

  async lookupPublicId(publicId: string): Promise<string | null> {
    return this.readDirectory((state) => state.publicIds[publicId] ?? null);
  }

  async lookupProviderPayment(providerPaymentId: string): Promise<string | null> {
    return this.readDirectory((state) => state.providerPayments[providerPaymentId] ?? null);
  }

  async listOrganizations(): Promise<string[]> {
    return this.readDirectory((state) => [...state.organizations]);
  }

  async acceptUnmatchedWebhook(input: AcceptWebhookInput): Promise<AcceptWebhookResult> {
    return this.locked('directory', async () => {
      const state = this.loadDirectory();
      const existing = state.webhooks.find((row) => row.dedupeKey === input.dedupeKey);
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
        reason: input.signatureValid ? 'unmatched_payment' : input.reason,
      };
      state.webhooks.push(webhook);
      this.saveDirectory(state);
      return { duplicate: false, webhook, transition: null, matched: false };
    });
  }

  async listDirectoryWebhooks(): Promise<WebhookRecord[]> {
    return this.readDirectory((state) => [...state.webhooks]);
  }

  async take(
    nowMs: number,
    limit: number,
    windowMs: number,
  ): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }> {
    this.assertKind('rate');
    return this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec('DELETE FROM rate_hits WHERE at_ms <= ?', nowMs - windowMs);
      const count = Number(
        this.ctx.storage.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM rate_hits').toArray()[0]
          ?.n ?? 0,
      );
      if (count >= limit) {
        const oldest = Number(
          this.ctx.storage.sql
            .exec<{ at_ms: number | null }>('SELECT MIN(at_ms) AS at_ms FROM rate_hits')
            .toArray()[0]?.at_ms ?? nowMs,
        );
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000)),
        };
      }
      this.ctx.storage.sql.exec('INSERT INTO rate_hits (at_ms) VALUES (?)', nowMs);
      return { allowed: true, retryAfterSeconds: 0 };
    });
  }

  private keys(): WebhookSecretKeyring {
    return webhookKeyring(
      this.env.WEBHOOK_SECRET_ENCRYPTION_KEY,
      this.env.WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS,
    );
  }

  private async readOrg<T>(fn: (db: MemoryDatabase) => T | Promise<T>): Promise<T> {
    return this.locked('org', async () => fn(this.loadOrg()));
  }

  private async mutateOrg<T>(fn: (db: MemoryDatabase) => T | Promise<T>): Promise<T> {
    return this.locked('org', async () => {
      const db = this.loadOrg();
      const result = await fn(db);
      this.saveOrg(db);
      return result;
    });
  }

  private loadOrg(): MemoryDatabase {
    const raw = this.readBody();
    if (!raw) return new MemoryDatabase(this.keys());
    const parsed = JSON.parse(raw) as { kind?: string; memory?: MemorySnapshot };
    if (parsed.kind !== 'org' || !parsed.memory) {
      throw new Error('InvoiceStore organization state is missing');
    }
    return MemoryDatabase.fromSnapshot(parsed.memory, this.keys());
  }

  private saveOrg(db: MemoryDatabase): void {
    this.writeBody(JSON.stringify({ kind: 'org', memory: db.snapshot() }));
  }

  private async readDirectory<T>(fn: (state: DirectoryState) => T | Promise<T>): Promise<T> {
    return this.locked('directory', async () => fn(this.loadDirectory()));
  }

  private async mutateDirectory(
    fn: (state: DirectoryState) => void | Promise<void>,
  ): Promise<void> {
    await this.locked('directory', async () => {
      const state = this.loadDirectory();
      await fn(state);
      this.saveDirectory(state);
    });
  }

  private loadDirectory(): DirectoryState {
    const raw = this.readBody();
    if (!raw) return emptyDirectory();
    const parsed = JSON.parse(raw) as { kind?: string; directory?: DirectoryState };
    if (parsed.kind !== 'directory' || !parsed.directory) {
      throw new Error('InvoiceStore directory state is missing');
    }
    return parsed.directory;
  }

  private saveDirectory(state: DirectoryState): void {
    this.writeBody(JSON.stringify({ kind: 'directory', directory: state }));
  }

  private readBody(): string | null {
    const row = this.ctx.storage.sql
      .exec<{ body: string }>('SELECT body FROM state WHERE id = 1')
      .toArray()[0];
    return row?.body ?? null;
  }

  private writeBody(body: string): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO state (id, body) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body',
      body,
    );
  }

  private async locked<T>(kind: 'org' | 'directory', run: () => Promise<T>): Promise<T> {
    this.assertKind(kind);
    let result!: T;
    await this.ctx.blockConcurrencyWhile(async () => {
      result = await run();
    });
    return result;
  }

  private assertKind(kind: 'org' | 'directory' | 'rate'): void {
    const name = this.ctx.id.name;
    if (!name) throw new Error('InvoiceStore requires a named Durable Object id');
    const actual = name.startsWith('org:')
      ? 'org'
      : name.startsWith('rate:')
        ? 'rate'
        : name === 'directory'
          ? 'directory'
          : 'unknown';
    if (actual !== kind) throw new Error(`InvoiceStore ${name} is not a ${kind} object`);
  }
}

function emptyDirectory(): DirectoryState {
  return { publicIds: {}, providerPayments: {}, organizations: [], webhooks: [] };
}
