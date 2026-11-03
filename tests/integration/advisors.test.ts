import { describe, expect, it } from 'vitest';
import { embeddedDatabase } from '../helpers/database.ts';

const OVERLAP_TABLES = [
  'customers',
  'merchant_profiles',
  'organization_members',
  'payment_links',
  'webhook_endpoints',
];

describe('supabase advisor migration', () => {
  it('pins search_path, hides is_member, and keeps RLS working', async () => {
    const db = await embeddedDatabase();
    const functions = await db.query<{ proname: string; config: string }>(
      `select proname, proconfig::text as config
       from pg_proc
       join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
       where nspname = 'public'
         and proname in ('set_updated_at', 'reject_mutation', 'guard_payment_status')`,
    );
    expect(functions.rows).toHaveLength(3);
    for (const row of functions.rows) {
      expect(row.config.replaceAll('\\"', '"'), row.proname).toContain('search_path=""');
    }

    const publicHelper = await db.query<{ count: string }>(
      `select count(*)::text as count
       from pg_proc
       join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
       where nspname = 'public' and proname = 'is_member'`,
    );
    expect(publicHelper.rows[0]?.count).toBe('0');

    const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const user = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await db.exec(`
      insert into auth.users (id) values ('${user}');
      insert into public.organizations (id, legal_name, display_name)
      values ('${org}', 'Alpha LLC', 'Alpha');
      insert into public.organization_members (organization_id, user_id, role)
      values ('${org}', '${user}', 'owner');
    `);
    await db.exec(`select set_config('request.jwt.claim.sub', '${user}', false)`);
    await db.exec('set role anon');
    await expect(db.query(`select private.is_member('${org}'::uuid)`)).rejects.toThrow(
      /permission denied/,
    );
    await db.exec('reset role');
    await db.exec('set role authenticated');
    const visible = await db.query<{ id: string }>(
      `select id::text as id from public.organizations`,
    );
    expect(visible.rows.map((row) => row.id)).toEqual([org]);
    await db.exec('reset role');

    await db.query(
      `update public.organizations set display_name = 'Alpha Updated' where id = '${org}'`,
    );
    const renamed = await db.query<{ display_name: string }>(
      `select display_name from public.organizations where id = '${org}'`,
    );
    expect(renamed.rows[0]?.display_name).toBe('Alpha Updated');
  });

  it('wraps auth.uid(), collapses overlapping policies, indexes foreign keys, and denies service tables', async () => {
    const db = await embeddedDatabase();
    const authUses = await db.query<{ qual: string | null; with_check: string | null }>(
      `select qual, with_check from pg_policies
       where schemaname = 'public'
         and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'auth\\.uid\\(\\)'`,
    );
    expect(authUses.rows.length).toBeGreaterThan(0);
    for (const row of authUses.rows) {
      const expression = `${row.qual ?? ''} ${row.with_check ?? ''}`;
      expect(expression.toLowerCase()).toMatch(/\(\s*select\s+auth\.uid\(\)/);
      expect(
        expression.replace(/\(\s*select\s+auth\.uid\(\)(?:\s+as\s+uid)?\s*\)/gi, ''),
      ).not.toMatch(/auth\.uid\(\)/);
    }

    const policies = await db.query<{
      tablename: string;
      policyname: string;
      cmd: string;
      roles: string;
    }>(
      `select tablename, policyname, cmd, roles::text as roles
       from pg_policies
       where schemaname = 'public' and permissive = 'PERMISSIVE'`,
    );
    const counts = new Map<string, number>();
    for (const policy of policies.rows) {
      const commands =
        policy.cmd === 'ALL' ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] : [policy.cmd];
      for (const command of commands) {
        const key = `${policy.tablename}:${policy.roles}:${command}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    for (const [key, count] of counts) {
      const table = key.split(':')[0] ?? '';
      if (OVERLAP_TABLES.includes(table)) {
        expect(count, key).toBe(1);
      }
    }
    for (const table of OVERLAP_TABLES) {
      const commands = policies.rows.filter((row) => row.tablename === table).map((row) => row.cmd);
      expect(commands, table).not.toContain('ALL');
    }

    const unindexed = await db.query<{ table_name: string; column_name: string }>(
      `select c.conrelid::regclass::text as table_name, a.attname as column_name
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       where c.contype = 'f'
         and c.connamespace = 'public'::regnamespace
         and cardinality(c.conkey) = 1
         and not exists (
           select 1
           from pg_index i
           where i.indrelid = c.conrelid
             and i.indisvalid
             and i.indpred is null
             and i.indkey[0] = c.conkey[1]
         )`,
    );
    expect(unindexed.rows).toEqual([]);

    for (const table of ['idempotency_keys', 'outbox_events', 'provider_webhooks']) {
      const comment = await db.query<{ description: string }>(
        `select obj_description($1::regclass) as description`,
        [`public.${table}`],
      );
      expect(comment.rows[0]?.description ?? '').toMatch(/service-role only/i);
      expect(comment.rows[0]?.description ?? '').toMatch(/denied/i);
      const policy = await db.query<{ count: string }>(
        `select count(*)::text as count from pg_policies
         where schemaname = 'public' and tablename = $1 and policyname like '%deny_clients'`,
        [table],
      );
      expect(policy.rows[0]?.count).toBe('1');
    }
  });
});
