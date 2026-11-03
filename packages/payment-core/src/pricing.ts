import { PRICING_PLANS, type PricingPlanConfig } from '@airexpay/configuration';
import { isDecimalString, parseDecimal } from '@airexpay/shared';

export type PricingPlan = PricingPlanConfig;

/**
 * Rounding direction: half away from zero, after the multiply, to the fee
 * currency's minor scale.
 *
 * Amounts and rates are parsed to integers at their own decimal lengths and
 * multiplied with bigint. A remainder that is exactly half of the dropped unit
 * rounds away from zero (1.005 at two places becomes 1.01; 0.005 becomes 0.01).
 * JavaScript floating point is not used.
 *
 * Order, so the 1.5× rule applies to the provider cost:
 * 1. providerFee = round(price × providerFeeRate)
 * 2. totalFee = round(providerFee × marginMultiplier)
 * 3. margin = totalFee − providerFee, exact in minor units
 *
 * With the default config (provider cost 1.5%, multiplier 1.5) a 100.00 USD
 * invoice is provider fee 1.50, margin 0.75, total fee 2.25.
 *
 * Network fees are not part of that product. They are rounded to the same
 * minor scale and passed through, unless the plan sets markupNetworkFee.
 */
export interface FeeSnapshot {
  planId: string;
  planVersion: number;
  effectiveFrom: string;
  quotedAt: string;
  providerFeeRate: string;
  marginMultiplier: string;
  providerFee: string;
  margin: string;
  totalFee: string;
  networkFee: string;
  networkFeeCharged: string;
  networkFeeMarkedUp: boolean;
  currency: string;
  minorScale: number;
  priceAmount: string;
  rounding: 'half_away_from_zero';
}

const MINOR_SCALE_BY_CURRENCY: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  USDC: 2,
  USDT: 2,
  USDP: 2,
  DAI: 2,
  BTC: 8,
};

export function roundHalfAway(value: bigint, fromScale: number, toScale: number): bigint {
  if (!Number.isInteger(fromScale) || !Number.isInteger(toScale) || fromScale < 0 || toScale < 0) {
    throw new Error('Decimal scales must be non-negative integers');
  }
  if (toScale >= fromScale) {
    return value * 10n ** BigInt(toScale - fromScale);
  }
  return divideHalfAway(value, 10n ** BigInt(fromScale - toScale));
}

function divideHalfAway(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error('Divisor must be positive');
  }
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const roundAway = remainder * 2n >= denominator;
  const rounded = roundAway ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export function formatMinor(value: bigint, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new Error('Minor scale must be an integer from 0 to 18');
  }
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(scale);
  const whole = absolute / base;
  if (scale === 0) {
    return negative ? `-${whole.toString()}` : whole.toString();
  }
  const fraction = (absolute % base).toString().padStart(scale, '0');
  const body = `${whole.toString()}.${fraction}`;
  return negative ? `-${body}` : body;
}

export function sumMinor(values: readonly string[], scale: number): string {
  let total = 0n;
  for (const value of values) {
    total += parseDecimal(value, scale);
  }
  return formatMinor(total, scale);
}

function decimalPlaces(value: string): number {
  if (!isDecimalString(value)) {
    throw new Error(`Invalid decimal amount: ${value}`);
  }
  return value.split('.')[1]?.length ?? 0;
}

function multiplyHalfAway(left: string, right: string, toScale: number): string {
  const leftScale = decimalPlaces(left);
  const rightScale = decimalPlaces(right);
  const product = parseDecimal(left, leftScale) * parseDecimal(right, rightScale);
  return formatMinor(roundHalfAway(product, leftScale + rightScale, toScale), toScale);
}

function minorScaleFor(currency: string, planScale: number): number {
  return MINOR_SCALE_BY_CURRENCY[currency] ?? planScale;
}

export function selectPlan(plans: readonly PricingPlan[], at: string): PricingPlan {
  const instant = Date.parse(at);
  if (Number.isNaN(instant)) {
    throw new Error(`Invalid pricing instant: ${at}`);
  }
  const matches = plans.filter((plan) => {
    const from = Date.parse(plan.effectiveFrom);
    const to = plan.effectiveTo == null ? Number.POSITIVE_INFINITY : Date.parse(plan.effectiveTo);
    if (Number.isNaN(from) || Number.isNaN(to)) {
      throw new Error(`Pricing plan ${plan.id} v${plan.version} has an invalid effective date`);
    }
    return from <= instant && instant < to;
  });
  if (matches.length === 0) {
    throw new Error(`No pricing plan is effective at ${at}`);
  }
  matches.sort((left, right) => {
    const from = Date.parse(left.effectiveFrom) - Date.parse(right.effectiveFrom);
    if (from !== 0) return from;
    return left.version - right.version;
  });
  const selected = matches[matches.length - 1];
  if (!selected) {
    throw new Error(`No pricing plan is effective at ${at}`);
  }
  return selected;
}

export function quoteFee(input: {
  plans: readonly PricingPlan[];
  at: string;
  priceAmount: string;
  currency: string;
  networkFee?: string;
}): FeeSnapshot {
  const plan = selectPlan(input.plans, input.at);
  if (!Number.isInteger(plan.minorScale) || plan.minorScale < 0 || plan.minorScale > 18) {
    throw new Error(`Pricing plan ${plan.id} v${plan.version} has an invalid minor scale`);
  }
  if (!isDecimalString(plan.providerFeeRate) || !isDecimalString(plan.marginMultiplier)) {
    throw new Error(`Pricing plan ${plan.id} v${plan.version} has a non-decimal rate`);
  }
  if (parseDecimal(plan.marginMultiplier) <= 0n) {
    throw new Error(`Pricing plan ${plan.id} v${plan.version} has a non-positive margin`);
  }
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(currency)) {
    throw new Error(`Invalid fee currency: ${input.currency}`);
  }
  const scale = minorScaleFor(currency, plan.minorScale);
  const networkFee = input.networkFee ?? '0';
  const providerFee = multiplyHalfAway(input.priceAmount, plan.providerFeeRate, scale);
  const totalFee = multiplyHalfAway(providerFee, plan.marginMultiplier, scale);
  const margin = formatMinor(
    parseDecimal(totalFee, scale) - parseDecimal(providerFee, scale),
    scale,
  );
  const networkFeeCharged = plan.markupNetworkFee
    ? multiplyHalfAway(networkFee, plan.marginMultiplier, scale)
    : multiplyHalfAway(networkFee, '1', scale);
  return {
    planId: plan.id,
    planVersion: plan.version,
    effectiveFrom: plan.effectiveFrom,
    quotedAt: input.at,
    providerFeeRate: plan.providerFeeRate,
    marginMultiplier: plan.marginMultiplier,
    providerFee,
    margin,
    totalFee,
    networkFee: multiplyHalfAway(networkFee, '1', scale),
    networkFeeCharged,
    networkFeeMarkedUp: plan.markupNetworkFee,
    currency,
    minorScale: scale,
    priceAmount: multiplyHalfAway(input.priceAmount, '1', decimalPlaces(input.priceAmount)),
    rounding: 'half_away_from_zero',
  };
}

/** Quote against the configured simulation plans. The rate is config, not a verified provider price. */
export function quoteConfiguredFee(input: {
  at: string;
  priceAmount: string;
  currency: string;
  networkFee?: string;
}): FeeSnapshot {
  return quoteFee({ ...input, plans: PRICING_PLANS });
}
