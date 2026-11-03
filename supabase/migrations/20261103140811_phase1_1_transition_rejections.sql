-- Phase 1.1. Do not edit 20261103120000_phase1_foundation.sql; it is already applied.
-- A forbidden transition used to raise, which rolled the statement back and
-- left no audit row. It now inserts payment.transition_rejected and returns null.
-- The payment row is unchanged. search_path is empty so the body is schema-qualified.

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
set search_path = ''
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
    insert into public.audit_logs (organization_id, action, target, metadata)
    values (
      v_pay.organization_id,
      'payment.transition_rejected',
      v_pay.id::text,
      pg_catalog.jsonb_build_object(
        'from', v_pay.status,
        'to', p_to_status,
        'source', p_source
      )
    );
    return null;
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

  perform pg_catalog.set_config('airexpay.apply_payment_event', 'on', true);
  update public.payments
    set status = p_to_status,
        raw_status = p_to_status::text,
        pay_amount = v_pay_amount,
        actually_paid = v_actually,
        updated_at = pg_catalog.now()
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
    pg_catalog.jsonb_build_object(
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
      pg_catalog.jsonb_build_object('payment_id', v_pay.id, 'invoice_status', 'paid')
    );
  elsif p_to_status = 'partially_paid' then
    insert into public.outbox_events (organization_id, event_type, payload)
    values (
      v_pay.organization_id,
      'invoice.underpaid',
      pg_catalog.jsonb_build_object('payment_id', v_pay.id, 'invoice_status', 'underpaid')
    );
  end if;

  return v_event_id;
end;
$$;

comment on function public.apply_payment_event(uuid, public.payment_status, text, uuid, numeric, numeric) is
  'Applies an allowed payment transition. A forbidden transition inserts audit_logs payment.transition_rejected and returns null. Status is not changed.';

revoke all on function public.apply_payment_event(uuid, public.payment_status, text, uuid, numeric, numeric)
  from public, anon, authenticated;
