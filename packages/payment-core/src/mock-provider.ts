import { divideDecimal, newPublicId } from '@airexpay/shared';
import type { PaymentStatus } from '@airexpay/shared';
import { signNowPaymentsBody, verifyNowPaymentsSignature, webhookDedupeKey } from './hmac.ts';
import type {
  CreateInvoiceInput,
  PaymentProvider,
  ProviderContext,
  ProviderInvoice,
  ProviderPayment,
  WebhookVerification,
} from './types.ts';
import { ProviderError } from './types.ts';

export const MOCK_SCENARIOS = [
  'success',
  'partially_paid',
  'failed',
  'expired',
  'refunded',
  'late_payment',
  'overpaid',
] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const USD_RATES: Record<string, string> = {
  btc: '50000',
  eth: '3000',
  usdt: '1',
  usdc: '1',
};

const NETWORKS: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  usdt: 'ethereum',
  usdc: 'ethereum',
};

const SEQUENCES: Record<MockScenario, PaymentStatus[]> = {
  success: ['confirming', 'finished'],
  partially_paid: ['partially_paid'],
  failed: ['failed'],
  expired: ['expired'],
  refunded: ['finished', 'refunded'],
  late_payment: ['expired', 'finished'],
  overpaid: ['finished'],
};

interface MockRecord {
  providerPaymentId: string;
  providerInvoiceId: string;
  orderId: string;
  priceAmount: string;
  priceCurrency: string;
  payAmount: string;
  payCurrency: string;
  payAddress: string;
  scenario: MockScenario;
  step: number;
  status: PaymentStatus;
}

function parseScenario(description: string | undefined): MockScenario {
  if (!description) return 'success';
  const match = /^scenario:([a-z_]+)/.exec(description.trim());
  const name = match?.[1];
  if (name && (MOCK_SCENARIOS as readonly string[]).includes(name)) {
    return name as MockScenario;
  }
  return 'success';
}

function simulatedAddress(currency: string, paymentId: string): string {
  const suffix = paymentId.replace(/[^a-z0-9]/gi, '').slice(0, 24);
  if (currency === 'eth' || currency === 'usdt' || currency === 'usdc') {
    return `0xsim${suffix.padEnd(36, '0')}`;
  }
  return `tb1qsim${suffix}`;
}

export class MockProvider implements PaymentProvider {
  readonly id = 'mock' as const;
  private readonly payments = new Map<string, MockRecord>();

  normalizeStatus(raw: string): ProviderPayment['status'] {
    const known: PaymentStatus[] = [
      'waiting',
      'confirming',
      'confirmed',
      'sending',
      'partially_paid',
      'finished',
      'failed',
      'refunded',
      'expired',
    ];
    return (known as string[]).includes(raw) ? (raw as PaymentStatus) : 'unknown';
  }

  async listCurrencies(): Promise<{ code: string; network?: string; name?: string }[]> {
    return [
      { code: 'btc', network: 'bitcoin', name: 'Bitcoin' },
      { code: 'eth', network: 'ethereum', name: 'Ether' },
      { code: 'usdt', network: 'ethereum', name: 'Tether' },
      { code: 'usdc', network: 'ethereum', name: 'USD Coin' },
    ];
  }

  async minAmount(): Promise<string> {
    return '0.00002';
  }

  async estimate(ctx: ProviderContext, amount: string, from: string, to: string): Promise<string> {
    void ctx;
    if (from.toLowerCase() !== 'usd') {
      throw new ProviderError('validation', false, 'Mock provider estimates from USD only');
    }
    return quote(amount, to);
  }

  async createInvoice(ctx: ProviderContext, input: CreateInvoiceInput): Promise<ProviderInvoice> {
    const payment = await this.createPayment(ctx, {
      ...input,
      payCurrency: input.payCurrency ?? 'btc',
    });
    const record = this.payments.get(payment.providerPaymentId);
    return {
      providerInvoiceId: record?.providerInvoiceId ?? newPublicId('mockinv'),
      hostedUrl: undefined,
      raw: { payment_id: payment.providerPaymentId, simulated: true },
    };
  }

  async createPayment(
    ctx: ProviderContext,
    input: CreateInvoiceInput & { payCurrency: string },
  ): Promise<ProviderPayment> {
    void ctx;
    const payCurrency = input.payCurrency.toLowerCase();
    const payAmount = quote(input.priceAmount, payCurrency);
    const providerPaymentId = newPublicId('mockpay');
    const providerInvoiceId = newPublicId('mockinv');
    const record: MockRecord = {
      providerPaymentId,
      providerInvoiceId,
      orderId: input.orderId,
      priceAmount: input.priceAmount,
      priceCurrency: input.priceCurrency.toLowerCase(),
      payAmount,
      payCurrency,
      payAddress: simulatedAddress(payCurrency, providerPaymentId),
      scenario: parseScenario(input.description),
      step: 0,
      status: 'waiting',
    };
    this.payments.set(providerPaymentId, record);
    return this.toPayment(record, 'waiting', record.payAmount);
  }

  async getPayment(ctx: ProviderContext, providerPaymentId: string): Promise<ProviderPayment> {
    void ctx;
    const record = this.payments.get(providerPaymentId);
    if (!record) {
      throw new ProviderError('validation', false, 'Unknown mock payment');
    }
    return this.toPayment(record, record.status, actuallyPaidFor(record, record.status));
  }

  async simulateIpn(
    ctx: ProviderContext,
    providerPaymentId: string,
  ): Promise<{ rawBody: string; signature: string; payment: ProviderPayment }> {
    const record = this.payments.get(providerPaymentId);
    if (!record) {
      throw new ProviderError('validation', false, 'Unknown mock payment');
    }
    const sequence = SEQUENCES[record.scenario];
    const next = sequence[record.step];
    if (!next) {
      throw new ProviderError('validation', false, 'Mock scenario has no further IPNs');
    }
    record.step += 1;
    record.status = next;
    const actuallyPaid = actuallyPaidFor(record, next);
    const body = {
      payment_id: record.providerPaymentId,
      invoice_id: record.providerInvoiceId,
      payment_status: next,
      order_id: record.orderId,
      price_amount: record.priceAmount,
      price_currency: record.priceCurrency,
      pay_amount: record.payAmount,
      actually_paid: actuallyPaid,
      pay_currency: record.payCurrency,
      pay_address: record.payAddress,
      simulated: true,
    };
    const signed = await signNowPaymentsBody(body, ctx.credentials.ipnSecret);
    return {
      rawBody: signed.rawBody,
      signature: signed.signature,
      payment: this.toPayment(record, next, actuallyPaid),
    };
  }

  async verifyWebhook(
    ctx: ProviderContext,
    headers: Headers,
    rawBody: string,
  ): Promise<WebhookVerification> {
    const check = await verifyNowPaymentsSignature(
      rawBody,
      headers.get('x-nowpayments-sig'),
      ctx.credentials.ipnSecret,
    );
    if (!check.valid || !check.parsed || typeof check.parsed !== 'object') {
      return { valid: false, reason: check.reason ?? 'invalid' };
    }
    const payload = check.parsed as Record<string, unknown>;
    const rawStatus = typeof payload.payment_status === 'string' ? payload.payment_status : '';
    const providerPaymentId = String(payload.payment_id ?? '');
    const payment: ProviderPayment = {
      providerPaymentId,
      status: this.normalizeStatus(rawStatus),
      rawStatus,
      ...(typeof payload.pay_address === 'string' ? { payAddress: payload.pay_address } : {}),
      ...(typeof payload.pay_amount === 'string' ? { payAmount: payload.pay_amount } : {}),
      ...(typeof payload.pay_currency === 'string' ? { payCurrency: payload.pay_currency } : {}),
      ...(typeof payload.actually_paid === 'string' ? { actuallyPaid: payload.actually_paid } : {}),
      ...(typeof payload.order_id === 'string' ? { orderId: payload.order_id } : {}),
      raw: payload,
    };
    return {
      valid: true,
      payment,
      dedupeKey: await webhookDedupeKey('mock', rawBody),
    };
  }

  private toPayment(
    record: MockRecord,
    status: PaymentStatus,
    actuallyPaid: string,
  ): ProviderPayment {
    return {
      providerPaymentId: record.providerPaymentId,
      status,
      rawStatus: status,
      payAddress: record.payAddress,
      payAmount: record.payAmount,
      payCurrency: record.payCurrency,
      actuallyPaid,
      orderId: record.orderId,
      updatedAt: new Date().toISOString(),
      raw: {
        simulated: true,
        network: NETWORKS[record.payCurrency] ?? 'unknown',
        invoice_id: record.providerInvoiceId,
      },
    };
  }
}

function quote(priceAmount: string, payCurrency: string): string {
  const rate = USD_RATES[payCurrency.toLowerCase()];
  if (!rate) {
    throw new ProviderError('validation', false, `Unsupported mock currency: ${payCurrency}`);
  }
  return divideDecimal(priceAmount, rate, 8);
}

function actuallyPaidFor(record: MockRecord, status: PaymentStatus): string {
  if (record.scenario === 'overpaid' && status === 'finished') {
    return divideDecimal(record.payAmount, '0.5', 8);
  }
  if (status === 'partially_paid') {
    return divideDecimal(record.payAmount, '2', 8);
  }
  if (status === 'waiting' || status === 'expired' || status === 'failed') {
    return '0';
  }
  return record.payAmount;
}
