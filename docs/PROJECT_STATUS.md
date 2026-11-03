# Project Status

Updated: 2026-11-03 (Asia/Dhaka, UTC+6)

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project name            | AirExpay                                                                                                                                                                                                                                                                                                                                                        |
| Legal entity            | AirexPay LLC                                                                                                                                                                                                                                                                                                                                                    |
| Project stage           | Phase 1.2 simulation, with the v0.5 dashboard and checkout UI                                                                                                                                                                                                                                                                                                   |
| Provider authorization  | Pending confirmation (NOWPayments ToS §15.1 appears to exclude US entities)                                                                                                                                                                                                                                                                                     |
| Development environment | Node 22, pnpm 10, local monorepo. No deploy.                                                                                                                                                                                                                                                                                                                    |
| Database                | Phase 1 migration is already on the dev project and was not edited. Later migrations were applied only to embedded Postgres in tests. Unit tests still default to the in-memory repository. Dev and staging Wrangler configs select `STORAGE_BACKEND=durable_object` with the `INVOICE_STORE` binding. Nothing was deployed and no hosted database was changed. |
| Payment integration     | Simulation mode. Mock provider, number-preserving IPN verifier, local outbox worker. Live calls disabled.                                                                                                                                                                                                                                                       |
| Security audit          | Pending                                                                                                                                                                                                                                                                                                                                                         |
| Staging deployment      | Not done. Not authorized by this change. Staging URLs are configured only: `https://staging.airexpay.com` and `https://api-staging.airexpay.com`.                                                                                                                                                                                                               |
| Production deployment   | Not authorized                                                                                                                                                                                                                                                                                                                                                  |
| Live transactions       | Not authorized                                                                                                                                                                                                                                                                                                                                                  |
| Current milestone       | Phase 1.5 platform fee pricing, branched from the open onboarding pull request                                                                                                                                                                                                                                                                                  |

## Evidence for this milestone

Commands run locally on 2026-11-03 for platform fee pricing:

- `pnpm lint` — passed (one react-refresh warning in `theme.tsx`; Prettier check passed)
- `pnpm typecheck` — passed
- `pnpm test` — 18 files, 91 tests passed, 0 failed
- `pnpm build` — API bundle (`dist/index.js`) and web production build passed

A 100.00 USD quote at the current plan returns provider fee 1.50, margin 0.75, and total fee 2.25. The same numbers are on `POST /v1/invoices`. The invoice drawer and usage statement were opened in Chromium at 1440×900 and 390×844. The public pricing page still has no amounts. Mobile `scrollWidth` stayed 390. The full Playwright suite from onboarding was not re-run.

Phase 1.2 Durable Object evidence still applies: Miniflare creates an invoice, evicts the organization and directory objects, simulates a signed IPN, and reads `paid` back from SQLite. This change does not redeploy staging and does not apply migrations.

## Staging Worker configuration (not applied by this change)

`apps/api` environment `staging` (`wrangler --env staging`, script name `airexpay-api-staging`). Do not deploy until the owner asks.

Vars already in `wrangler.toml`:

| Name                         | Value                                           |
| ---------------------------- | ----------------------------------------------- |
| `ENVIRONMENT`                | `staging`                                       |
| `ALLOWED_MODES`              | `mock`                                          |
| `NOWPAYMENTS_MODE_A_ENABLED` | `false`                                         |
| `LIVEMODE`                   | `false`                                         |
| `SIMULATION_IPN_SECRET`      | `simulation-ipn-secret` (public placeholder)    |
| `SIMULATION_API_KEY`         | `ak_test_simulation_alpha` (public placeholder) |
| `STORAGE_BACKEND`            | `durable_object`                                |
| `PUBLIC_CHECKOUT_BASE_URL`   | `https://staging.airexpay.com`                  |
| `DATABASE_URL`               | empty                                           |

Binding:

| Binding         | Class          | Storage                                                                 |
| --------------- | -------------- | ----------------------------------------------------------------------- |
| `INVOICE_STORE` | `InvoiceStore` | SQLite (`migrations` tag `v1`, `new_sqlite_classes = ["InvoiceStore"]`) |

Secret, set outside the repo before any merchant webhook endpoint is stored. Checkout simulation does not require it.

| Secret                                   | Required                         | Notes                                                                                  |
| ---------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `WEBHOOK_SECRET_ENCRYPTION_KEY`          | Before saving a webhook endpoint | `wrangler secret put WEBHOOK_SECRET_ENCRYPTION_KEY --env staging`. Base64 of 32 bytes. |
| `WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS` | Only during rotation             | Decrypt-only. Remove after endpoints are re-saved.                                     |

No `NOWPAYMENTS_API_KEY`, no hosted `DATABASE_URL`, and no production environment. The dev Wrangler environment uses the same `INVOICE_STORE` binding with `STORAGE_BACKEND=durable_object` and `PUBLIC_CHECKOUT_BASE_URL=http://localhost:5173`.

## Tasks

| Task                                                               | Status                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1 Environment inspection                                         | COMPLETE (docs)                                                                                                                      |
| 1.2 Environment audit doc                                          | COMPLETE                                                                                                                             |
| 2.1 Company identity                                               | BLOCKED (details not supplied)                                                                                                       |
| 2.2 NOWPayments approval                                           | BLOCKED (email drafted, not sent)                                                                                                    |
| 2.3 Legal research                                                 | IN PROGRESS (FinCEN/OFAC verified; counsel needed)                                                                                   |
| 2.4 Integration model decision                                     | BLOCKED (provider answer)                                                                                                            |
| 3 Product docs                                                     | COMPLETE (draft for owner review)                                                                                                    |
| 4 Architecture docs                                                | COMPLETE (draft for owner review)                                                                                                    |
| 5.1 Monorepo, mock provider, state machine, IPN verifier           | TESTED                                                                                                                               |
| 5.2 Invoice API and webhook route                                  | TESTED (memory and embedded Postgres)                                                                                                |
| 5.3 SQL migrations and embedded Postgres checks                    | TESTED (new migrations included; not applied to the hosted dev project by this change)                                               |
| 5.4 Hosted checkout wired to the mock API                          | TESTED (browser flow recorded)                                                                                                       |
| 5.5 Hosted Supabase apply of new migrations, deploy, live provider | NOT STARTED (not authorized)                                                                                                         |
| 5.6 Merchant webhook outbox worker                                 | TESTED locally only                                                                                                                  |
| 5.7 Durable Object repository (`InvoiceStore`)                     | TESTED with Miniflare via Wrangler's local test harness. Not deployed.                                                               |
| 5.8 Staging simulation checkout gate and rate limit                | TESTED. Production config returns 404. Not deployed.                                                                                 |
| 5.9 Merchant webhook secret AES-GCM                                | TESTED. `CREDENTIALS_KEK` for provider secrets is still not implemented.                                                             |
| 5.10 Design system v0.5 frontend                                   | TESTED locally. Dashboard data is example-only. Checkout polls the simulation API. Not deployed.                                     |
| 5.11 Merchant onboarding and mock KYC                              | TESTED locally. Migration file added and not applied to a hosted database. Not deployed.                                             |
| 5.12 Platform fee pricing and monthly usage ledger                 | TESTED locally. Default provider rate is the configured 1.5%. No hosted migration, no deploy, no NOWPayments call. Mode A stays off. |

## Decision requests for owner

1. Approve sending the NOWPayments email (text in NOWPAYMENTS_PROVIDER_APPROVAL.md).
2. Engage US counsel with questions in LEGAL_AND_COMPLIANCE_DEPENDENCIES.md.
3. Approve evaluating Stripe/BitPay as primary or fallback provider.
4. Supply company details (state, EIN, address, owners' nationality) and domain.
5. Approve applying `20261103140811` and `20261103140812` to the dev Supabase project. This change does not apply them.
6. Confirm `private` stays off the Data API exposed schemas after that apply.
