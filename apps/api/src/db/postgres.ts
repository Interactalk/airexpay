import type {
  AuditRecord,
  PaymentEvent,
  PaymentSnapshot,
  TransitionResult,
} from '@airexpay/payment-core';
import { emptyPaymentSnapshot } from '@airexpay/payment-core';
import type { InvoiceStatus, PaymentStatus } from '@airexpay/shared';
import { isDecimalString } from '@airexpay/shared';
import type {
  AcceptWebhookInput,
  AcceptWebhookResult,
  CreateInvoiceInput,
  DeliveryInput,
  IdempotencyRecord,
  InvoiceRecord,
  InvoiceRepository,
  OutboxRecord,
  SqlClient,
  SqlPool,
  WebhookEndpointRecord,
  WebhookRecord,
} from './repository.ts';

const INVOICE_SQL = `
  select
    i.id::text as id,
    i.organization_id::text as organization_id,
    i.public_id,
    i.number,
    i.price_amount::text as price_amount,
    i.price_currency,
    i.status::text as status,
    i.provider,
    i.provider_invoice_id,
    i.checkout_url,
    i.order_id,
    i.description,
    i.expires_at,
    i.overpaid,
    i.late_payment_review,
    i.created_at,
    p.id::text as payment_id,
    p.provider_payment_id,
    p.pay_currency,
    p.network,
    p.pay_amount::text as pay_amount,
    p.actually_paid::text as actually_paid,
    p.pay_address,
    p.status::text as payment_status,
    p.raw_status,
    o.display_name as merchant_name
  from public.invoices i
  join public.payments p on p.invoice_id = i.id
  join public.organizations o on o.id = i.organization_id
`;

/**
 * Parameterized SQL against the Phase 1 schema. The caller supplies the client
 * (embedded Postgres in tests). This class does not open a network connection.
 */
export class PostgresRepository implements InvoiceRepository {
  constructor(private readonly sql: SqlPool) {}

  async listWebhooks(): Promise<readonly WebhookRecord[]> {
    const result = await this.sql.query(
      `select id::text, signature_valid, headers, payload, dedupe_key, received_at, processed_at
       from public.provider_webhooks
       order by received_at`,
    );
    return result.rows.map((row) => this.mapWebhook(row, null));
  }

  async listAudits(): Promise<readonly AuditRecord[]> {
    const result = await this.sql.query(
      `select id::text, organization_id::text, action, target, metadata, created_at
       from public.audit_logs
       order by created_at`,
    );
    return result.rows.map((row) => ({
      id: text(row.id),
      organizationId: text(row.organization_id),
      action: text(row.action),
      target: row.target == null ? '' : text(row.target),
      createdAt: iso(row.created_at),
      metadata: asRecord(row.metadata),
    }));
  }

  async outboxFor(paymentId: string): Promise<PaymentSnapshot['outbox']> {
    const result = await this.sql.query(
      `select id::text, organization_id::text, event_type, payload, created_at, published_at, attempts
       from public.outbox_events
       where payload->>'payment_id' = $1
       order by created_at, id`,
      [paymentId],
    );
    return result.rows.map((row) => ({
      id: text(row.id),
      organizationId: text(row.organization_id),
      eventType: text(row.event_type),
      payload: asRecord(row.payload),
      createdAt: iso(row.created_at),
      publishedAt: row.published_at == null ? null : iso(row.published_at),
      attempts: numberValue(row.attempts),
    }));
  }

  async eventsFor(paymentId: string): Promise<PaymentSnapshot['events']> {
    const result = await this.sql.query(
      `select id::text, payment_id::text, organization_id::text, from_status::text as from_status,
              to_status::text as to_status, source, provider_webhook_id::text as provider_webhook_id,
              overpaid, late_payment_review, created_at
       from public.payment_events
       where payment_id = $1::uuid
       order by created_at, id`,
      [paymentId],
    );
    return result.rows.map((row) => {
      const event: PaymentEvent = {
        id: text(row.id),
        paymentId: text(row.payment_id),
        organizationId: text(row.organization_id),
        fromStatus:
          row.from_status == null ? null : (text(row.from_status) as PaymentEvent['fromStatus']),
        toStatus: text(row.to_status) as PaymentEvent['toStatus'],
        source: text(row.source) as PaymentEvent['source'],
        createdAt: iso(row.created_at),
        overpaid: bool(row.overpaid),
        latePaymentReview: bool(row.late_payment_review),
      };
      if (row.provider_webhook_id) event.providerWebhookId = text(row.provider_webhook_id);
      return event;
    });
  }

  getInvoice(idOrPublicId: string, organizationId: string): Promise<InvoiceRecord | null> {
    return this.fetchInvoice(this.sql, organizationId, idOrPublicId);
  }

  async getByPublicId(publicId: string): Promise<InvoiceRecord | null> {
    const result = await this.sql.query(`${INVOICE_SQL} where i.public_id = $1 limit 1`, [
      publicId,
    ]);
    const row = result.rows[0];
    return row ? mapInvoice(row) : null;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceRecord> {
    return this.sql.transaction(async (tx) => {
      const org = await tx.query<{ display_name: string }>(
        `select display_name from public.organizations where id = $1::uuid`,
        [input.organizationId],
      );
      if (!org.rows[0]) {
        throw new Error('organization not found');
      }
      const invoiceId = crypto.randomUUID();
      const paymentId = crypto.randomUUID();
      const count = await tx.query<{ n: number }>(
        `select (count(*) + 1001)::int as n from public.invoices where organization_id = $1::uuid`,
        [input.organizationId],
      );
      const number = `INV-${count.rows[0]?.n ?? 1001}`;
      await tx.query(
        `insert into public.invoices (
           id, organization_id, public_id, number, price_amount, price_currency, status,
           provider, provider_invoice_id, checkout_url, order_id, description, expires_at,
           overpaid, late_payment_review, created_at
         ) values (
           $1::uuid, $2::uuid, $3, $4, $5::numeric, $6, 'waiting',
           'mock', $7, $8, $9, $10, $11::timestamptz,
           false, false, $12::timestamptz
         )`,
        [
          invoiceId,
          input.organizationId,
          input.publicId,
          number,
          input.priceAmount,
          input.priceCurrency,
          input.providerInvoiceId,
          input.checkoutUrl,
          input.orderId,
          input.description,
          input.expiresAt,
          input.createdAt,
        ],
      );
      await tx.query(
        `insert into public.payments (
           id, organization_id, invoice_id, provider, provider_payment_id, pay_currency,
           network, pay_amount, actually_paid, pay_address, status, raw_status, created_at
         ) values (
           $1::uuid, $2::uuid, $3::uuid, 'mock', $4, $5,
           $6, $7::numeric, 0, $8, 'waiting', 'waiting', $9::timestamptz
         )`,
        [
          paymentId,
          input.organizationId,
          invoiceId,
          input.providerPaymentId,
          input.payCurrency,
          input.network,
          input.payAmount,
          input.payAddress,
          input.createdAt,
        ],
      );
      await tx.query(
        `insert into public.payment_events (
           payment_id, organization_id, from_status, to_status, source, overpaid, late_payment_review, created_at
         ) values ($1::uuid, $2::uuid, null, 'waiting', 'mock', false, false, $3::timestamptz)`,
        [paymentId, input.organizationId, input.createdAt],
      );
      await tx.query(
        `insert into public.outbox_events (organization_id, event_type, payload)
         values (
           $1::uuid,
           'payment.waiting',
           jsonb_build_object(
             'payment_id', $2::text,
             'from_status', null,
             'to_status', 'waiting',
             'invoice_status', 'waiting',
             'overpaid', false,
             'late_payment_review', false,
             'source', 'mock'
           )
         )`,
        [input.organizationId, paymentId],
      );
      const record = await this.fetchInvoice(tx, input.organizationId, invoiceId);
      if (!record) throw new Error('invoice insert failed');
      return record;
    });
  }

  async getIdempotency(
    organizationId: string,
    key: string,
    nowIso: string,
  ): Promise<IdempotencyRecord | null> {
    const result = await this.sql.query(
      `select organization_id::text, key, request_hash, status_code, response, expires_at
       from public.idempotency_keys
       where organization_id = $1::uuid and key = $2 and expires_at > $3::timestamptz`,
      [organizationId, key, nowIso],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      organizationId: text(row.organization_id),
      key: text(row.key),
      requestHash: text(row.request_hash),
      statusCode: numberValue(row.status_code),
      response: asJson(row.response),
      expiresAt: iso(row.expires_at),
    };
  }

  async saveIdempotency(record: IdempotencyRecord): Promise<void> {
    await this.sql.query(
      `insert into public.idempotency_keys (
         organization_id, key, request_hash, response, status_code, expires_at
       ) values ($1::uuid, $2, $3, $4::jsonb, $5::int, $6::timestamptz)
       on conflict (organization_id, key) do nothing`,
      [
        record.organizationId,
        record.key,
        record.requestHash,
        JSON.stringify(record.response),
        record.statusCode,
        record.expiresAt,
      ],
    );
  }

  async acceptWebhook(input: AcceptWebhookInput): Promise<AcceptWebhookResult> {
    return this.sql.transaction(async (tx) => {
      const existing = await tx.query(
        `select id::text, signature_valid, headers, payload, dedupe_key, received_at, processed_at
         from public.provider_webhooks where dedupe_key = $1`,
        [input.dedupeKey],
      );
      const existingRow = existing.rows[0];
      if (existingRow) {
        return {
          duplicate: true,
          webhook: this.mapWebhook(existingRow, null),
          transition: null,
          matched: false,
        };
      }

      const amountError = invalidAmount(input.payAmount) || invalidAmount(input.actuallyPaid);
      let payment: Record<string, unknown> | undefined;
      if (input.signatureValid && input.providerPaymentId) {
        const found = await tx.query(
          `select p.id::text as payment_id, p.organization_id::text as organization_id,
                  p.status::text as status, i.id::text as invoice_id
           from public.payments p
           join public.invoices i on i.id = p.invoice_id
           where p.provider = 'mock' and p.provider_payment_id = $1`,
          [input.providerPaymentId],
        );
        payment = found.rows[0];
      }

      let reason = input.reason;
      let applied = false;
      let matched = false;
      const willEvaluate = Boolean(
        input.signatureValid &&
        input.providerPaymentId &&
        input.toStatus &&
        payment &&
        !amountError,
      );
      if (amountError) reason = 'invalid_amount';
      else if (input.signatureValid && input.providerPaymentId && !payment)
        reason = 'unmatched_payment';

      const inserted = await tx.query(
        `insert into public.provider_webhooks (
           provider, signature_valid, headers, payload, dedupe_key, received_at, processed_at
         ) values ('nowpayments', $1, $2::jsonb, $3::jsonb, $4, $5::timestamptz, $6::timestamptz)
         returning id::text, signature_valid, headers, payload, dedupe_key, received_at, processed_at`,
        [
          input.signatureValid,
          JSON.stringify(input.headers),
          JSON.stringify(input.payload ?? {}),
          input.dedupeKey,
          input.receivedAt,
          willEvaluate ? input.receivedAt : null,
        ],
      );
      const webhookRow = inserted.rows[0];
      if (!webhookRow) throw new Error('webhook insert failed');
      const webhookId = text(webhookRow.id);

      if (willEvaluate && payment && input.toStatus) {
        matched = true;
        const current = text(payment.status);
        if (current === input.toStatus) {
          reason = 'already_in_status';
          applied = false;
        } else {
          const transition = await tx.query<{ event_id: string | null }>(
            `select public.apply_payment_event(
               $1::uuid,
               $2::public.payment_status,
               'ipn',
               $3::uuid,
               $4::numeric,
               $5::numeric
             ) as event_id`,
            [
              text(payment.payment_id),
              input.toStatus,
              webhookId,
              input.actuallyPaid ?? null,
              input.payAmount ?? null,
            ],
          );
          const eventId = transition.rows[0]?.event_id ?? null;
          applied = eventId !== null;
          reason = applied ? 'applied' : 'forbidden_transition';
        }
      }

      const transition = matched
        ? ({
            applied,
            reason: (reason ?? 'applied') as TransitionResult['reason'],
            snapshot: emptyPaymentSnapshot(),
            outboxEvents: [],
          } satisfies TransitionResult)
        : null;
      return {
        duplicate: false,
        webhook: this.mapWebhook(webhookRow, reason),
        transition,
        matched,
      };
    });
  }

  async saveWebhookEndpoint(input: {
    id?: string;
    organizationId: string;
    url: string;
    secret: string;
    events: string[];
    active?: boolean;
  }): Promise<WebhookEndpointRecord> {
    const id = input.id ?? crypto.randomUUID();
    await this.sql.query(
      `insert into public.webhook_endpoints (
         id, organization_id, url, secret_ciphertext, events, active
       ) values ($1::uuid, $2::uuid, $3, convert_to($4, 'UTF8'), $5::text[], $6)`,
      [id, input.organizationId, input.url, input.secret, input.events, input.active ?? true],
    );
    return {
      id,
      organizationId: input.organizationId,
      url: input.url,
      secret: input.secret,
      events: [...input.events],
      active: input.active ?? true,
    };
  }

  async listEndpoints(organizationId: string): Promise<readonly WebhookEndpointRecord[]> {
    const result = await this.sql.query(
      `select id::text, organization_id::text, url,
              convert_from(secret_ciphertext, 'UTF8') as secret, events, active
       from public.webhook_endpoints
       where organization_id = $1::uuid and active = true and secret_ciphertext is not null`,
      [organizationId],
    );
    return result.rows.map((row) => ({
      id: text(row.id),
      organizationId: text(row.organization_id),
      url: text(row.url),
      secret: text(row.secret),
      events: asStringList(row.events),
      active: bool(row.active),
    }));
  }

  async listDueOutbox(
    nowIso: string,
    limit: number,
    maxAttempts: number,
  ): Promise<readonly OutboxRecord[]> {
    const result = await this.sql.query(
      `select e.id::text, e.organization_id::text, e.event_type, e.payload, e.created_at, e.attempts
       from public.outbox_events e
       where e.published_at is null
         and e.organization_id is not null
         and e.attempts < $1::int
         and coalesce((
           select max(d.next_retry_at)
           from public.webhook_deliveries d
           where d.outbox_event_id = e.id
             and d.attempt = (
               select max(d2.attempt) from public.webhook_deliveries d2 where d2.outbox_event_id = e.id
             )
         ), '-infinity'::timestamptz) <= $2::timestamptz
       order by e.created_at, e.id
       limit $3::int`,
      [maxAttempts, nowIso, limit],
    );
    return result.rows.map((row) => ({
      id: text(row.id),
      organizationId: text(row.organization_id),
      eventType: text(row.event_type),
      payload: asRecord(row.payload),
      createdAt: iso(row.created_at),
      attempts: numberValue(row.attempts),
      publishedAt: null,
      deadLetteredAt: null,
      nextRetryAt: null,
    }));
  }

  async insertDelivery(input: DeliveryInput): Promise<void> {
    await this.sql.query(
      `insert into public.webhook_deliveries (
         endpoint_id, outbox_event_id, attempt, status_code, next_retry_at
       ) values ($1::uuid, $2::uuid, $3::int, $4::int, $5::timestamptz)`,
      [input.endpointId, input.outboxEventId, input.attempt, input.statusCode, input.nextRetryAt],
    );
  }

  async markOutboxPublished(id: string, at: string, attempts: number): Promise<void> {
    await this.sql.query(
      `update public.outbox_events
       set published_at = $2::timestamptz, attempts = $3::int
       where id = $1::uuid`,
      [id, at, attempts],
    );
  }

  async markOutboxRetry(id: string, attempts: number, nextRetryAt: string): Promise<void> {
    await this.sql.query(
      `update public.outbox_events set attempts = $2::int where id = $1::uuid and published_at is null`,
      [id, attempts],
    );
    void nextRetryAt;
  }

  async markOutboxDeadLetter(id: string, at: string, attempts: number): Promise<void> {
    await this.sql.query(
      `update public.outbox_events set attempts = $2::int where id = $1::uuid and published_at is null`,
      [id, attempts],
    );
    void at;
  }

  async getOutbox(id: string): Promise<OutboxRecord | null> {
    const result = await this.sql.query(
      `select id::text, organization_id::text, event_type, payload, created_at, published_at, attempts
       from public.outbox_events where id = $1::uuid`,
      [id],
    );
    const row = result.rows[0];
    if (!row || row.organization_id == null) return null;
    return {
      id: text(row.id),
      organizationId: text(row.organization_id),
      eventType: text(row.event_type),
      payload: asRecord(row.payload),
      createdAt: iso(row.created_at),
      attempts: numberValue(row.attempts),
      publishedAt: row.published_at == null ? null : iso(row.published_at),
      deadLetteredAt: null,
      nextRetryAt: null,
    };
  }

  private async fetchInvoice(
    client: SqlClient,
    organizationId: string,
    idOrPublicId: string,
  ): Promise<InvoiceRecord | null> {
    const result = await client.query(
      `${INVOICE_SQL}
       where i.organization_id = $1::uuid
         and (i.public_id = $2 or i.id::text = $2)
       order by p.created_at desc
       limit 1`,
      [organizationId, idOrPublicId],
    );
    const row = result.rows[0];
    return row ? mapInvoice(row) : null;
  }

  private mapWebhook(row: Record<string, unknown>, reason: string | null): WebhookRecord {
    return {
      id: text(row.id),
      provider: 'nowpayments',
      signatureValid: bool(row.signature_valid),
      headers: asRecord(row.headers) as Record<string, string>,
      payload: asJson(row.payload),
      dedupeKey: text(row.dedupe_key),
      receivedAt: iso(row.received_at),
      processedAt: row.processed_at == null ? null : iso(row.processed_at),
      reason,
    };
  }
}

function invalidAmount(value: string | null | undefined): boolean {
  if (value == null || value === '') return false;
  return !isDecimalString(value);
}

function mapInvoice(row: Record<string, unknown>): InvoiceRecord {
  return {
    id: text(row.id),
    organizationId: text(row.organization_id),
    publicId: text(row.public_id),
    number: text(row.number),
    priceAmount: trimNumeric(text(row.price_amount)),
    priceCurrency: text(row.price_currency),
    payCurrency: text(row.pay_currency ?? ''),
    payAmount: trimNumeric(text(row.pay_amount ?? '0')),
    payAddress: text(row.pay_address ?? ''),
    status: text(row.status) as InvoiceStatus,
    provider: 'mock',
    providerInvoiceId: text(row.provider_invoice_id ?? ''),
    providerPaymentId: text(row.provider_payment_id),
    paymentId: text(row.payment_id),
    orderId: text(row.order_id ?? ''),
    description: row.description == null ? null : text(row.description),
    checkoutUrl: text(row.checkout_url ?? ''),
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
    overpaid: bool(row.overpaid),
    latePaymentReview: bool(row.late_payment_review),
    actuallyPaid: row.actually_paid == null ? null : trimNumeric(text(row.actually_paid)),
    paymentStatus: text(row.payment_status) as PaymentStatus,
    rawStatus: text(row.raw_status),
    network: row.network == null ? null : text(row.network),
    merchantName: text(row.merchant_name),
  };
}

function trimNumeric(value: string): string {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return trimmed.length > 0 ? trimmed : '0';
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  throw new Error('Expected a scalar database value');
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  throw new Error('Expected a number');
}

function bool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 't' || value === 'true') return true;
  if (value === 'f' || value === 'false') return false;
  throw new Error('Expected a boolean');
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  throw new Error('Expected a timestamp');
}

function asJson(value: unknown): unknown {
  if (typeof value === 'string') return JSON.parse(value) as unknown;
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  const parsed = asJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => text(entry));
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const body = value.slice(1, -1);
    if (!body) return [];
    return body.split(',').map((part) => part.replace(/^"|"$/g, ''));
  }
  return [];
}
