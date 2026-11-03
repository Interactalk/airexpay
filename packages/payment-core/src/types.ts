import type { ProviderMode } from '@airexpay/configuration';
import type { PaymentStatus } from '@airexpay/shared';

export type Money = string;
export type NormalizedStatus = PaymentStatus | 'unknown';

export interface ProviderContext {
  organizationId: string;
  connectionId: string;
  mode: ProviderMode;
  credentials: { apiKey: string; ipnSecret: string; subPartnerId?: string };
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
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
