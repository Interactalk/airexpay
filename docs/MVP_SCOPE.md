# MVP Scope

## In

Website, auth, orgs/roles, dashboard, invoices, payment links, hosted checkout, mock provider, NOWPayments sandbox adapter (behind flag), IPN verification, state machine, reconciliation job, API keys, public API, merchant webhooks, Resend emails, n8n workflows A–F, Intercom messenger, PostHog events.

## Out

Live processing, custody, balances, payouts, fiat, subscriptions billing via crypto, plugins (WooCommerce/Shopify), multi-provider UI beyond adapter.

## Success criteria (MVP exit, simulation)

| Criterion                                                   | Target          |
| ----------------------------------------------------------- | --------------- |
| E2E journey J2 on mock provider (all 9 statuses)            | 100% pass       |
| False-paid events (any non-`finished` marking paid)         | 0 in test suite |
| Duplicate fulfillment on replayed IPN (100 replays)         | 0               |
| Invalid-signature IPNs accepted                             | 0               |
| Cross-tenant data access in RLS/API tests                   | 0               |
| Webhook ack p95 (load test 50 rps)                          | < 500 ms        |
| Secrets found in client bundle scan                         | 0               |
| Infra cost at beta                                          | ≤ $100/month    |
| Beta (after approval): merchants activated                  | 5–10            |
| Beta: first-payment conversion (onboarded → first finished) | ≥ 50%           |
| Beta: webhook delivery success                              | ≥ 99%           |
