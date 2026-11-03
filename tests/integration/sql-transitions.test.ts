import { ALLOWED_TRANSITIONS } from '@airexpay/payment-core';
import { PAYMENT_STATUSES, type PaymentStatus } from '@airexpay/shared';
import { describe, expect, it } from 'vitest';
import { embeddedDatabase } from '../helpers/database.ts';

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

async function database() {
  return embeddedDatabase();
}

describe('phase 1 SQL migration', () => {
  it('creates 21 RLS-protected tables and append-only history', async () => {
    const db = await database();
    const tables = await db.query<{ count: string }>(
      `select count(*)::text as count
       from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    expect(tables.rows[0]?.count).toBe('21');

    const rls = await db.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(rls.rows).toHaveLength(21);
    expect(rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);

    await db.exec(`
      insert into public.organizations (id, legal_name, display_name) values
        ('${ORG_A}', 'Alpha LLC', 'Alpha'),
        ('${ORG_B}', 'Beta LLC', 'Beta');
      insert into public.invoices (
        id, organization_id, public_id, number, price_amount, price_currency, provider, provider_invoice_id
      ) values (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '${ORG_A}', 'inv_sql', 'INV-1', 10, 'USD', 'mock', 'minv_1'
      );
      insert into public.payments (
        id, organization_id, invoice_id, provider, provider_payment_id, pay_amount, status, raw_status
      ) values (
        'ffffffff-ffff-4fff-8fff-ffffffffffff', '${ORG_A}',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'mock', 'mpay_1', 0.01, 'waiting', 'waiting'
      );
      insert into public.payment_events (payment_id, organization_id, from_status, to_status, source)
      values (
        'ffffffff-ffff-4fff-8fff-ffffffffffff', '${ORG_A}', null, 'waiting', 'mock'
      );
      insert into public.audit_logs (organization_id, action, target)
      values ('${ORG_A}', 'test', 'payment');
    `);

    await expect(db.exec(`update public.payment_events set source = 'admin'`)).rejects.toThrow(
      /append-only/,
    );
    await expect(db.exec(`delete from public.audit_logs`)).rejects.toThrow(/append-only/);
    await expect(
      db.exec(
        `update public.payments set status = 'failed' where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'`,
      ),
    ).rejects.toThrow(/apply_payment_event/);
  });

  it('applies the same transitions as the TypeScript table', async () => {
    const db = await database();
    await db.exec(`
      insert into public.organizations (id, legal_name, display_name)
      values ('${ORG_A}', 'Alpha LLC', 'Alpha');
      insert into public.invoices (
        id, organization_id, public_id, number, price_amount, price_currency, provider, provider_invoice_id
      ) values (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '${ORG_A}', 'inv_matrix', 'INV-1', 10, 'USD', 'mock', 'minv_matrix'
      );
    `);

    let n = 0;
    let forbidden = 0;
    for (const from of PAYMENT_STATUSES) {
      for (const to of PAYMENT_STATUSES) {
        n += 1;
        const paymentId = `10000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
        await db.exec(`
          insert into public.payments (
            id, organization_id, invoice_id, provider, provider_payment_id, pay_amount, actually_paid, status, raw_status
          ) values (
            '${paymentId}', '${ORG_A}', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            'mock', 'mpay_${n}', 1, 1, '${from}', '${from}'
          );
        `);
        const allowed = (ALLOWED_TRANSITIONS[from] as readonly PaymentStatus[]).includes(to);
        const sql = `select public.apply_payment_event('${paymentId}'::uuid, '${to}'::public.payment_status, 'ipn')`;
        if (from === to) {
          const result = await db.query<{ apply_payment_event: string | null }>(sql);
          expect(result.rows[0]?.apply_payment_event ?? null).toBeNull();
        } else if (allowed) {
          const result = await db.query<{ apply_payment_event: string | null }>(sql);
          expect(result.rows[0]?.apply_payment_event, `${from} -> ${to}`).toBeTruthy();
          if (to === 'finished') {
            const invoice = await db.query<{ status: string }>(
              `select status::text as status from public.invoices where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'`,
            );
            expect(invoice.rows[0]?.status).toBe('paid');
          }
          if (to === 'partially_paid') {
            const invoice = await db.query<{ status: string }>(
              `select status::text as status from public.invoices where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'`,
            );
            expect(invoice.rows[0]?.status).toBe('underpaid');
          }
        } else {
          forbidden += 1;
          const result = await db.query<{ apply_payment_event: string | null }>(sql);
          expect(result.rows[0]?.apply_payment_event ?? null, `${from} -> ${to}`).toBeNull();
          const status = await db.query<{ status: string }>(
            `select status::text as status from public.payments where id = '${paymentId}'`,
          );
          expect(status.rows[0]?.status, `${from} -> ${to}`).toBe(from);
        }
      }
    }

    const fulfillment = await db.query<{ count: string }>(
      `select count(*)::text as count from public.outbox_events where event_type = 'payment.finished'`,
    );
    const finishedTransitions = PAYMENT_STATUSES.filter((from) =>
      (ALLOWED_TRANSITIONS[from] as readonly PaymentStatus[]).includes('finished'),
    ).length;
    expect(fulfillment.rows[0]?.count).toBe(String(finishedTransitions));

    const audits = await db.query<{ count: string }>(
      `select count(*)::text as count from public.audit_logs where action = 'payment.transition_rejected'`,
    );
    expect(audits.rows[0]?.count).toBe(String(forbidden));
    expect(forbidden).toBeGreaterThan(0);
  });

  it('isolates invoice reads by organization membership', async () => {
    const db = await database();
    await db.exec(`
      insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');
      insert into public.organizations (id, legal_name, display_name) values
        ('${ORG_A}', 'Alpha LLC', 'Alpha'),
        ('${ORG_B}', 'Beta LLC', 'Beta');
      insert into public.organization_members (organization_id, user_id, role) values
        ('${ORG_A}', '${USER_A}', 'owner'),
        ('${ORG_B}', '${USER_B}', 'owner');
      insert into public.invoices (
        id, organization_id, public_id, number, price_amount, price_currency, provider, provider_invoice_id
      ) values
        ('11111111-1111-4111-8111-111111111111', '${ORG_A}', 'inv_a', 'INV-A', 5, 'USD', 'mock', 'a'),
        ('22222222-2222-4222-8222-222222222222', '${ORG_B}', 'inv_b', 'INV-B', 5, 'USD', 'mock', 'b');
      insert into public.processor_connections (organization_id, provider, mode, credentials_ciphertext)
      values ('${ORG_A}', 'mock', 'mock', '\\x0011');
    `);

    await db.exec(`select set_config('request.jwt.claim.sub', '${USER_A}', false)`);
    await db.exec('set role authenticated');
    const visible = await db.query<{ public_id: string }>(
      `select public_id from public.invoices order by public_id`,
    );
    expect(visible.rows.map((row) => row.public_id)).toEqual(['inv_a']);
    await expect(
      db.query(`select credentials_ciphertext from public.processor_connections`),
    ).rejects.toThrow(/permission denied/);
    const safe = await db.query<{ provider: string }>(
      `select provider from public.processor_connections_safe`,
    );
    expect(safe.rows.map((row) => row.provider)).toEqual(['mock']);
    await db.exec('reset role');
  });
});
