# API Architecture

Base: `https://api.<domain>/v1`. Auth: `Authorization: Bearer ak_test_…|ak_live_…` (API keys) or Supabase session JWT (dashboard). Hono middleware chain: requestId → rateLimit → auth → tenant → validate (zod) → handler → error mapper.

| Method | Path | Scope |
|---|---|---|
| POST/GET | /invoices, /invoices/{id} | invoices:write/read |
| POST | /invoices/{id}/cancel | invoices:write |
| POST/GET | /payment-links, /payment-links/{id} | links:* |
| GET | /payments, /payments/{id} | payments:read |
| GET | /currencies | public to key |
| GET | /merchant/profile, /merchant/settings | read |
| POST/GET | /webhooks/endpoints, /webhooks/deliveries | webhooks:* |
| POST/GET/DELETE | /api-keys, /api-keys/{id} | session only (owner/admin/developer) |
| POST | /webhooks/nowpayments/{connectionId} | provider signature only |
| GET | /v1/checkout/{public_id} | public read of one invoice; no secrets |
| POST | /api/dev/checkout/invoices and /simulate | dev only; server holds the simulation key and IPN secret |

Conventions: `Idempotency-Key` required on all POST (24 h); amounts as decimal strings; cursor pagination `?limit&starting_after`; errors `{"error":{"type","code","message","request_id"}}`; `X-Request-Id`; versioning by path; OpenAPI 3.1 generated from zod schemas. Rate limits: 100 req/min/key default (Workers Rate Limiting binding). Outbound merchant webhooks signed `AirExpay-Signature: t=<ts>,v1=<hmac-sha256>`, 5-min tolerance.
