# Database Architecture (Supabase Postgres)

Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` UTC, money `numeric(38,18)` (crypto) and `numeric(20,8)` (fiat) + `char(3..10)` currency; never float. All tenant tables carry `organization_id uuid not null references organizations`. RLS enabled on every table in `public`; service role used only by Workers.

Helper: `create function is_member(org uuid, roles text[] default null) returns boolean security definer` checking `organization_members` for `auth.uid()`.

| # | Table | Key columns | Constraints / RLS |
|---|---|---|---|
| 1 | organizations | id, legal_name, display_name, country, status | select if is_member(id) |
| 2 | organization_members | organization_id, user_id, role enum(owner,admin,developer,finance,support,read_only) | unique(org,user); write owner/admin |
| 3 | user_profiles | user_id pk→auth.users, full_name, locale | self only |
| 4 | merchant_profiles | organization_id, business_name, website, category, support_email, branding jsonb | member read, owner/admin write |
| 5 | merchant_verification | organization_id, status, provider_ref, reviewed_at | read members; write service only |
| 6 | processor_connections | organization_id, provider, mode, credentials_ciphertext bytea, ipn_secret_ciphertext bytea, status | **no client select of ciphertext** (view excludes columns); service-role only writes |
| 7 | api_keys | organization_id, prefix, key_hash, scopes text[], last_used_at, revoked_at | unique(prefix); hash only |
| 8 | invoices | id, organization_id, public_id (opaque), number, price_amount numeric, price_currency, status, provider_invoice_id, checkout_url, expires_at | unique(org,number); unique(provider,provider_invoice_id) |
| 9 | payments | id, organization_id, invoice_id, provider, provider_payment_id, pay_currency, network, pay_amount numeric, actually_paid numeric, pay_address, tx_hash, status, raw_status | unique(provider,provider_payment_id); status updated only by `apply_payment_event()` |
| 10 | payment_events | id, payment_id, organization_id, from_status, to_status, source(ipn,poll,mock,admin), provider_webhook_id, created_at | **append-only**: revoke update/delete; trigger raises on UPDATE/DELETE |
| 11 | provider_webhooks | id, provider, connection_id, signature_valid, headers jsonb (redacted), payload jsonb, dedupe_key, received_at, processed_at | unique(dedupe_key); append-only; service only |
| 12 | payment_links | id, organization_id, slug, amount numeric null, currency, active, expires_at | unique(slug) |
| 13 | customers | id, organization_id, email, name, external_ref | minimal PII |
| 14 | webhook_endpoints | id, organization_id, url, secret_ciphertext, events text[], active | developer/admin |
| 15 | webhook_deliveries | id, endpoint_id, outbox_event_id, attempt, status_code, next_retry_at | unique(endpoint,event,attempt) |
| 16 | idempotency_keys | organization_id, key, request_hash, response jsonb, expires_at | pk(org,key) |
| 17 | audit_logs | id, organization_id, actor_id, action, target, ip, created_at | append-only |
| 18 | notification_preferences | organization_id, user_id, event, channel, enabled | self |
| 19 | subscriptions | organization_id, plan, status, current_period_end | owner/finance |
| 20 | billing_records | organization_id, period, amount numeric, currency, status | owner/finance; not a wallet/balance |
| 21 | outbox_events | id, organization_id, event_type, payload jsonb, created_at, published_at, attempts | written in same tx as state change; consumer marks published |

(Supersedes the 21-table list with `support_metadata`; that becomes optional columns in `merchant_profiles`.)
Indexes: payments(organization_id, created_at desc), payments(status) partial on non-terminal, invoices(public_id), outbox_events(published_at) where null.
Migrations prepared locally only; not applied to any project.
