import {
  assertLocalDatabaseUrl,
  resolveCheckoutBaseUrl,
  resolveStorageBackend,
  stagingApiOrigin,
  stagingCheckoutOrigin,
} from '@airexpay/configuration';
import { describe, expect, it } from 'vitest';
import { selectRepository } from '../../apps/api/src/db/select.ts';
import { MemoryDatabase } from '../../apps/api/src/db/memory.ts';
import { PostgresRepository } from '../../apps/api/src/db/postgres.ts';
import { joinApiUrl } from '../../apps/web/src/apiBase.ts';

describe('storage backend selection', () => {
  it('defaults to the in-memory database', () => {
    expect(resolveStorageBackend(undefined)).toBe('memory');
    expect(resolveStorageBackend('')).toBe('memory');
    const selected = selectRepository({});
    expect(selected).toBeInstanceOf(MemoryDatabase);
  });

  it('refuses hosted database URLs and does not open a connection', () => {
    const sql = {
      query: () => Promise.reject(new Error('should not query')),
      transaction: () => Promise.reject(new Error('should not connect')),
    };
    expect(() =>
      selectRepository({
        storageBackend: 'postgres',
        databaseUrl: 'postgres://example.supabase.co/postgres',
        sql,
      }),
    ).toThrow(/localhost/);
    expect(() => selectRepository({ storageBackend: 'postgres', databaseUrl: '' })).toThrow(
      /localhost/,
    );
    expect(() => resolveStorageBackend('sqlite')).toThrow(/Unknown STORAGE_BACKEND/);
  });

  it('accepts an injected localhost client without dialing', () => {
    assertLocalDatabaseUrl('postgres://localhost/airexpay');
    const sql: {
      query: () => Promise<{ rows: [] }>;
      transaction: <T>(
        run: (tx: { query: () => Promise<{ rows: [] }> }) => Promise<T>,
      ) => Promise<T>;
    } = {
      query: () => Promise.resolve({ rows: [] }),
      transaction: (run) => run(sql),
    };
    const selected = selectRepository({
      storageBackend: 'postgres',
      databaseUrl: 'postgres://127.0.0.1/airexpay',
      sql,
    });
    expect(selected).toBeInstanceOf(PostgresRepository);
  });
});

describe('public URLs', () => {
  it('uses the staging checkout and API origins when configured', () => {
    expect(stagingCheckoutOrigin()).toBe('https://staging.airexpay.com');
    expect(stagingApiOrigin()).toBe('https://api-staging.airexpay.com');
    expect(resolveCheckoutBaseUrl('staging', stagingCheckoutOrigin())).toBe(
      'https://staging.airexpay.com',
    );
    expect(resolveCheckoutBaseUrl('dev', undefined)).toBe('http://localhost:5173');
    expect(() => resolveCheckoutBaseUrl('staging', undefined)).toThrow(/PUBLIC_CHECKOUT_BASE_URL/);
    expect(joinApiUrl(stagingApiOrigin(), '/v1/checkout/inv_1')).toBe(
      'https://api-staging.airexpay.com/v1/checkout/inv_1',
    );
    expect(joinApiUrl(undefined, '/v1/checkout/inv_1')).toBe('/v1/checkout/inv_1');
    expect(joinApiUrl('https://api-staging.airexpay.com/', '/health')).toBe(
      'https://api-staging.airexpay.com/health',
    );
  });
});
