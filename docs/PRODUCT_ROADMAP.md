# Product Roadmap

| Phase | Scope | Gate |
|---|---|---|
| 0 Discovery | Audit, provider/legal docs, architecture (this folder) | Owner review |
| 1 Foundation | Monorepo, CI, Supabase schema (local), auth, orgs, roles | RLS tests pass |
| 2 Merchant MVP | Dashboard, invoices, links, checkout on MockProvider | Demo |
| 3 Provider | NOWPayments sandbox adapter and/or alternative (Stripe/BitPay) adapter; IPN; reconciliation | Sandbox fixtures all statuses |
| 4 Developer | API keys, public API, webhooks, OpenAPI, docs | SDK tests |
| 5 Operations | n8n, Resend, Intercom, PostHog, monitoring | Idempotency tests |
| 6 Beta | 5–10 merchants, live only after written provider + counsel approval | GO/NO-GO report |
| Post-launch | Plugins, more providers, advanced reporting | Separate assessment |

Decision point after Phase 0: choose primary provider given NOWPayments §15.1.
