# Known limitations (Phase 1)

Updated: 2026-11-03 (Asia/Dhaka, UTC+6).

## Simulation boundary

- The API uses an in-memory database. It lives in one Worker isolate, disappears on restart, and is not shared across isolates. It is not a tenant-isolation control.
- Hosted Supabase is not configured. `supabase/migrations/20261103120000_phase1_foundation.sql` is a local file. Nothing in this repo applies it to a remote project.
- `NowPaymentsProvider` has no HTTP client path for create, estimate, or get. Tests assert `fetch` is not called.
- `MODE_A_FEATURE_FLAG` in `packages/configuration` is `false`. An env value of `true` does not enable platform / sub-partner mode.
- The hosted checkout page renders six static demo invoices. It does not call the API. Addresses are simulated. Do not send cryptocurrency to them.
- There is no dashboard, Supabase Auth, API-key issuance, merchant webhook delivery, reconciliation cron, or email.

## Webhooks

- Phase 1 accepts `POST /api/webhooks/nowpayments` with one simulation IPN secret. Per-connection URLs (`/v1/webhooks/nowpayments/{connectionId}`) are not implemented.
- Invalid signatures are stored with `signature_valid = false` and answered `401`. NOWPayments may retry those deliveries. Valid duplicates of the same canonical body return `200` and do not apply a second transition.
- Signature verification follows the documented procedure: parse JSON, sort object keys recursively, `JSON.stringify`, HMAC-SHA512, constant-time hex compare. JSON numbers are parsed by the host `JSON.parse` before signing material is rebuilt. A provider payload that depends on exact float spelling can mismatch. Amounts that arrive as JSON strings are preserved. This remains an open risk until real sandbox fixtures exist.

## Database

- Embedded Postgres tests (PGlite) run the migration, the transition matrix, append-only triggers, and one cross-organization RLS case. They are not a substitute for Supabase Auth or a hosted policy review.
- `pgcrypto` is created when the server has it. PGlite does not ship that extension; `gen_random_uuid()` comes from core there.
- `apply_payment_event()` raises on a forbidden transition, which rolls the function's writes back. The in-memory API records a rejection audit row instead. Those two behaviors differ until the API uses Postgres.
- Direct `UPDATE` of `payments.status` is rejected unless the update runs inside `apply_payment_event()`.

## Product claims

The website does not state fees, settlement speed, or licensing. Those facts are not established. Company registration details (state, EIN, address) were not supplied and are not invented here.
