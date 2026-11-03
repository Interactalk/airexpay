# Product Requirements (V1)

Each capability lists a measurable acceptance criterion.

| #   | Capability                      | Acceptance criterion                                                                             |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Public website (13 routes)      | All routes render; Lighthouse perf ≥ 90 mobile on home; no unsupported claims (checklist review) |
| 2   | Registration/auth               | Signup→verified email→login E2E passes; password reset E2E passes                                |
| 3   | Organizations & roles (6 roles) | Role×resource permission matrix tests 100% pass                                                  |
| 4   | Merchant dashboard              | Shows only DB-derived metrics; p95 load < 1.5 s with 10k payments                                |
| 5   | Invoices                        | Create/cancel/view; duplicate POST with same Idempotency-Key returns same invoice (test)         |
| 6   | Payment links                   | Create/disable; disabled link returns 410 (test)                                                 |
| 7   | Hosted checkout                 | Renders all 11 states; QR encodes exact address+amount (test); mobile 360 px E2E                 |
| 8   | Currency selection              | List comes from provider adapter; no hardcoded rates                                             |
| 9   | Transaction tracking            | Event timeline shows every payment_event; CSV export matches DB rows                             |
| 10  | Notifications                   | One email per event id (dedupe test)                                                             |
| 11  | API keys                        | Secret shown once; stored hash only; revoked key → 401 within 60 s                               |
| 12  | Merchant webhooks               | Signed deliveries; retries with backoff up to 24 h; manual retry                                 |
| 13  | Admin management                | Internal admin can suspend org; audited                                                          |
| 14  | Support (Intercom)              | Messenger loads for logged-in users with identity verification                                   |
| 15  | Analytics (PostHog)             | 16 named events fire in E2E; no PII/secret properties (lint rule)                                |

Non-functional: tenant isolation (0 cross-org reads in RLS tests), webhook ack p95 < 500 ms, no secret in client bundle (build scan), all money as decimal strings.
Excluded from V1: wallets, exchange, trading, balances, custody, payouts, unapproved fiat conversion/recurring, DeFi, tokens.
