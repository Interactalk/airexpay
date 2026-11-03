# AGENTS.md — AirExpay

Project: **AirExpay** (product) by **AirexPay LLC** (legal entity). Crypto payment gateway SaaS.
Updated: 2026-11-03 (Asia/Dhaka, UTC+6)

## Permanent rules
- Simulation/mock provider only until written NOWPayments (or alternative provider) approval AND counsel sign-off. See `docs/PROJECT_STATUS.md`.
- GREEN (autonomous): local code, docs, mocks, unit tests, local migrations.
- YELLOW (prepare, ask): Supabase migrations on real projects, Cloudflare config, DNS, external integrations, provider settings.
- RED (never without explicit approval): live transactions, refunds, payouts, production deploy/DB changes, contracts.
- Never put secrets in code or browser bundles. Never treat API availability as authorization.
- Only `finished` = paid. `partially_paid` is never fulfilled automatically.
- Never claim TESTED/COMPLETE without executed evidence. Update `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `CHANGELOG.md` each milestone.
- Do not invent company data (EIN, address, licenses) — use placeholders.

## Layout
`apps/web`, `apps/api` (Hono on Workers), `packages/payment-core` (provider adapters), `packages/shared`, `packages/validation`, `packages/ui`, `packages/configuration`, `supabase/migrations`, `tests/{unit,integration,e2e}`, `.agents/skills/`, `docs/`.

## Status definitions
NOT STARTED · IN PROGRESS · BLOCKED · IMPLEMENTED · TESTED · APPROVED · COMPLETE (only after verification + docs).
