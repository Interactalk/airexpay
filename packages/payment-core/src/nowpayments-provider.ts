import { isModeAEnabled } from '@airexpay/configuration';
import type { PaymentStatus } from '@airexpay/shared';
import { decimalFromProviderValue } from './amounts.ts';
import { verifyNowPaymentsSignature, webhookDedupeKey } from './hmac.ts';
import type {
  NormalizedStatus,
  PaymentProvider,
  ProviderContext,
  ProviderInvoice,
  ProviderPayment,
  WebhookVerification,
} from './types.ts';
import { ProviderError } from './types.ts';

const LIVE_DISABLED =
  'NOWPayments live calls are disabled. Simulation mode is the only authorized path.';

/**
 * Skeleton for NOWPayments Mode B (direct) and shared IPN verification.
 * No network I/O. Mode A is a separate subclass that refuses to construct.
 */
export class NowPaymentsProvider implements PaymentProvider {
  readonly id = 'nowpayments' as const;

  constructor(readonly mode: 'nowpayments_direct' | 'nowpayments_platform') {}

  normalizeStatus(raw: string): NormalizedStatus {
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
    throw new ProviderError('unavailable', false, LIVE_DISABLED);
  }

  async minAmount(): Promise<string> {
    throw new ProviderError('unavailable', false, LIVE_DISABLED);
  }

  async estimate(): Promise<string> {
    throw new ProviderError('unavailable', false, LIVE_DISABLED);
  }

  async createInvoice(): Promise<ProviderInvoice> {
    throw new ProviderError('unavailable', false, LIVE_DISABLED);
  }

  async createPayment(): Promise<ProviderPayment> {
    throw new ProviderError('unavailable', false, LIVE_DISABLED);
  }

  async getPayment(): Promise<ProviderPayment> {
    throw new ProviderError('unavailable', false, LIVE_DISABLED);
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
    const status = this.normalizeStatus(rawStatus);
    const payAmount = decimalFromProviderValue(payload.pay_amount);
    const actuallyPaid = decimalFromProviderValue(payload.actually_paid);
    const payment: ProviderPayment = {
      providerPaymentId: String(payload.payment_id ?? ''),
      status,
      rawStatus,
      ...(typeof payload.pay_address === 'string' ? { payAddress: payload.pay_address } : {}),
      ...(payAmount ? { payAmount } : {}),
      ...(typeof payload.pay_currency === 'string' ? { payCurrency: payload.pay_currency } : {}),
      ...(actuallyPaid ? { actuallyPaid } : {}),
      ...(typeof payload.order_id === 'string' ? { orderId: payload.order_id } : {}),
      raw: payload,
    };
    return {
      valid: true,
      payment,
      dedupeKey: await webhookDedupeKey('nowpayments', rawBody),
    };
  }
}

export class NowPaymentsDirectProvider extends NowPaymentsProvider {
  constructor() {
    super('nowpayments_direct');
  }
}

/** Mode A (platform / sub-partner). Construction fails while the feature flag is off. */
export class NowPaymentsPlatformProvider extends NowPaymentsProvider {
  constructor() {
    super('nowpayments_platform');
    if (!isModeAEnabled('true')) {
      throw new ProviderError(
        'auth',
        false,
        'NOWPayments Mode A (platform) is disabled until written approval',
      );
    }
  }
}
