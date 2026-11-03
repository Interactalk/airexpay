import { assertLocalDatabaseUrl, resolveStorageBackend } from '@airexpay/configuration';
import type { WebhookSecretKeyring } from '@airexpay/payment-core';
import { DurableObjectRepository, type InvoiceStoreClient } from './durable-object-repository.ts';
import { MemoryDatabase } from './memory.ts';
import { PostgresRepository } from './postgres.ts';
import type { InvoiceRepository, SqlPool } from './repository.ts';

/**
 * `memory` is the default for unit tests and the local dev server.
 * `postgres` requires an injected local SQL client. This function never dials a host.
 * `durable_object` requires the INVOICE_STORE binding. It does not create one.
 */
export function selectRepository(input: {
  storageBackend?: string | undefined;
  databaseUrl?: string | undefined;
  sql?: SqlPool | undefined;
  memory?: MemoryDatabase | undefined;
  invoiceStore?: InvoiceStoreClient | undefined;
  webhookKeys?: WebhookSecretKeyring | undefined;
}): InvoiceRepository {
  const backend = resolveStorageBackend(input.storageBackend);
  const keys = input.webhookKeys ?? {};
  if (backend === 'memory') return input.memory ?? new MemoryDatabase(keys);
  if (backend === 'durable_object') {
    if (!input.invoiceStore) {
      throw new Error(
        'STORAGE_BACKEND=durable_object requires the INVOICE_STORE binding. This process does not create a Durable Object namespace.',
      );
    }
    return new DurableObjectRepository(input.invoiceStore);
  }
  assertLocalDatabaseUrl(input.databaseUrl);
  if (!input.sql) {
    throw new Error(
      'STORAGE_BACKEND=postgres needs a local SQL client injected by the caller. This process does not open a database connection.',
    );
  }
  return new PostgresRepository(input.sql, keys);
}
