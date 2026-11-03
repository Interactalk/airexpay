# Changelog

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
