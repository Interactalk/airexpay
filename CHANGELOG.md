# Changelog

## 0.1.6 — 2026-11-03 (Asia/Dhaka, UTC+6)

- Separate Workers for marketing, app, pay, api, auth, docs, and admin. Every origin is env-configurable in `@airexpay/config`. Staging hosts use a `-staging` name and do not accept the production session cookie.
- Auth sets an HttpOnly, Secure, SameSite=Lax cookie (`ax_sess` or `ax_sess_stg`) on `Domain=.airexpay.com`. Access tokens rotate. CSRF uses an allowlisted Origin plus a double-submit token. Login redirects accept only that environment’s origins. `pay.*` strips auth cookies. Admin is a scaffold behind Cloudflare Access and an admin role.
- DNS records and routes are documented and left commented in Wrangler. Nothing was deployed, no DNS was created, and live Supabase Auth was not called. This branch is based on the open pricing pull request.

## 0.1.5 — 2026-11-03 (Asia/Dhaka, UTC+6)

- Config-driven pricing. The default provider cost is 1.5% (`0.015`), and `marginMultiplier` stays 1.5. On a 100.00 USD invoice the provider fee is 1.50, the AirExpay margin is 0.75, and the total merchant fee is 2.25. Fees are rounded half away from zero in integer minor units. Plans are versioned with effective dates. Each invoice stores a snapshot of the provider fee, margin, and total fee.
- The 1.5% rate is config. Recheck it against NOWPayments' official pricing before go-live. Network fees are passed through unless the plan says otherwise. Mode B records the fee on a monthly usage ledger when an invoice becomes paid. Mode A platform split stays unimplemented and flag-off. No custody and no withdrawals.
- The dashboard shows the fee snapshot on each invoice and a monthly usage statement. The public pricing page still has no amounts.
- No deploy, no hosted Supabase change, and no NOWPayments call. This branch is based on the open onboarding pull request. The frontend pull request is already merged.

## 0.1.4 — 2026-11-03 (Asia/Dhaka, UTC+6)

- Merchant onboarding with a resumable stepper: account and email verification (Supabase-shaped, mocked locally), business profile, representatives and UBOs, camera or file identity documents, proof of address, review, and a status screen.
- Mock KYC adapter only. Document bytes are AES-GCM ciphertext, private to the organization and admins, and snapshotted into the Durable Object. A hosted Supabase migration file was added and not applied. Data retention and the KYC provider are TODO for legal review.
- Live API keys and go-live review stay locked until onboarding is approved. No deploy, no hosted Supabase changes, and no NOWPayments calls.
- This branch is based on the open frontend pull request because that pull request is not merged.

## 0.1.3 — 2026-11-03 (Asia/Dhaka, UTC+6)

- Frontend follows design system v0.5 (`design/`): Inter for the interface, Newsreader for marketing headlines, ink-blue `#1e3a5f`. Outfit and the previous green accent are gone.
- Dashboard shell, invoices, invoice detail, payment links, API keys, webhooks, settings, hosted checkout, landing, and a pricing placeholder. Dashboard figures are example data behind `apps/web/src/data`. Checkout status comes only from `GET /v1/checkout/{id}`.
- Staging keeps the simulation banner. Production with an approved go-live review shows a Live mode pill beside the organization name. There is no underpaid override. Pricing has no amounts. Tap targets on the mobile dashboard are at least 44px, with `env(safe-area-inset-*)` padding.
- Mode A stays off. No deploy, no Supabase changes, no live provider calls.

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
