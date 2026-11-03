# Infrastructure

Environments: `dev` (local + mock), `staging` (not deployed; checkout `https://staging.airexpay.com`, API `https://api-staging.airexpay.com`, mock/sandbox), `production` (not authorized).
Cloudflare: Workers (web static assets + api), Queues (outbox), Cron Triggers (reconciliation every 5 min), WAF skip rule for webhook path. Secrets via `wrangler secret`. Supabase: one project per environment; migrations in `supabase/migrations`.

## Monthly cost estimate (public pricing read 2026-11-03 (Asia/Dhaka, UTC+6))

| Service                                                                                      | Plan                                                              | USD/mo        | Source                                                      |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| Cloudflare Workers                                                                           | Paid: 10M req, 30M CPU-ms, Queues 1M ops included                 | 5             | https://developers.cloudflare.com/workers/platform/pricing/ |
| Supabase                                                                                     | Pro incl. 1 Micro project ($10 compute credit); 2nd project +$10  | 25–35         | https://supabase.com/pricing                                |
| Resend                                                                                       | Free 3,000/mo (100/day) → Pro 50k                                 | 0–20          | https://resend.com/pricing                                  |
| n8n Cloud                                                                                    | Starter €20/mo annual (Pro €50)                                   | ~22           | https://n8n.io/pricing/                                     |
| Intercom                                                                                     | Essential 1 seat ($29 list, $19 promo annual) + Fin $0.99/outcome | 19–29         | https://www.intercom.com/pricing                            |
| PostHog                                                                                      | Free tier                                                         | 0             | https://posthog.com/pricing (allowance NOT verified)        |
| GitHub                                                                                       | Existing                                                          | 0             | —                                                           |
| **Total**                                                                                    |                                                                   | **≈ $71–111** | estimate                                                    |
| Excludes provider processing fees (NOWPayments headline 1% + network fees), domain, counsel. |
