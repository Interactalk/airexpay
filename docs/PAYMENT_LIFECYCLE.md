# Payment Lifecycle

Provider statuses (verified, NOWPayments sandbox docs): waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired.

| From             | Allowed to                                                        |
| ---------------- | ----------------------------------------------------------------- |
| (new)            | waiting                                                           |
| waiting          | confirming, expired, failed, partially_paid, finished             |
| confirming       | confirmed, sending, partially_paid, finished, failed              |
| confirmed        | sending, partially_paid, finished, failed                         |
| sending          | finished, partially_paid, failed                                  |
| partially_paid   | finished (if provider later reports full), refunded, failed       |
| finished         | refunded                                                          |
| expired          | partially_paid / finished (late payment → flag for manual review) |
| failed, refunded | terminal                                                          |

Rules:

- **Only `finished` sets invoice `paid` and emits `payment.finished` (fulfillment).**
- `partially_paid` → invoice `underpaid`, `payment.partially_paid` event, never auto-fulfilled (NOWPayments ToS §12.9).
- Duplicate (same dedupe key) → no-op 200. Unknown status → stored, flagged, not applied. Backward transitions rejected and logged.
- Overpayment: actually_paid > pay_amount with `finished` → paid + `overpaid` flag for merchant review.
- Wrong network/asset: provider-dependent; surface as `failed`/support case.
- Reconciliation: cron every 5 min polls non-terminal payments via `getPayment`; same transition function; mismatches → review flag, never overwrite history.
- Success URL redirects never change state.
