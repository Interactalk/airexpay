-- Supabase advisor follow-ups for the dev project.
-- Do not edit 20261103120000_phase1_foundation.sql; it is already applied.
-- This file is not applied to a hosted database by the app. Test it with embedded Postgres.

-- ---------------------------------------------------------------------------
-- 0011 function_search_path_mutable
-- Empty search_path. These bodies only use trigger variables or pg_catalog.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function public.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

create or replace function public.guard_payment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and pg_catalog.current_setting('airexpay.apply_payment_event', true) is distinct from 'on' then
    raise exception 'payments.status is updated only by apply_payment_event()';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0028 / 0029 security definer executable by anon or authenticated.
-- Revoking EXECUTE on public.is_member breaks RLS: policies run as the caller
-- and Postgres requires EXECUTE. Move the helper to schema private, which is
-- not part of the Data API exposed schemas. anon and PUBLIC cannot execute it.
-- authenticated can, because the policies call it. Do not expose private.
-- ---------------------------------------------------------------------------

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

comment on schema private is
  'RLS helpers only. Do not add private to the Supabase Data API exposed schemas.';

create or replace function private.is_member(org uuid, roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = org
      and member.user_id = (select auth.uid())
      and (roles is null or member.role::text = any (roles))
  );
$$;

revoke all on function private.is_member(uuid, text[]) from public, anon;
grant execute on function private.is_member(uuid, text[]) to authenticated;

comment on function private.is_member(uuid, text[]) is
  'RLS helper. Executable by authenticated so policies can call it. Not an API endpoint.';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema private to service_role';
    execute 'grant execute on function private.is_member(uuid, text[]) to service_role';
  end if;
end $$;

-- Policies must be dropped before public.is_member, then recreated against private.is_member.
-- auth.uid() is wrapped as (select auth.uid()) so the planner can initplan it (0003).
-- FOR ALL policies that overlapped SELECT are split into insert/update/delete (0006).

drop policy if exists organizations_select on public.organizations;
drop policy if exists organizations_update on public.organizations;
drop policy if exists members_select on public.organization_members;
drop policy if exists members_write on public.organization_members;
drop policy if exists profiles_self on public.user_profiles;
drop policy if exists merchant_profiles_select on public.merchant_profiles;
drop policy if exists merchant_profiles_write on public.merchant_profiles;
drop policy if exists merchant_verification_select on public.merchant_verification;
drop policy if exists processor_connections_select on public.processor_connections;
drop policy if exists api_keys_select on public.api_keys;
drop policy if exists invoices_select on public.invoices;
drop policy if exists payments_select on public.payments;
drop policy if exists payment_events_select on public.payment_events;
drop policy if exists payment_links_select on public.payment_links;
drop policy if exists payment_links_write on public.payment_links;
drop policy if exists customers_select on public.customers;
drop policy if exists customers_write on public.customers;
drop policy if exists webhook_endpoints_select on public.webhook_endpoints;
drop policy if exists webhook_endpoints_write on public.webhook_endpoints;
drop policy if exists webhook_deliveries_select on public.webhook_deliveries;
drop policy if exists audit_logs_select on public.audit_logs;
drop policy if exists notification_preferences_self on public.notification_preferences;
drop policy if exists subscriptions_select on public.subscriptions;
drop policy if exists billing_records_select on public.billing_records;

drop function public.is_member(uuid, text[]);

create policy organizations_select on public.organizations
  for select to authenticated using (private.is_member(id));
create policy organizations_update on public.organizations
  for update to authenticated
  using (private.is_member(id, array['owner', 'admin']))
  with check (private.is_member(id, array['owner', 'admin']));

create policy members_select on public.organization_members
  for select to authenticated using (private.is_member(organization_id));
create policy members_insert on public.organization_members
  for insert to authenticated
  with check (private.is_member(organization_id, array['owner', 'admin']));
create policy members_update on public.organization_members
  for update to authenticated
  using (private.is_member(organization_id, array['owner', 'admin']))
  with check (private.is_member(organization_id, array['owner', 'admin']));
create policy members_delete on public.organization_members
  for delete to authenticated
  using (private.is_member(organization_id, array['owner', 'admin']));

create policy profiles_self on public.user_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy merchant_profiles_select on public.merchant_profiles
  for select to authenticated using (private.is_member(organization_id));
create policy merchant_profiles_insert on public.merchant_profiles
  for insert to authenticated
  with check (private.is_member(organization_id, array['owner', 'admin']));
create policy merchant_profiles_update on public.merchant_profiles
  for update to authenticated
  using (private.is_member(organization_id, array['owner', 'admin']))
  with check (private.is_member(organization_id, array['owner', 'admin']));
create policy merchant_profiles_delete on public.merchant_profiles
  for delete to authenticated
  using (private.is_member(organization_id, array['owner', 'admin']));

create policy merchant_verification_select on public.merchant_verification
  for select to authenticated using (private.is_member(organization_id));

create policy processor_connections_select on public.processor_connections
  for select to authenticated using (private.is_member(organization_id));

create policy api_keys_select on public.api_keys
  for select to authenticated
  using (private.is_member(organization_id, array['owner', 'admin', 'developer']));

create policy invoices_select on public.invoices
  for select to authenticated using (private.is_member(organization_id));
create policy payments_select on public.payments
  for select to authenticated using (private.is_member(organization_id));
create policy payment_events_select on public.payment_events
  for select to authenticated using (private.is_member(organization_id));

create policy payment_links_select on public.payment_links
  for select to authenticated using (private.is_member(organization_id));
create policy payment_links_insert on public.payment_links
  for insert to authenticated
  with check (private.is_member(organization_id, array['owner', 'admin', 'developer']));
create policy payment_links_update on public.payment_links
  for update to authenticated
  using (private.is_member(organization_id, array['owner', 'admin', 'developer']))
  with check (private.is_member(organization_id, array['owner', 'admin', 'developer']));
create policy payment_links_delete on public.payment_links
  for delete to authenticated
  using (private.is_member(organization_id, array['owner', 'admin', 'developer']));

create policy customers_select on public.customers
  for select to authenticated using (private.is_member(organization_id));
create policy customers_insert on public.customers
  for insert to authenticated
  with check (private.is_member(organization_id, array['owner', 'admin', 'developer']));
create policy customers_update on public.customers
  for update to authenticated
  using (private.is_member(organization_id, array['owner', 'admin', 'developer']))
  with check (private.is_member(organization_id, array['owner', 'admin', 'developer']));
create policy customers_delete on public.customers
  for delete to authenticated
  using (private.is_member(organization_id, array['owner', 'admin', 'developer']));

create policy webhook_endpoints_select on public.webhook_endpoints
  for select to authenticated
  using (private.is_member(organization_id, array['owner', 'admin', 'developer']));
create policy webhook_endpoints_insert on public.webhook_endpoints
  for insert to authenticated
  with check (private.is_member(organization_id, array['owner', 'admin', 'developer']));
create policy webhook_endpoints_update on public.webhook_endpoints
  for update to authenticated
  using (private.is_member(organization_id, array['owner', 'admin', 'developer']))
  with check (private.is_member(organization_id, array['owner', 'admin', 'developer']));
create policy webhook_endpoints_delete on public.webhook_endpoints
  for delete to authenticated
  using (private.is_member(organization_id, array['owner', 'admin', 'developer']));

create policy webhook_deliveries_select on public.webhook_deliveries
  for select to authenticated
  using (
    exists (
      select 1 from public.webhook_endpoints as endpoint
      where endpoint.id = webhook_deliveries.endpoint_id
        and private.is_member(endpoint.organization_id, array['owner', 'admin', 'developer'])
    )
  );

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (organization_id is not null and private.is_member(organization_id, array['owner', 'admin']));

create policy notification_preferences_self on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()) and private.is_member(organization_id))
  with check (user_id = (select auth.uid()) and private.is_member(organization_id));

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (private.is_member(organization_id, array['owner', 'finance']));

create policy billing_records_select on public.billing_records
  for select to authenticated
  using (private.is_member(organization_id, array['owner', 'finance']));

-- ---------------------------------------------------------------------------
-- 0001 unindexed foreign keys. Leading columns already covered by a primary
-- key or unique index are left alone.
-- ---------------------------------------------------------------------------

create index processor_connections_organization_id_idx
  on public.processor_connections (organization_id);
create index api_keys_organization_id_idx
  on public.api_keys (organization_id);
create index payments_invoice_id_idx
  on public.payments (invoice_id);
create index payment_events_payment_id_idx
  on public.payment_events (payment_id);
create index payment_events_organization_id_idx
  on public.payment_events (organization_id);
create index payment_events_provider_webhook_id_idx
  on public.payment_events (provider_webhook_id);
create index provider_webhooks_connection_id_idx
  on public.provider_webhooks (connection_id);
create index payment_links_organization_id_idx
  on public.payment_links (organization_id);
create index customers_organization_id_idx
  on public.customers (organization_id);
create index webhook_endpoints_organization_id_idx
  on public.webhook_endpoints (organization_id);
create index webhook_deliveries_outbox_event_id_idx
  on public.webhook_deliveries (outbox_event_id);
create index audit_logs_organization_id_idx
  on public.audit_logs (organization_id);
create index billing_records_organization_id_idx
  on public.billing_records (organization_id);
create index outbox_events_organization_id_idx
  on public.outbox_events (organization_id);

-- ---------------------------------------------------------------------------
-- 0008 rls enabled, no policy. These three tables are service-role only.
-- A single deny policy makes that explicit. The service role bypasses RLS.
-- Comments state the same rule for reviewers.
-- ---------------------------------------------------------------------------

comment on table public.idempotency_keys is
  'Service-role only. anon and authenticated are denied. Do not add a permissive client policy.';
comment on table public.outbox_events is
  'Service-role only. anon and authenticated are denied. The outbox worker uses the service role. Do not add a permissive client policy.';
comment on table public.provider_webhooks is
  'Service-role only. anon and authenticated are denied. Raw provider payloads stay off the Data API. Do not add a permissive client policy.';

create policy idempotency_keys_deny_clients on public.idempotency_keys
  for all to anon, authenticated
  using (false)
  with check (false);
create policy outbox_events_deny_clients on public.outbox_events
  for all to anon, authenticated
  using (false)
  with check (false);
create policy provider_webhooks_deny_clients on public.provider_webhooks
  for all to anon, authenticated
  using (false)
  with check (false);
