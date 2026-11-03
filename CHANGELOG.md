# Changelog

## 0.1.2 — 2026-11-03 (Asia/Dhaka, UTC+6)

- Phase 1.2 simulation: `STORAGE_BACKEND=durable_object` implements the invoice repository on the SQLite `InvoiceStore` Durable Object (one object per organization, plus a directory and per-client rate objects). Dev and staging Wrangler configs declare the `INVOICE_STORE` binding. Unit tests stay on the in-memory repository.
- Simulation checkout routes are allowed on staging when `ALLOWED_MODES` is exactly `mock` and livemode is false. They stay closed in production and whenever a non-mock mode or livemode is on, and they are rate-limited.
- Merchant webhook secrets are encrypted at rest with AES-256-GCM (`WEBHOOK_SECRET_ENCRYPTION_KEY`). Rotation uses `WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS` as a decrypt-only key.
- No Cloudflare deploy, no hosted database connection, no live provider calls.

## 0.1.1 — 2026-11-03 (Asia/Dhaka, UTC+6)

- Phase 1.1 simulation: number-preserving NOWPayments IPN canonicalization, a repository with an in-memory default and a parameterized Postgres implementation (embedded Postgres only), durable rejection audits, a live checkout page, and a local merchant-webhook outbox worker.
- New migrations only. `20261103120000_phase1_foundation.sql` is unchanged. Advisor fixes (empty `search_path`, private `is_member`, initplan `auth.uid()`, consolidated policies, foreign-key indexes, explicit service-role denies) and rejection audits are new files.
- Checkout links use `PUBLIC_CHECKOUT_BASE_URL`. The web app calls `VITE_API_BASE_URL` (empty in local dev). Staging values are `https://staging.airexpay.com` and `https://api-staging.airexpay.com`.
- Mode A stays off. No Cloudflare deploy, no hosted database connection, no live provider calls.

## 0.1.0 — 2026-11-03 (Asia/Dhaka, UTC+6)

- Phase 1 simulation foundation: pnpm monorepo (`apps/web`, `apps/api`, shared packages), mock provider, NOWPayments IPN verifier, payment state machine, in-memory invoice API, hosted checkout preview, and local SQL migrations.
- Mode A (platform / sub-partner) stays behind a compile-time flag that is false. No live provider calls, no deploy, no hosted Supabase changes.
- Local verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` (35 passed, 0 failed), `pnpm build`.

## 0.0.1 — 2026-11-03 (Asia/Dhaka, UTC+6)

- Phase 0 discovery documentation created locally (no repo, no deploy, no Supabase/Cloudflare changes).
- Verified NOWPayments API, IPN procedure and ToS (19 Oct 2026); identified §15.1 US-jurisdiction blocker.
- Opened and verified FinCEN FIN-2019-G001 and OFAC virtual-currency sanctions guidance (Oct 2021).
- Researched US-eligible alternatives (BitPay, Coinbase Business, Stripe stablecoin payments).
- Online Page: AirExpay Phase 0 Readiness Report.
