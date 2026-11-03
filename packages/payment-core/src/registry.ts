import { isModeAEnabled, MODE_A_FEATURE_FLAG } from '@airexpay/configuration';
import type { ProviderMode } from '@airexpay/configuration';
import { MockProvider } from './mock-provider.ts';
import { NowPaymentsDirectProvider, NowPaymentsPlatformProvider } from './nowpayments-provider.ts';
import type { PaymentProvider } from './types.ts';
import { ProviderError } from './types.ts';

export interface ProviderSelection {
  mode: ProviderMode;
  allowedModes: readonly ProviderMode[];
  modeAEnv?: string | undefined;
}

/**
 * Refuses any mode absent from ALLOWED_MODES.
 * Never falls back to another provider.
 * Mode A also requires the compile-time flag.
 */
export function getProvider(selection: ProviderSelection): PaymentProvider {
  if (!selection.allowedModes.includes(selection.mode)) {
    throw new ProviderError(
      'auth',
      false,
      `Provider mode "${selection.mode}" is not in ALLOWED_MODES`,
    );
  }
  if (selection.mode === 'mock') {
    return new MockProvider();
  }
  if (selection.mode === 'nowpayments_direct') {
    return new NowPaymentsDirectProvider();
  }
  if (selection.mode === 'nowpayments_platform') {
    if (!MODE_A_FEATURE_FLAG || !isModeAEnabled(selection.modeAEnv)) {
      throw new ProviderError('auth', false, 'NOWPayments Mode A is disabled');
    }
    return new NowPaymentsPlatformProvider();
  }
  throw new ProviderError('unknown', false, `Unsupported provider mode "${selection.mode}"`);
}
