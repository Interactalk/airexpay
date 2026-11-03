/**
 * Provider fee rates are configuration for the simulation.
 * They are not a verified NOWPayments price and they are not public pricing.
 *
 * The owner set the NOWPayments cost used here to 1.5% (`0.015`).
 * TODO: recheck this rate against NOWPayments' official pricing before go-live,
 * including any conversion fee. Do not treat `providerFeeRate` as that verification.
 *
 * AirExpay fee = provider cost × marginMultiplier. With multiplier 1.5 the margin
 * is half of the provider cost (0.75% of the invoice) and the total merchant fee
 * is 2.25% of the invoice.
 */
export interface PricingPlanConfig {
  id: string;
  version: number;
  /** Inclusive ISO-8601 instant. */
  effectiveFrom: string;
  /** Exclusive ISO-8601 instant. Null means the version is still open. */
  effectiveTo: string | null;
  /** Decimal string. Not a floating-point number and not a published rate. */
  providerFeeRate: string;
  /** Decimal string. The owner rule is 1.5 (provider cost plus a 50% margin). */
  marginMultiplier: string;
  /** Network fees stay a pass-through unless this is true. */
  markupNetworkFee: boolean;
  /** Minor digits used when a currency has no entry of its own. USD-like prices use 2. */
  minorScale: number;
}

/** Owner-supplied NOWPayments cost. Config only; recheck the official price before go-live. */
export const DEFAULT_PROVIDER_FEE_RATE = '0.015';

/** 50% margin on provider cost. The total merchant fee is provider cost × this value. */
export const DEFAULT_MARGIN_MULTIPLIER = '1.5';

export const PRICING_PLANS: readonly PricingPlanConfig[] = [
  {
    id: 'simulation',
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: '2026-11-01T00:00:00.000Z',
    providerFeeRate: '0.010',
    marginMultiplier: DEFAULT_MARGIN_MULTIPLIER,
    markupNetworkFee: false,
    minorScale: 2,
  },
  {
    id: 'simulation',
    version: 2,
    effectiveFrom: '2026-11-01T00:00:00.000Z',
    effectiveTo: null,
    providerFeeRate: DEFAULT_PROVIDER_FEE_RATE,
    marginMultiplier: DEFAULT_MARGIN_MULTIPLIER,
    markupNetworkFee: false,
    minorScale: 2,
  },
];
