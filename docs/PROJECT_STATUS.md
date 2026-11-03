# Project Status

Updated: 2026-11-03 (Asia/Dhaka, UTC+6)

| Field | Value |
| --- | --- |
| Project name | AirExpay |
| Legal entity | AirexPay LLC |
| Project stage | Phase 1 foundation (simulation) |
| Provider authorization | Pending confirmation (NOWPayments ToS §15.1 appears to exclude US entities) |
| Development environment | Node 22, pnpm 10, local monorepo. No deploy. |
| Database | Local migration written for 21 tables. Not applied to any hosted project. API uses an in-memory adapter. |
| Payment integration | Simulation mode. Mock provider and IPN verifier implemented. Live calls disabled. |
| Security audit | Pending |
| Staging deployment | Not done. Not authorized by this change. |
| Production deployment | Not authorized |
| Live transactions | Not authorized |
| Current milestone | Phase 1 foundation |

## Evidence for this milestone

Commands run locally on 2026-11-03:

- `pnpm lint` — passed
- `pnpm typecheck` — passed
- `pnpm test` — 6 files, 35 tests passed, 0 failed
- `pnpm build` — API bundle and web production build passed

Browser check of the static shell (landing plus six checkout states) is recorded with this change. CI runs the same four commands on Node 22. GitHub Actions itself was not observed from this environment.

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
| 5.1 Monorepo, mock provider, state machine, IPN verifier | TESTED (35/35 local tests) |
| 5.2 Invoice API and webhook route (in-memory) | TESTED (integration tests) |
| 5.3 SQL migrations and embedded Postgres checks | TESTED (migration applies; not applied remotely) |
| 5.4 Web shell and simulated checkout | IMPLEMENTED (static demo states) |
| 5.5 Hosted Supabase, deploy, live provider | NOT STARTED (not authorized) |

## Decision requests for owner

1. Approve sending the NOWPayments email (text in NOWPAYMENTS_PROVIDER_APPROVAL.md).
2. Engage US counsel with questions in LEGAL_AND_COMPLIANCE_DEPENDENCIES.md.
3. Approve evaluating Stripe/BitPay as primary or fallback provider.
4. Supply company details (state, EIN, address, owners' nationality) and domain.
5. Approve a dev Supabase project before any migration is applied.
