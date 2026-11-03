-- AirExpay Phase 1 schema. Local migration file only.
-- Do not apply this to a hosted Supabase project from Phase 1 tooling.
-- Expects Supabase prerequisites: roles anon + authenticated, schema auth
-- with auth.users and auth.uid(). Money is numeric. Timestamps are timestamptz (UTC).

-- pgcrypto supplies gen_random_uuid() on older Postgres. Supabase has it.
-- Embedded Postgres used in CI may ship gen_random_uuid() in core and omit the extension.
do $$
begin
  execute 'create extension if not exists pgcrypto';
exception
  when feature_not_supported or undefined_file then
    null;
end $$;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.member_role as enum (
  'owner', 'admin', 'developer', 'finance', 'support', 'read_only'
);

create type public.invoice_status as enum (
  'waiting', 'confirming', 'paid', 'underpaid', 'expired', 'failed', 'refunded', 'canceled'
);

create type public.payment_status as enum (
  'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid',
  'finished', 'failed', 'refunded', 'expired'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  country char(2),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. organization_members
-- ---------------------------------------------------------------------------

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function public.is_member(org uuid, roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = org
      and member.user_id = auth.uid()
      and (roles is null or member.role::text = any (roles))
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. user_profiles
-- ---------------------------------------------------------------------------

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. merchant_profiles
-- ---------------------------------------------------------------------------

create table public.merchant_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  business_name text not null,
  website text,
  category text,
  support_email text,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. merchant_verification
-- ---------------------------------------------------------------------------

create table public.merchant_verification (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  status text not null default 'unverified'
    check (status in ('unverified', 'pending', 'approved', 'rejected')),
  provider_ref text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. processor_connections
-- ---------------------------------------------------------------------------

create table public.processor_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('mock', 'nowpayments')),
  mode text not null check (mode in ('mock', 'nowpayments_direct', 'nowpayments_platform')),
  credentials_ciphertext bytea,
  ipn_secret_ciphertext bytea,
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.processor_connections.credentials_ciphertext is
  'AES-GCM ciphertext. Never selectable by client roles.';
comment on column public.processor_connections.ipn_secret_ciphertext is
  'AES-GCM ciphertext. Never selectable by client roles.';

-- ---------------------------------------------------------------------------
-- 7. api_keys
-- ---------------------------------------------------------------------------

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  prefix text not null unique,
  key_hash text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.api_keys.key_hash is 'SHA-256 hash only. Plaintext is never stored.';

-- ---------------------------------------------------------------------------
-- 8. invoices
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  public_id text not null unique,
  number text not null,
  price_amount numeric(20, 8) not null check (price_amount >= 0),
  price_currency text not null check (char_length(price_currency) between 3 and 10),
  status public.invoice_status not null default 'waiting',
  provider text check (provider in ('mock', 'nowpayments')),
  provider_invoice_id text,
  checkout_url text,
  order_id text,
  description text,
  expires_at timestamptz,
  overpaid boolean not null default false,
  late_payment_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number),
  unique (provider, provider_invoice_id)
);

-- ---------------------------------------------------------------------------
-- 9. payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  provider text not null check (provider in ('mock', 'nowpayments')),
  provider_payment_id text not null,
  pay_currency text check (pay_currency is null or char_length(pay_currency) between 2 and 10),
  network text,
  pay_amount numeric(38, 18) check (pay_amount is null or pay_amount >= 0),
  actually_paid numeric(38, 18) check (actually_paid is null or actually_paid >= 0),
  pay_address text,
  tx_hash text,
  status public.payment_status not null,
  raw_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

comment on column public.payments.status is
  'Updated only by public.apply_payment_event().';

-- ---------------------------------------------------------------------------
-- 10. payment_events (append-only)
-- ---------------------------------------------------------------------------

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  from_status public.payment_status,
  to_status public.payment_status not null,
  source text not null check (source in ('ipn', 'poll', 'mock', 'admin')),
  provider_webhook_id uuid,
  overpaid boolean not null default false,
  late_payment_review boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. provider_webhooks (append-only, service only)
-- ---------------------------------------------------------------------------

create table public.provider_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  connection_id uuid references public.processor_connections (id),
  signature_valid boolean not null,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  dedupe_key text not null unique,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- 12. payment_links
-- ---------------------------------------------------------------------------

create table public.payment_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique,
  amount numeric(20, 8) check (amount is null or amount >= 0),
  currency text check (currency is null or char_length(currency) between 3 and 10),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 13. customers
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text,
  name text,
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 14. webhook_endpoints
-- ---------------------------------------------------------------------------

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  secret_ciphertext bytea,
  events text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 15. webhook_deliveries
-- ---------------------------------------------------------------------------

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  outbox_event_id uuid,
  attempt integer not null check (attempt > 0),
  status_code integer,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  unique (endpoint_id, outbox_event_id, attempt)
);

-- ---------------------------------------------------------------------------
-- 16. idempotency_keys
-- ---------------------------------------------------------------------------

create table public.idempotency_keys (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  request_hash text not null,
  response jsonb,
  status_code integer,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, key)
);

-- ---------------------------------------------------------------------------
-- 17. audit_logs (append-only)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid,
  action text not null,
  target text,
  ip inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 18. notification_preferences
-- ---------------------------------------------------------------------------

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  event text not null,
  channel text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, event, channel)
);

-- ---------------------------------------------------------------------------
-- 19. subscriptions (SaaS plan, not a crypto balance)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan text not null,
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 20. billing_records (fee invoices, not a wallet)
-- ---------------------------------------------------------------------------

create table public.billing_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period text not null,
  amount numeric(20, 8) not null check (amount >= 0),
  currency text not null check (char_length(currency) between 3 and 10),
  status text not null check (status in ('open', 'paid', 'void')),
  created_at timestamptz not null default now()
);

comment on table public.billing_records is
  'Software subscription charges. Not a custodial balance or payout ledger.';

-- ---------------------------------------------------------------------------
-- 21. outbox_events
-- ---------------------------------------------------------------------------

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0)
);

-- Deferred FK: deliveries reference outbox rows created in the same transaction family.
alter table public.webhook_deliveries
  add constraint webhook_deliveries_outbox_event_id_fkey
  foreign key (outbox_event_id) references public.outbox_events (id);

alter table public.payment_events
  add constraint payment_events_provider_webhook_id_fkey
  foreign key (provider_webhook_id) references public.provider_webhooks (id);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index payments_org_created_idx
  on public.payments (organization_id, created_at desc);

create index payments_status_open_idx
  on public.payments (status)
  where status in ('waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'expired');

create index invoices_public_id_idx on public.invoices (public_id);

create index outbox_unpublished_idx
  on public.outbox_events (created_at)
  where published_at is null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger user_profiles_set_updated_at before update on public.user_profiles
  for each row execute function public.set_updated_at();
create trigger merchant_profiles_set_updated_at before update on public.merchant_profiles
  for each row execute function public.set_updated_at();
create trigger merchant_verification_set_updated_at before update on public.merchant_verification
  for each row execute function public.set_updated_at();
create trigger processor_connections_set_updated_at before update on public.processor_connections
  for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger payment_links_set_updated_at before update on public.payment_links
  for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger webhook_endpoints_set_updated_at before update on public.webhook_endpoints
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Append-only guards
-- ---------------------------------------------------------------------------

create trigger payment_events_append_only
  before update or delete on public.payment_events
  for each row execute function public.reject_mutation();

create trigger provider_webhooks_append_only
  before update or delete on public.provider_webhooks
  for each row execute function public.reject_mutation();

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.reject_mutation();

create or replace function public.guard_payment_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and current_setting('airexpay.apply_payment_event', true) is distinct from 'on' then
    raise exception 'payments.status is updated only by apply_payment_event()';
  end if;
  return new;
end;
$$;

create trigger payments_status_guard
  before update on public.payments
  for each row execute function public.guard_payment_status();

-- ---------------------------------------------------------------------------
-- State transition. Keep the CASE arms aligned with ALLOWED_TRANSITIONS.
-- ---------------------------------------------------------------------------

create or replace function public.apply_payment_event(
  p_payment_id uuid,
  p_to_status public.payment_status,
  p_source text,
  p_provider_webhook_id uuid default null,
  p_actually_paid numeric default null,
  p_pay_amount numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments%rowtype;
  v_allowed boolean := false;
  v_event_id uuid;
  v_invoice_status public.invoice_status;
  v_overpaid boolean;
  v_late boolean;
  v_pay_amount numeric(38, 18);
  v_actually numeric(38, 18);
  v_event_type text;
begin
  if p_source not in ('ipn', 'poll', 'mock', 'admin') then
    raise exception 'invalid payment event source';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment not found';
  end if;

  if v_pay.status = p_to_status then
    return null;
  end if;

  v_allowed := case
    when v_pay.status = 'waiting' and p_to_status in ('confirming', 'expired', 'failed', 'partially_paid', 'finished') then true
    when v_pay.status = 'confirming' and p_to_status in ('confirmed', 'sending', 'partially_paid', 'finished', 'failed') then true
    when v_pay.status = 'confirmed' and p_to_status in ('sending', 'partially_paid', 'finished', 'failed') then true
    when v_pay.status = 'sending' and p_to_status in ('finished', 'partially_paid', 'failed') then true
    when v_pay.status = 'partially_paid' and p_to_status in ('finished', 'refunded', 'failed') then true
    when v_pay.status = 'finished' and p_to_status = 'refunded' then true
    when v_pay.status = 'expired' and p_to_status in ('partially_paid', 'finished') then true
    else false
  end;

  if not v_allowed then
    raise exception 'forbidden transition % -> %', v_pay.status, p_to_status;
  end if;

  v_pay_amount := coalesce(p_pay_amount, v_pay.pay_amount);
  v_actually := coalesce(p_actually_paid, v_pay.actually_paid);
  v_overpaid := p_to_status = 'finished'
    and v_pay_amount is not null
    and v_actually is not null
    and v_actually > v_pay_amount;
  v_late := v_pay.status = 'expired' and p_to_status in ('partially_paid', 'finished');

  v_invoice_status := case p_to_status
    when 'finished' then 'paid'::public.invoice_status
    when 'partially_paid' then 'underpaid'::public.invoice_status
    when 'expired' then 'expired'::public.invoice_status
    when 'failed' then 'failed'::public.invoice_status
    when 'refunded' then 'refunded'::public.invoice_status
    when 'waiting' then 'waiting'::public.invoice_status
    else 'confirming'::public.invoice_status
  end;

  insert into public.payment_events (
    payment_id, organization_id, from_status, to_status, source,
    provider_webhook_id, overpaid, late_payment_review
  ) values (
    v_pay.id, v_pay.organization_id, v_pay.status, p_to_status, p_source,
    p_provider_webhook_id, v_overpaid, v_late
  ) returning id into v_event_id;

  perform set_config('airexpay.apply_payment_event', 'on', true);
  update public.payments
    set status = p_to_status,
        raw_status = p_to_status::text,
        pay_amount = v_pay_amount,
        actually_paid = v_actually,
        updated_at = now()
    where id = v_pay.id;

  update public.invoices
    set status = v_invoice_status,
        overpaid = public.invoices.overpaid or v_overpaid,
        late_payment_review = public.invoices.late_payment_review or v_late
    where id = v_pay.invoice_id;

  if p_to_status = 'finished' then
    v_event_type := 'payment.finished';
  elsif p_to_status = 'partially_paid' then
    v_event_type := 'payment.partially_paid';
  else
    v_event_type := 'payment.' || p_to_status::text;
  end if;

  insert into public.outbox_events (organization_id, event_type, payload)
  values (
    v_pay.organization_id,
    v_event_type,
    jsonb_build_object(
      'payment_id', v_pay.id,
      'from_status', v_pay.status,
      'to_status', p_to_status,
      'invoice_status', v_invoice_status,
      'overpaid', v_overpaid,
      'late_payment_review', v_late,
      'source', p_source
    )
  );

  if p_to_status = 'finished' then
    insert into public.outbox_events (organization_id, event_type, payload)
    values (
      v_pay.organization_id,
      'invoice.paid',
      jsonb_build_object('payment_id', v_pay.id, 'invoice_status', 'paid')
    );
  elsif p_to_status = 'partially_paid' then
    insert into public.outbox_events (organization_id, event_type, payload)
    values (
      v_pay.organization_id,
      'invoice.underpaid',
      jsonb_build_object('payment_id', v_pay.id, 'invoice_status', 'underpaid')
    );
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.apply_payment_event(uuid, public.payment_status, text, uuid, numeric, numeric)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Safe view: ciphertext columns are absent
-- ---------------------------------------------------------------------------

create view public.processor_connections_safe
with (security_invoker = true) as
select id, organization_id, provider, mode, status, created_at, updated_at
from public.processor_connections;

-- ---------------------------------------------------------------------------
-- RLS on every public table
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  for table_name in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.merchant_profiles to authenticated;
grant select on public.merchant_verification to authenticated;
grant select (id, organization_id, provider, mode, status, created_at, updated_at)
  on public.processor_connections to authenticated;
grant select on public.processor_connections_safe to authenticated;
grant select (id, organization_id, prefix, scopes, last_used_at, revoked_at, created_at)
  on public.api_keys to authenticated;
grant select on public.invoices to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_events to authenticated;
grant select, insert, update, delete on public.payment_links to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select (id, organization_id, url, events, active, created_at, updated_at),
      insert (id, organization_id, url, events, active),
      update (url, events, active)
  on public.webhook_endpoints to authenticated;
grant select on public.webhook_deliveries to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_records to authenticated;

create policy organizations_select on public.organizations
  for select to authenticated using (public.is_member(id));
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_member(id, array['owner', 'admin']))
  with check (public.is_member(id, array['owner', 'admin']));

create policy members_select on public.organization_members
  for select to authenticated using (public.is_member(organization_id));
create policy members_write on public.organization_members
  for all to authenticated
  using (public.is_member(organization_id, array['owner', 'admin']))
  with check (public.is_member(organization_id, array['owner', 'admin']));

create policy profiles_self on public.user_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy merchant_profiles_select on public.merchant_profiles
  for select to authenticated using (public.is_member(organization_id));
create policy merchant_profiles_write on public.merchant_profiles
  for all to authenticated
  using (public.is_member(organization_id, array['owner', 'admin']))
  with check (public.is_member(organization_id, array['owner', 'admin']));

create policy merchant_verification_select on public.merchant_verification
  for select to authenticated using (public.is_member(organization_id));

create policy processor_connections_select on public.processor_connections
  for select to authenticated using (public.is_member(organization_id));

create policy api_keys_select on public.api_keys
  for select to authenticated
  using (public.is_member(organization_id, array['owner', 'admin', 'developer']));

create policy invoices_select on public.invoices
  for select to authenticated using (public.is_member(organization_id));
create policy payments_select on public.payments
  for select to authenticated using (public.is_member(organization_id));
create policy payment_events_select on public.payment_events
  for select to authenticated using (public.is_member(organization_id));

create policy payment_links_select on public.payment_links
  for select to authenticated using (public.is_member(organization_id));
create policy payment_links_write on public.payment_links
  for all to authenticated
  using (public.is_member(organization_id, array['owner', 'admin', 'developer']))
  with check (public.is_member(organization_id, array['owner', 'admin', 'developer']));

create policy customers_select on public.customers
  for select to authenticated using (public.is_member(organization_id));
create policy customers_write on public.customers
  for all to authenticated
  using (public.is_member(organization_id, array['owner', 'admin', 'developer']))
  with check (public.is_member(organization_id, array['owner', 'admin', 'developer']));

create policy webhook_endpoints_select on public.webhook_endpoints
  for select to authenticated
  using (public.is_member(organization_id, array['owner', 'admin', 'developer']));
create policy webhook_endpoints_write on public.webhook_endpoints
  for all to authenticated
  using (public.is_member(organization_id, array['owner', 'admin', 'developer']))
  with check (public.is_member(organization_id, array['owner', 'admin', 'developer']));

create policy webhook_deliveries_select on public.webhook_deliveries
  for select to authenticated
  using (
    exists (
      select 1 from public.webhook_endpoints as endpoint
      where endpoint.id = webhook_deliveries.endpoint_id
        and public.is_member(endpoint.organization_id, array['owner', 'admin', 'developer'])
    )
  );

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (organization_id is not null and public.is_member(organization_id, array['owner', 'admin']));

create policy notification_preferences_self on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid() and public.is_member(organization_id))
  with check (user_id = auth.uid() and public.is_member(organization_id));

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.is_member(organization_id, array['owner', 'finance']));

create policy billing_records_select on public.billing_records
  for select to authenticated
  using (public.is_member(organization_id, array['owner', 'finance']));

-- provider_webhooks, idempotency_keys, and outbox_events: no authenticated policies.
-- Service role bypasses RLS. Clients cannot read ciphertext or raw provider payloads.
