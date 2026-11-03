# Project Status

Updated: 2026-11-03 (Asia/Dhaka, UTC+6)

| Field | Value |
| --- | --- |
| Project name | AirExpay |
| Legal entity | AirexPay LLC |
| Project stage | Phase 1.1 simulation (checkout, storage, webhooks) |
| Provider authorization | Pending confirmation (NOWPayments ToS §15.1 appears to exclude US entities) |
| Development environment | Node 22, pnpm 10, local monorepo. No deploy. |
| Database | Phase 1 migration is already on the dev project and was not edited. Two new local migrations add rejection audits and Supabase advisor fixes. They were applied only to embedded Postgres in tests. The API defaults to the in-memory repository. |
| Payment integration | Simulation mode. Mock provider, number-preserving IPN verifier, local outbox worker. Live calls disabled. |
| Security audit | Pending |
| Staging deployment | Not done. Not authorized by this change. Staging URLs are configured only: `https://staging.airexpay.com` and `https://api-staging.airexpay.com`. |
| Production deployment | Not authorized |
| Live transactions | Not authorized |
| Current milestone | Phase 1.1 simulation |

## Evidence for this milestone

Commands run locally on 2026-11-03:

- `pnpm lint` — passed
- `pnpm typecheck` — passed
- `pnpm test` — 10 files, 50 tests passed, 0 failed
- `pnpm build` — API bundle and web production build passed

Browser check: create a simulated invoice, poll until the page shows waiting, trigger the dev-only simulate button, and see paid only after the checkout endpoint returns `paid`.

## Tasks

| Task | Status |
| --- | --- |
| 1.1 Environment inspection | COMPLETE (docs) |
| 1.2 Environment audit doc | COMPLETE |
| 2.1 Company identity | BLOCKED (details not supplied) |
| 2.2 NOWPayments approval | BLOCKED (email drafted, not sent) |
| 2.3 Legal research | IN PROGRESS (FinCEN/OFAC verified; counsel needed) |
| 2.4 Integration model decision | BLOCKED (provider answer) |
| 3 Product docs | COMPLETE (draft for owner review) |
| 4 Architecture docs | COMPLETE (draft for owner review) |
| 5.1 Monorepo, mock provider, state machine, IPN verifier | TESTED |
| 5.2 Invoice API and webhook route | TESTED (memory and embedded Postgres) |
| 5.3 SQL migrations and embedded Postgres checks | TESTED (new migrations included; not applied to the hosted dev project by this change) |
| 5.4 Hosted checkout wired to the mock API | TESTED (browser flow recorded) |
| 5.5 Hosted Supabase apply of new migrations, deploy, live provider | NOT STARTED (not authorized) |
| 5.6 Merchant webhook outbox worker | TESTED locally only |

## Decision requests for owner

1. Approve sending the NOWPayments email (text in NOWPAYMENTS_PROVIDER_APPROVAL.md).
2. Engage US counsel with questions in LEGAL_AND_COMPLIANCE_DEPENDENCIES.md.
3. Approve evaluating Stripe/BitPay as primary or fallback provider.
4. Supply company details (state, EIN, address, owners' nationality) and domain.
5. Approve applying `20261103140811` and `20261103140812` to the dev Supabase project. This change does not apply them.
6. Confirm `private` stays off the Data API exposed schemas after that apply.
