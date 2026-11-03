# System Architecture

```
Merchant / Payer
   │
apps/web (React+TS+Vite+Tailwind+shadcn)  ── static assets on Cloudflare Workers
   │ HTTPS (session JWT from Supabase Auth)
apps/api (Cloudflare Worker, Hono)
   ├─ auth/tenant middleware ─ Supabase Postgres (RLS, source of truth)
   ├─ invoice / link / payment services
   ├─ packages/payment-core ─ Provider adapter ─ NOWPayments | Mock | (Stripe/BitPay later)
   ├─ POST /v1/webhooks/nowpayments ─ verify → store → ack
   └─ outbox_events → Cloudflare Queue consumer → n8n → Resend / Intercom / PostHog
```

Boundaries: browser never calls providers; only the API Worker holds provider credentials (Workers secrets / encrypted DB column). n8n never decides payment state. Provider is source of truth for external status; DB is source of truth for app state.

## packages/payment-core — provider adapter interface

```ts
export type ProviderMode =
  'mock' | 'nowpayments_platform' /* Mode A */ | 'nowpayments_direct'; /* Mode B */
export type Money = string; // decimal string, never number
export type NormalizedStatus =
  | 'waiting'
  | 'confirming'
  | 'confirmed'
  | 'sending'
  | 'partially_paid'
  | 'finished'
  | 'failed'
  | 'refunded'
  | 'expired'
  | 'unknown';

export interface ProviderContext {
  organizationId: string;
  connectionId: string; // processor_connections.id
  mode: ProviderMode;
  credentials: { apiKey: string; ipnSecret: string; subPartnerId?: string }; // decrypted server-side only
  sandbox: boolean;
}
export interface CreateInvoiceInput {
  priceAmount: Money;
  priceCurrency: string;
  payCurrency?: string;
  orderId: string;
  description?: string;
  callbackUrl: string;
  successUrl?: string;
  cancelUrl?: string;
  fixedRate?: boolean;
  feePaidByUser?: boolean;
}
export interface ProviderInvoice {
  providerInvoiceId: string;
  hostedUrl?: string;
  raw: unknown;
}
export interface ProviderPayment {
  providerPaymentId: string;
  status: NormalizedStatus;
  rawStatus: string;
  payAddress?: string;
  payAmount?: Money;
  payCurrency?: string;
  actuallyPaid?: Money;
  outcomeAmount?: Money;
  orderId?: string;
  updatedAt?: string;
  raw: unknown;
}
export interface WebhookVerification {
  valid: boolean;
  payment?: ProviderPayment;
  dedupeKey?: string;
  reason?: string;
}

export interface PaymentProvider {
  readonly id: 'nowpayments' | 'mock';
  listCurrencies(
    ctx: ProviderContext,
  ): Promise<{ code: string; network?: string; name?: string }[]>;
  minAmount(ctx: ProviderContext, from: string, to: string): Promise<Money>;
  estimate(ctx: ProviderContext, amount: Money, from: string, to: string): Promise<Money>;
  createInvoice(ctx: ProviderContext, input: CreateInvoiceInput): Promise<ProviderInvoice>;
  createPayment(
    ctx: ProviderContext,
    input: CreateInvoiceInput & { payCurrency: string },
  ): Promise<ProviderPayment>;
  getPayment(ctx: ProviderContext, providerPaymentId: string): Promise<ProviderPayment>;
  verifyWebhook(
    ctx: ProviderContext,
    headers: Headers,
    rawBody: string,
  ): Promise<WebhookVerification>;
  normalizeStatus(raw: string): NormalizedStatus;
}
export class ProviderError extends Error {
  constructor(
    public code: 'timeout' | 'rate_limited' | 'auth' | 'validation' | 'unavailable' | 'unknown',
    public retryable: boolean,
    msg: string,
  ) {
    super(msg);
  }
}
```

Implementations:

- `MockProvider` — deterministic scenarios (`success`, `partially_paid`, `failed`, `expired`, `refunded`, `late_payment`, `overpaid`) emitting signed fake IPNs; default in all environments until approval.
- `NowPaymentsDirectProvider` (Mode B) — each merchant's own API key + IPN secret from `processor_connections`; IPN routed by `/v1/webhooks/nowpayments/{connectionId}` to select the secret.
- `NowPaymentsPlatformProvider` (Mode A) — only enabled by a feature flag after written approval; uses sub-partner ids for attribution. Disabled by default.
- Registry `getProvider(connection)` refuses modes not in `ALLOWED_MODES` env; switching mode is an audited admin action — never silent fallback.
  Timeouts 10 s, retries only for idempotent GETs, rate limiter 3 RPS create / 7 RPS estimate per key.
