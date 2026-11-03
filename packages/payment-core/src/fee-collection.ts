import { MODE_A_FEATURE_FLAG } from '@airexpay/configuration';
import type { FeeSnapshot } from './pricing.ts';
import { sumMinor } from './pricing.ts';

export type FeeCollectionMode = 'merchant_usage' | 'platform_split';

/**
 * Mode A captures a fee from the customer payment only through a provider
 * platform-fee or split API. NOWPayments support for that split is not
 * verified. The strategy is unimplemented, and `MODE_A_FEATURE_FLAG` stays false.
 * This class must not move customer funds.
 */
export class PlatformSplitCollection {
  readonly mode = 'platform_split' as const;

  capture(): never {
    throw new Error(
      'Mode A platform fee split is unimplemented. NOWPayments platform-fee support is not verified, and MODE_A_FEATURE_FLAG is false.',
    );
  }
}

export interface UsageAccrual {
  invoiceId: string;
  organizationId: string;
  month: string;
  currency: string;
  minorScale: number;
  providerFee: string;
  margin: string;
  totalFee: string;
  networkFee: string;
  accruedAt: string;
}

export interface UsageCurrencyTotal {
  currency: string;
  minorScale: number;
  providerFee: string;
  margin: string;
  totalFee: string;
  networkFee: string;
  count: number;
}

export interface UsageStatement {
  organizationId: string;
  month: string;
  entries: UsageAccrual[];
  totals: UsageCurrencyTotal[];
}

export function usageMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid accrual time: ${iso}`);
  }
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

/**
 * Mode B. The fee accrues on a usage ledger and is invoiced to the merchant
 * for the UTC month. It is never deducted from customer funds.
 * Accrual happens once, when the invoice first becomes paid. Underpaid does not accrue.
 */
export class ModeBUsageLedger {
  readonly mode = 'merchant_usage' as const;
  private readonly entries = new Map<string, UsageAccrual>();

  accrue(input: {
    invoiceId: string;
    organizationId: string;
    status: string;
    paidAt: string;
    snapshot: FeeSnapshot | null | undefined;
  }): UsageAccrual | null {
    if (input.status !== 'paid') return null;
    const existing = this.entries.get(input.invoiceId);
    if (existing) return existing;
    if (!input.snapshot) return null;
    const entry: UsageAccrual = {
      invoiceId: input.invoiceId,
      organizationId: input.organizationId,
      month: usageMonth(input.paidAt),
      currency: input.snapshot.currency,
      minorScale: input.snapshot.minorScale,
      providerFee: input.snapshot.providerFee,
      margin: input.snapshot.margin,
      totalFee: input.snapshot.totalFee,
      networkFee: input.snapshot.networkFeeCharged,
      accruedAt: input.paidAt,
    };
    this.entries.set(input.invoiceId, entry);
    return entry;
  }

  entriesFor(organizationId: string): UsageAccrual[] {
    return [...this.entries.values()]
      .filter((entry) => entry.organizationId === organizationId)
      .map((entry) => ({ ...entry }))
      .sort(
        (left, right) =>
          left.accruedAt.localeCompare(right.accruedAt) ||
          left.invoiceId.localeCompare(right.invoiceId),
      );
  }

  statement(organizationId: string, month: string): UsageStatement {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error(`Invalid usage month: ${month}`);
    }
    const entries = this.entriesFor(organizationId).filter((entry) => entry.month === month);
    const grouped = new Map<string, UsageAccrual[]>();
    for (const entry of entries) {
      const rows = grouped.get(entry.currency) ?? [];
      rows.push(entry);
      grouped.set(entry.currency, rows);
    }
    const totals = [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, rows]) => {
        const scale = rows[0]?.minorScale ?? 0;
        if (rows.some((row) => row.minorScale !== scale)) {
          throw new Error(`Mixed minor scales for ${currency}`);
        }
        return {
          currency,
          minorScale: scale,
          providerFee: sumMinor(
            rows.map((row) => row.providerFee),
            scale,
          ),
          margin: sumMinor(
            rows.map((row) => row.margin),
            scale,
          ),
          totalFee: sumMinor(
            rows.map((row) => row.totalFee),
            scale,
          ),
          networkFee: sumMinor(
            rows.map((row) => row.networkFee),
            scale,
          ),
          count: rows.length,
        };
      });
    return { organizationId, month, entries, totals };
  }

  list(): UsageAccrual[] {
    return [...this.entries.values()].map((entry) => ({ ...entry }));
  }

  restore(entries: readonly UsageAccrual[]): void {
    this.entries.clear();
    for (const entry of entries) {
      this.entries.set(entry.invoiceId, { ...entry });
    }
  }
}

export interface FeeCollectionStrategy {
  readonly mode: FeeCollectionMode;
}

/**
 * The active strategy is Mode B. Mode A is not constructed.
 * A true compile-time flag still does not enable a split, because that path is unimplemented.
 */
export function selectFeeCollection(ledger: ModeBUsageLedger): ModeBUsageLedger {
  if (MODE_A_FEATURE_FLAG !== false) {
    throw new Error(
      'Mode A platform fee split is unimplemented. Refusing to collect a fee from customer funds.',
    );
  }
  return ledger;
}
