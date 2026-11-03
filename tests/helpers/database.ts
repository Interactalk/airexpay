import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));

export const AUTH_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key,
    email text
  );
  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end $$;
  grant anon to current_user;
  grant authenticated to current_user;
`;

export async function applyMigrations(db: PGlite): Promise<void> {
  await db.exec(AUTH_STUB);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const name of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, name), 'utf8'));
  }
}

export async function embeddedDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await applyMigrations(db);
  return db;
}
