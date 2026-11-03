import { assertLocalDatabaseUrl, resolveStorageBackend } from '@airexpay/configuration';
import { MemoryDatabase } from './memory.ts';
import { PostgresRepository } from './postgres.ts';
import type { InvoiceRepository, SqlPool } from './repository.ts';

/**
 * `memory` is the default and the only backend the Worker isolate constructs.
 * `postgres` requires an injected local SQL client. This function never dials a host.
 */
export function selectRepository(input: {
  storageBackend?: string | undefined;
  databaseUrl?: string | undefined;
  sql?: SqlPool | undefined;
  memory?: MemoryDatabase | undefined;
}): InvoiceRepository {
  const backend = resolveStorageBackend(input.storageBackend);
  if (backend === 'memory') return input.memory ?? new MemoryDatabase();
  assertLocalDatabaseUrl(input.databaseUrl);
  if (!input.sql) {
    throw new Error(
      'STORAGE_BACKEND=postgres needs a local SQL client injected by the caller. This process does not open a database connection.',
    );
  }
  return new PostgresRepository(input.sql);
}
