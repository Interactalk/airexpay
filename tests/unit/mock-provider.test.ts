import { SIMULATION_IPN_SECRET, SIMULATION_ORG_IDS } from '@airexpay/configuration';
import {
  MockProvider,
  NowPaymentsDirectProvider,
  NowPaymentsPlatformProvider,
  getProvider,
  type ProviderContext,
} from '@airexpay/payment-core';
import { compareDecimal } from '@airexpay/shared';
import { describe, expect, it, vi } from 'vitest';

function context(): ProviderContext {
  return {
    organizationId: SIMULATION_ORG_IDS.alpha,
    connectionId: 'sim_conn_mock',
    mode: 'mock',
    credentials: { apiKey: 'simulation', ipnSecret: SIMULATION_IPN_SECRET },
    sandbox: true,
  };
}

describe('mock provider', () => {
  it('does not call the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network disabled'));
    const provider = new MockProvider();
    const payment = await provider.createPayment(context(), {
      priceAmount: '50.00',
      priceCurrency: 'USD',
      payCurrency: 'btc',
      orderId: 'ord_net',
      callbackUrl: '/api/webhooks/nowpayments',
    });
    expect(payment.status).toBe('waiting');
    expect(payment.payAddress).toContain('tb1qsim');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it.each([
    ['success', ['confirming', 'finished']],
    ['partially_paid', ['partially_paid']],
    ['failed', ['failed']],
    ['expired', ['expired']],
  ] as const)('simulates a signed %s IPN flow', async (scenario, statuses) => {
    const provider = new MockProvider();
    const ctx = context();
    const created = await provider.createPayment(ctx, {
      priceAmount: '50.00',
      priceCurrency: 'USD',
      payCurrency: 'btc',
      orderId: `ord_${scenario}`,
      description: `scenario:${scenario}`,
      callbackUrl: '/api/webhooks/nowpayments',
    });
    expect(created.status).toBe('waiting');
    for (const expected of statuses) {
      const ipn = await provider.simulateIpn(ctx, created.providerPaymentId);
      expect(ipn.payment.status).toBe(expected);
      const headers = new Headers({ 'x-nowpayments-sig': ipn.signature });
      const verified = await provider.verifyWebhook(ctx, headers, ipn.rawBody);
      expect(verified.valid).toBe(true);
      expect(verified.payment?.status).toBe(expected);
      expect(verified.payment?.rawStatus).toBe(expected);
    }
  });

  it('rejects a tampered mock IPN', async () => {
    const provider = new MockProvider();
    const ctx = context();
    const created = await provider.createPayment(ctx, {
      priceAmount: '10.00',
      priceCurrency: 'USD',
      payCurrency: 'btc',
      orderId: 'ord_tamper',
      description: 'scenario:failed',
      callbackUrl: '/api/webhooks/nowpayments',
    });
    const ipn = await provider.simulateIpn(ctx, created.providerPaymentId);
    const tampered = ipn.rawBody.replace('failed', 'finished');
    const headers = new Headers({ 'x-nowpayments-sig': ipn.signature });
    const verified = await provider.verifyWebhook(ctx, headers, tampered);
    expect(verified.valid).toBe(false);
  });

  it('marks an overpaid finished simulation with actually_paid above pay_amount', async () => {
    const provider = new MockProvider();
    const ctx = context();
    const created = await provider.createPayment(ctx, {
      priceAmount: '25.00',
      priceCurrency: 'USD',
      payCurrency: 'btc',
      orderId: 'ord_over',
      description: 'scenario:overpaid',
      callbackUrl: '/api/webhooks/nowpayments',
    });
    const ipn = await provider.simulateIpn(ctx, created.providerPaymentId);
    expect(ipn.payment.status).toBe('finished');
    expect(compareDecimal(ipn.payment.actuallyPaid ?? '0', ipn.payment.payAmount ?? '0')).toBe(1);
  });
});

describe('provider registry', () => {
  it('returns the mock provider and refuses unlisted modes', () => {
    expect(getProvider({ mode: 'mock', allowedModes: ['mock'] }).id).toBe('mock');
    expect(() => getProvider({ mode: 'nowpayments_direct', allowedModes: ['mock'] })).toThrow(
      /not in ALLOWED_MODES/,
    );
  });

  it('keeps Mode A disabled even if the environment asks for it', () => {
    expect(() =>
      getProvider({
        mode: 'nowpayments_platform',
        allowedModes: ['mock', 'nowpayments_platform'],
        modeAEnv: 'true',
      }),
    ).toThrow(/Mode A is disabled/);
    expect(() => new NowPaymentsPlatformProvider()).toThrow(/Mode A/);
  });

  it('builds a direct provider skeleton that verifies IPNs and does not call out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network disabled'));
    const provider = new NowPaymentsDirectProvider();
    await expect(provider.createInvoice()).rejects.toThrow(/disabled/);
    await expect(provider.getPayment()).rejects.toThrow(/disabled/);
    const { signNowPaymentsBody } = await import('@airexpay/payment-core');
    const signed = await signNowPaymentsBody(
      { payment_id: 55, payment_status: 'partially_paid', actually_paid: '0.1', pay_amount: '0.2' },
      'simulation-ipn-secret',
    );
    const verified = await provider.verifyWebhook(
      { ...context(), mode: 'nowpayments_direct' },
      new Headers({ 'x-nowpayments-sig': signed.signature }),
      signed.rawBody,
    );
    expect(verified.valid).toBe(true);
    expect(verified.payment?.status).toBe('partially_paid');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
