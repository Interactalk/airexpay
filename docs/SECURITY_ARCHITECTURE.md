# Security Architecture

- Tenant isolation: RLS + API tenant middleware; tests attempt cross-org access for every table/endpoint.
- Secrets: provider keys and IPN secrets encrypted with AES-GCM (key in Workers secret `CREDENTIALS_KEK`), decrypted only in Worker memory; never logged; never returned.
- API keys: random 32 bytes, `ak_live_` prefix, SHA-256 hash stored; shown once; scoped; revocable.
- Webhook (NOWPayments IPN): raw body → recursive key sort → `JSON.stringify` → HMAC-SHA512 with connection's IPN secret → constant-time compare with `x-nowpayments-sig` → persist provider_webhooks (dedupe) → validate payment ownership + transition → ack ≤ 3 s → outbox. IP list used as signal only. Cloudflare WAF skip rule on path; no bot challenge.
- IPN numbers are preserved from the raw body before the HMAC. A captured NOWPayments sandbox body is still required before live verification is trusted.
- Checkout: opaque `public_id`, no amount from client, no credentials, CSP strict, no third-party scripts except required.
- Web: Supabase Auth with email verification, session expiry, CSRF n/a for bearer APIs, SameSite cookies if used, XSS via React escaping + CSP.
- Analytics/support hygiene: no wallet addresses, secrets, raw payloads to PostHog/Intercom.
- Ops: audit_logs for key/role/connection changes; credential rotation runbook; dependency scanning in CI.
