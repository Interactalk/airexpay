-- Phase 1.4 onboarding tables. Local migration file only.
-- Do not apply this to a hosted Supabase project from this change.
-- Document bytes are AES-GCM ciphertext. They are not public.
-- A later private R2 object can replace the ciphertext column.
-- How long rows are kept, and which KYC provider reviews them, is TODO for legal review.

create type public.onboarding_status as enum (
  'not_started',
  'in_progress',
  'submitted',
  'under_review',
  'needs_more_info',
  'approved',
  'rejected'
);

create table public.onboarding_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  status public.onboarding_status not null default 'not_started',
  step text not null default 'account',
  email text not null,
  email_verified boolean not null default false,
  business jsonb,
  representative jsonb,
  owners jsonb not null default '[]'::jsonb,
  no_ubo boolean not null default false,
  identity_document_type text,
  consents jsonb,
  needs_more_info jsonb not null default '[]'::jsonb,
  provider text not null default 'mock',
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  application_id uuid not null references public.onboarding_applications (id),
  kind text not null,
  content_type text not null,
  byte_length integer not null check (byte_length > 0 and byte_length <= 10485760),
  ciphertext bytea not null,
  created_at timestamptz not null default now()
);

comment on column public.onboarding_documents.ciphertext is
  'AES-GCM ciphertext. Not public. A private R2 object may replace this column later.';

create table public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  application_id uuid not null references public.onboarding_applications (id),
  from_status public.onboarding_status,
  to_status public.onboarding_status not null,
  action text not null,
  actor text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.onboarding_applications enable row level security;
alter table public.onboarding_applications force row level security;
alter table public.onboarding_documents enable row level security;
alter table public.onboarding_documents force row level security;
alter table public.onboarding_events enable row level security;
alter table public.onboarding_events force row level security;

create policy onboarding_applications_member_select
  on public.onboarding_applications
  for select
  to authenticated
  using ((select private.is_member(organization_id, array['owner', 'admin'])));

create policy onboarding_documents_member_select
  on public.onboarding_documents
  for select
  to authenticated
  using ((select private.is_member(organization_id, array['owner', 'admin'])));

create policy onboarding_events_member_select
  on public.onboarding_events
  for select
  to authenticated
  using ((select private.is_member(organization_id, array['owner', 'admin'])));

create index onboarding_applications_organization_id_idx
  on public.onboarding_applications (organization_id);
create index onboarding_documents_organization_id_idx
  on public.onboarding_documents (organization_id);
create index onboarding_documents_application_id_idx
  on public.onboarding_documents (application_id);
create index onboarding_events_organization_id_idx
  on public.onboarding_events (organization_id);
create index onboarding_events_application_id_idx
  on public.onboarding_events (application_id);

revoke all on public.onboarding_applications from anon;
revoke all on public.onboarding_documents from anon;
revoke all on public.onboarding_events from anon;
