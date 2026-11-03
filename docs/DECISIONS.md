# Decisions Log
| ID | Date | Decision | Status |
|---|---|---|---|
| D-001 | 2026-11-03 (Asia/Dhaka, UTC+6) | Mock/simulation provider is default; no live calls until written approval | Accepted |
| D-002 | 2026-11-03 (Asia/Dhaka, UTC+6) | payment-core adapter supports mock, nowpayments_direct (Mode B), nowpayments_platform (Mode A, flag-off); never silent switching | Accepted |
| D-003 | 2026-11-03 (Asia/Dhaka, UTC+6) | Only `finished` = paid; `partially_paid` distinct | Accepted |
| D-004 | 2026-11-03 (Asia/Dhaka, UTC+6) | Money as Postgres numeric + decimal strings in JSON | Accepted |
| D-005 | 2026-11-03 (Asia/Dhaka, UTC+6) | payment_events, provider_webhooks, audit_logs append-only | Accepted |
| D-006 | 2026-11-03 (Asia/Dhaka, UTC+6) | Webhook ack after durable write; side effects via outbox_events + Cloudflare Queues | Accepted |
| D-007 | 2026-11-03 (Asia/Dhaka, UTC+6) | No wallets, balances, payouts or sub-partner custody in V1 | Accepted |
| D-008 | 2026-11-03 (Asia/Dhaka, UTC+6) | Port inboxnumber IPN verifier, fixing partially_paid mapping and float amounts | Proposed |
| D-009 | 2026-11-03 (Asia/Dhaka, UTC+6) | Live launch blocked on NOWPayments §15.1 answer and counsel opinion | Blocked |
| D-010 | 2026-11-03 (Asia/Dhaka, UTC+6) | No GitHub repo / Supabase project until owner approves Phase 1 | Accepted |
| D-011 | 2026-11-03 (Asia/Dhaka, UTC+6) | Evaluate US-eligible alternative providers (Stripe crypto via Connect, BitPay, Coinbase Business) in parallel | Proposed |
| D-012 | 2026-11-03 (Asia/Dhaka, UTC+6) | `outbox_events` replaces `support_metadata` in 21-table set | Accepted |
| D-013 | 2026-11-03 (Asia/Dhaka, UTC+6) | Per-connection IPN URL `/v1/webhooks/nowpayments/{connectionId}` for Mode B secret lookup | Proposed |
| D-014 | 2026-11-03 (Asia/Dhaka, UTC+6) | Phase 1 code is in this repo, simulation only. D-010's "no repo" is superseded by the Phase 1 implementation request. No hosted Supabase project is created or migrated. | Accepted |
| D-015 | 2026-11-03 (Asia/Dhaka, UTC+6) | Phase 1 webhook route is `POST /api/webhooks/nowpayments` with one simulation secret. D-013 remains the target for Mode B. | Accepted |
| D-016 | 2026-11-03 (Asia/Dhaka, UTC+6) | `MODE_A_FEATURE_FLAG` is a boolean constant set to false. Environment cannot enable Mode A. | Accepted |
| D-017 | 2026-11-03 (Asia/Dhaka, UTC+6) | Invalid IPN signatures are stored with `signature_valid=false` and answered 401. Valid duplicate bodies ack 200 and do not transition again. | Accepted |
| D-018 | 2026-11-03 (Asia/Dhaka, UTC+6) | In-memory database is the Phase 1 stand-in when Supabase is unavailable. It is not durable. RLS is specified in SQL and exercised with embedded Postgres. | Accepted |
| D-019 | 2026-11-03 (Asia/Dhaka, UTC+6) | `ak_test_simulation_alpha`, `ak_test_simulation_beta_`, and `simulation-ipn-secret` are public placeholders for the in-memory demo. They are not credentials. | Accepted |
