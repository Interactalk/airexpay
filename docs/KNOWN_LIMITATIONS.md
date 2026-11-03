# Known limitations (Phase 1.1)

Updated: 2026-11-03 (Asia/Dhaka, UTC+6).

## Simulation boundary

- The default API database is in-memory. It lives in one Worker isolate, disappears on restart, and is not shared across isolates. `STORAGE_BACKEND=postgres` refuses hosted URLs and does not open a connection from the Worker. Tests inject PGlite.
- `20261103120000_phase1_foundation.sql` is already applied on the dev project and is not edited here. `20261103140811_phase1_1_transition_rejections.sql` and `20261103140812_phase1_1_supabase_advisors.sql` are local files. This change does not apply them to the hosted project.
- `NowPaymentsProvider` has no HTTP client path for create, estimate, or get. Tests assert `fetch` is not called.
- `MODE_A_FEATURE_FLAG` in `packages/configuration` is `false`. An env value of `true` does not enable platform / sub-partner mode.
- Checkout addresses are simulated. Do not send cryptocurrency to them.
- There is no dashboard, Supabase Auth, API-key issuance UI, reconciliation cron, or email.
- Merchant webhook signing secrets in the local skeleton are held in process memory, or as UTF-8 bytes in `secret_ciphertext` for the Postgres tests. AES-GCM with `CREDENTIALS_KEK` is not implemented. No HTTP response returns that secret.
- Postgres `numeric` storage trims trailing zeros when amounts are read back (`49.00` can come back as `49`). The in-memory backend keeps the original decimal spelling. Idempotency replays the stored JSON response either way.

## Webhooks

- Phase 1 accepts `POST /api/webhooks/nowpayments` with one simulation IPN secret. Per-connection URLs (`/v1/webhooks/nowpayments/{connectionId}`) are not implemented.
- Invalid signatures are stored with `signature_valid = false` and answered `401`. NOWPayments may retry those deliveries. Valid duplicates of the same canonical body return `200` and do not apply a second transition.
- Signature verification reads the raw body with a JSON tokenizer that preserves number tokens, sorts object keys recursively, and HMACs that canonical string with SHA-512. Comparison is constant-time. `0.10000000` stays `0.10000000`. Integers above 2^53 keep every digit. Quoted numeric strings stay quoted.
- That canonical form is what we sign. A real NOWPayments fixture is still missing. If their signer re-encodes numbers (for example PHP `json_encode`) instead of keeping the raw tokens, a preserved-literal HMAC will not match their header. Do not treat this verifier as cleared for live IPNs until a sandbox body is checked.
- Dev-only `POST /api/dev/checkout/{public_id}/simulate` signs a mock IPN on the server when `ENVIRONMENT=dev`. Other environments return 404. The browser does not get the IPN secret or the API key.
- The merchant outbox worker is a local function. It is not a Cloudflare Queue consumer. It refuses `ENVIRONMENT=staging` and `ENVIRONMENT=production`. Dead-letter means the row stays unpublished and `attempts` is at least 5. Events with no subscribed endpoint stay unpublished and are not failed.

## Database

- Embedded Postgres tests (PGlite) run every migration in `supabase/migrations`, the transition matrix, append-only triggers, cross-organization RLS, the advisor migration, and the Postgres repository (tenant isolation, idempotency, transition guards, rejection audits). They are not a substitute for Supabase Auth or a hosted policy review.
- `pgcrypto` is created when the server has it. PGlite does not ship that extension; `gen_random_uuid()` comes from core there.
- Forbidden transitions insert `payment.transition_rejected` into `audit_logs` and leave `payments.status` unchanged, in both backends.
- Direct `UPDATE` of `payments.status` is rejected unless the update runs inside `apply_payment_event()`.
- `private.is_member` is executable by `authenticated` so RLS policies can call it. `anon` cannot execute it. The schema must not be added to the Data API exposed schemas, or PostgREST would publish it.
- `idempotency_keys`, `outbox_events`, and `provider_webhooks` deny `anon` and `authenticated`. The service role bypasses RLS. The in-memory API is not that database role.

## Product claims

The website does not state fees, settlement speed, or licensing. Those facts are not established. Company registration details (state, EIN, address) were not supplied and are not invented here.
