import {
  assertLocalDatabaseUrl,
  isExactlyMockMode,
  parseAllowedModes,
  parseLivemode,
  resolveCheckoutBaseUrl,
  resolveStorageBackend,
  simulationCheckoutAllowed,
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
    expect(resolveStorageBackend('durable_object')).toBe('durable_object');
    expect(() => selectRepository({ storageBackend: 'durable_object' })).toThrow(/INVOICE_STORE/);
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

describe('simulation checkout access', () => {
  it('allows dev, and staging only when the mode list is exactly mock and livemode is false', () => {
    expect(parseLivemode(undefined)).toBe(false);
    expect(parseLivemode('false')).toBe(false);
    expect(parseLivemode('true')).toBe(true);
    expect(isExactlyMockMode(parseAllowedModes('mock'))).toBe(true);
    expect(isExactlyMockMode(parseAllowedModes('mock,mock'))).toBe(true);
    expect(isExactlyMockMode(parseAllowedModes('mock,nowpayments_direct'))).toBe(false);
    const allow = (environment: string, modes: string, livemode: boolean) =>
      simulationCheckoutAllowed({
        environment,
        allowedModes: parseAllowedModes(modes),
        livemode,
      });
    expect(allow('dev', 'mock', false)).toBe(true);
    expect(allow('staging', 'mock', false)).toBe(true);
    expect(allow('staging', 'mock,nowpayments_direct', false)).toBe(false);
    expect(allow('staging', 'nowpayments_direct', false)).toBe(false);
    expect(allow('staging', 'mock', true)).toBe(false);
    expect(allow('dev', 'mock', true)).toBe(false);
    expect(allow('production', 'mock', false)).toBe(false);
    expect(allow('test', 'mock', false)).toBe(false);
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
