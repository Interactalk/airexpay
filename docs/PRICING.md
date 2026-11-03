# Pricing

Updated: 2026-11-03 (Asia/Dhaka, UTC+6).

Owner rule: the AirExpay fee equals the configured provider cost times 1.5. That is a 50% margin on provider cost. The total fee is what the merchant is invoiced. The margin is the difference between that total and the provider cost.

The owner set the NOWPayments cost in config to **1.5%** (`providerFeeRate` `0.015`). With `marginMultiplier` `1.5`:

| Invoice    | Provider fee | AirExpay margin | Total merchant fee |
| ---------- | ------------ | --------------- | ------------------ |
| 100.00 USD | 1.50         | 0.75            | 2.25               |

Those amounts are 1.5%, 0.75%, and 2.25% of the invoice. They are the result of the config, not a separate price list.

TODO: recheck the 1.5% provider rate against NOWPayments' official pricing before go-live, including any conversion fee. `packages/configuration/src/pricing.ts` is simulation config. It is not a verification of NOWPayments' price, and it is not a published AirExpay price.

The public pricing page stays a placeholder with no amounts until the owner approves public pricing.

## Plan versions

Plans are versioned with `effectiveFrom` (inclusive) and `effectiveTo` (exclusive). A quote stores the version that was effective at that instant. The open plan, version 2 from 2026-11-01, uses provider rate `0.015` and margin multiplier `1.5`.

## Rounding

Half away from zero, to the fee currency's minor scale (2 for USD and the example stablecoins, 8 for BTC, otherwise the plan's `minorScale`).

All math uses integers:

1. Parse the price and the rate as integers at their own decimal lengths.
2. Multiply.
3. Round half away from zero to the minor scale. A remainder that is exactly half of the dropped unit rounds away from zero. `0.005` at two places becomes `0.01`. `1.005` becomes `1.01`.
4. Multiply that provider fee by `marginMultiplier` (`1.5` on every configured plan) and round the same way. That product is the total AirExpay fee.
5. Margin = total fee − provider fee, exact in minor units.

JavaScript floating point is not used. On 100.00 USD the default config divides evenly, so no rounding changes 1.50, 0.75, or 2.25.

## Network fees

Network fees are stored separately. They are not multiplied by 1.5 unless the plan sets `markupNetworkFee`. Both simulation plans set that flag false, so a network fee is passed through after the same half-away rounding to the minor scale.

## Collection

Mode B (direct merchant): when an invoice first becomes paid, which is only payment status `finished`, the fee snapshot is appended to a usage ledger for that UTC month. The merchant is invoiced for the month. AirExpay does not deduct the fee from customer funds. An underpaid invoice does not accrue. A second `finished` event does not add a second line. This preview does not remove the line if the payment is later refunded.

Mode A (platform): a fee would be captured only through a provider-supported platform fee or split. NOWPayments support for that split is not verified. `PlatformSplitCollection` is unimplemented, it is not selected, and `MODE_A_FEATURE_FLAG` stays false.

There is no custody, balance, or withdrawal.

## Invoice snapshot

Each invoice created through `POST /v1/invoices` stores the plan id, version, effective time, configured rate, multiplier, provider fee, margin, total fee, and network fee. The merchant invoice JSON includes that snapshot. The public checkout JSON does not.

The snapshot and the usage ledger live in the in-memory store and in the Durable Object JSON snapshot. They are not a hosted SQL column. This change does not add or apply a migration. A Postgres repository used in tests keeps the same fields in process memory only.
