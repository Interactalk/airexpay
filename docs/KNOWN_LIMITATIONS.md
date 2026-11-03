# Known limitations (Phase 1.2)

Updated: 2026-11-03 (Asia/Dhaka, UTC+6).

## Simulation boundary

- Unit tests and `pnpm dev:api:local` still default to the in-memory repository. That store lives in one process, disappears on restart, and is not shared across Worker isolates. `pnpm dev:api` (`wrangler dev --env dev`) and the staging Worker config use `STORAGE_BACKEND=durable_object`.
- `InvoiceStore` keeps one organization's invoices, payments, idempotency keys, webhook endpoints, and outbox in `org:{organizationId}`. A separate `directory` object maps public ids and provider payment ids to that organization. Those two objects are not one transaction: a crash after the organization write and before the directory write can leave an invoice that checkout cannot find until it is created again. Rate-limit counters live on `rate:{client}`.
- `STORAGE_BACKEND=postgres` refuses hosted URLs and does not open a connection from the Worker. Tests inject PGlite.
- `20261103120000_phase1_foundation.sql` is already applied on the dev project and is not edited here. `20261103140811_phase1_1_transition_rejections.sql` and `20261103140812_phase1_1_supabase_advisors.sql` are local files. This change does not apply them to the hosted project and does not deploy the Worker.
- `NowPaymentsProvider` has no HTTP client path for create, estimate, or get. Tests assert `fetch` is not called.
- `MODE_A_FEATURE_FLAG` in `packages/configuration` is `false`. An env value of `true` does not enable platform / sub-partner mode. The platform-fee split is also unimplemented: fees are not taken from customer payments.
- The provider fee rate is simulation config in `packages/configuration/src/pricing.ts`. The owner set it to 1.5% (`0.015`). TODO: recheck that rate, including any conversion fee, against official NOWPayments pricing before go-live.
- Subdomain Workers are not deployed and their DNS records are not created. Wrangler routes stay commented. Live Supabase Auth is not called. Staging and production share the parent domain `.airexpay.com` and are separated by cookie name (`ax_sess` vs `ax_sess_stg`); each Worker ignores the other name. `pay.*` strips both.
- Fee snapshots and the Mode B usage ledger are stored in the memory and Durable Object JSON snapshots. They are not a hosted SQL column. The Postgres repository keeps them in process memory for the life of that object.
- Checkout addresses are simulated. Do not send cryptocurrency to them.
- There is no dashboard, Supabase Auth, API-key issuance UI, reconciliation cron, or email.
- Merchant webhook signing secrets are AES-256-GCM ciphertext (`v1.` + base64url of a 12-byte IV and the tagged ciphertext) under `WEBHOOK_SECRET_ENCRYPTION_KEY`. The memory and Postgres repositories do the same. No HTTP response returns that secret. Provider API keys and IPN secrets are still not encrypted with `CREDENTIALS_KEK`.
- Rotation: set `WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS` to the old key and `WEBHOOK_SECRET_ENCRYPTION_KEY` to the new key (each is base64 of 32 bytes, via `wrangler secret put`, never a var). Reads try the current key, then the previous key. Writes use only the current key. Re-save each webhook endpoint so its row is rewritten, then remove the previous key. Removing it first makes old ciphertext unreadable. There is no hosted row to rotate; this app has not written secrets to a hosted database.
- Postgres `numeric` storage trims trailing zeros when amounts are read back (`49.00` can come back as `49`). The in-memory and Durable Object snapshots keep the original decimal spelling. Idempotency replays the stored JSON response either way.

## Webhooks

- Phase 1 accepts `POST /api/webhooks/nowpayments` with one simulation IPN secret. Per-connection URLs (`/v1/webhooks/nowpayments/{connectionId}`) are not implemented.
- Invalid signatures are stored with `signature_valid = false` and answered `401`. NOWPayments may retry those deliveries. Valid duplicates of the same canonical body return `200` and do not apply a second transition.
- Signature verification reads the raw body with a JSON tokenizer that preserves number tokens, sorts object keys recursively, and HMACs that canonical string with SHA-512. Comparison is constant-time. `0.10000000` stays `0.10000000`. Integers above 2^53 keep every digit. Quoted numeric strings stay quoted.
- That canonical form is what we sign. A real NOWPayments fixture is still missing. If their signer re-encodes numbers (for example PHP `json_encode`) instead of keeping the raw tokens, a preserved-literal HMAC will not match their header. Do not treat this verifier as cleared for live IPNs until a sandbox body is checked.
- `POST /api/dev/checkout/invoices` and `POST /api/dev/checkout/{public_id}/simulate` are served when `ENVIRONMENT=dev`, or when `ENVIRONMENT=staging`, `ALLOWED_MODES` is exactly `mock`, and livemode is false. Production, livemode, and any real provider mode return 404. The in-memory limiter is per process. Staging uses `rate:{client}` (30 requests per 60 seconds, then 429 and `Retry-After`). The browser does not get the IPN secret or the API key.
- The merchant outbox worker is a local function. It is not a Cloudflare Queue consumer. It refuses `ENVIRONMENT=staging` and `ENVIRONMENT=production`. Dead-letter means the row stays unpublished and `attempts` is at least 5. Events with no subscribed endpoint stay unpublished and are not failed.

## Database

- Embedded Postgres tests (PGlite) run every migration in `supabase/migrations`, the transition matrix, append-only triggers, cross-organization RLS, the advisor migration, and the Postgres repository (tenant isolation, idempotency, transition guards, rejection audits). They are not a substitute for Supabase Auth or a hosted policy review.
- `pgcrypto` is created when the server has it. PGlite does not ship that extension; `gen_random_uuid()` comes from core there.
- Forbidden transitions insert `payment.transition_rejected` into `audit_logs` and leave `payments.status` unchanged, in both backends.
- Direct `UPDATE` of `payments.status` is rejected unless the update runs inside `apply_payment_event()`.
- `private.is_member` is executable by `authenticated` so RLS policies can call it. `anon` cannot execute it. The schema must not be added to the Data API exposed schemas, or PostgREST would publish it.
- `idempotency_keys`, `outbox_events`, and `provider_webhooks` deny `anon` and `authenticated`. The service role bypasses RLS. The in-memory API is not that database role.

## Product claims

The public pricing page does not state fees, settlement speed, or licensing. The dashboard shows a simulation fee snapshot and a monthly usage statement, both labeled example data, using the configured 1.5% provider rate. Recheck that rate against official NOWPayments pricing before go-live. Company registration details (state, EIN, address) were not supplied and are not invented here.
