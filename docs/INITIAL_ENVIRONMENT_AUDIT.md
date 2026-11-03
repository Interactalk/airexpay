# Initial Environment Audit

Date: 2026-11-03 (Asia/Dhaka, UTC+6). Method: read-only connector calls and box shell checks.

## Source code

- No AirExpay/AirexPay repository exists (71 repos under GitHub `Sojib-programmer`; code search `airexpay` = 0 hits).
- Prior art: `Sojib-programmer/inboxnumber` (private, Lovable/Supabase app) contains a NOWPayments pilot:
  - `supabase/functions/nowpayments-ipn/index.ts` — deep key sort, HMAC-SHA512 (WebCrypto), constant-time compare, logs every IPN to `webhook_events`, `finished` terminal.
  - `supabase/functions/create-crypto-payment/index.ts`, `src/pages/Buy.tsx`, `src/pages/CryptoComplete.tsx`, migration `20261022093000_nowpayments_pilot.sql`.
  - Defects to avoid when porting: maps `partially_paid` → `confirming`; stores amounts as JS Number; no dedupe key on webhook events.
- Local working folder: `/workspace/airexpay` (docs only; not a git repo).

## Connectors / integrations

| Service                 | State                    | Notes                                                                                                    |
| ----------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| GitHub                  | Connected                | Account `Sojib-programmer`; read used only                                                               |
| Cloudflare              | Connected                | whoami: sojbahmmed@gmail.com, user id `ac394aedcbb51ebdf63c50538da9b990`; no resources listed or changed |
| Gmail                   | Connected                | Not used                                                                                                 |
| Google Drive / Calendar | Connected                | Not used                                                                                                 |
| Supabase                | Not connected            | No project inspected; none assumed to exist                                                              |
| PostHog                 | Not connected            |                                                                                                          |
| Resend                  | Not connected            |                                                                                                          |
| Intercom                | Not connected            |                                                                                                          |
| n8n Cloud               | Not connected            |                                                                                                          |
| NOWPayments             | No API access from agent | Owner says a verified Business account exists — unverified by agent                                      |

## Box tooling (checked via shell)

| Tool         | Version                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| node         | v24.22.1                                                                   |
| npm          | 11.21.1                                                                    |
| pnpm         | 10.34.6                                                                    |
| git          | 2.47.3                                                                     |
| gh           | 2.103.0 (2026-10-21); auth status not checked                              |
| python3      | 3.13.5                                                                     |
| wrangler     | Not installed (use `pnpm dlx wrangler` / devDependency)                    |
| supabase CLI | Not installed                                                              |
| playwright   | Not installed (npx would fetch 1.64.1)                                     |
| docker       | Not installed → local Supabase stack (`supabase start`) unavailable on box |

## Missing credentials / services

NOWPayments sandbox API key + IPN secret; Supabase project (dev); Resend API key + verified domain; PostHog project key; Intercom app id; n8n webhook URL; production domain; company details (state, EIN, address, owners).

## Conflicts / blockers

1. NOWPayments ToS §15.1 US exclusion (BLOCKER for live).
2. No Docker → RLS tests need a hosted dev Supabase project (YELLOW) or Postgres via another route (e.g. `pglite`/embedded Postgres) for local tests.
3. Domain not selected.

## Recommended architecture

See `SYSTEM_ARCHITECTURE.md`. Build in simulation mode with `MockProvider`.
