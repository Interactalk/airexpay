import { resolveCheckoutBaseUrl } from '@airexpay/configuration';
import { createApp } from './app.ts';
import { MemoryDatabase } from './db/memory.ts';
import { selectRepository } from './db/select.ts';
import type { InvoiceRepository } from './db/repository.ts';

/**
 * Simulation-only isolate cache. Not durable, not shared across isolates,
 * and not a substitute for Postgres. See docs/KNOWN_LIMITATIONS.md.
 */
let simulationDb: MemoryDatabase | undefined;

function database(env: Env): InvoiceRepository {
  const backend = env.STORAGE_BACKEND?.trim() || 'memory';
  if (backend === 'memory') {
    simulationDb ??= new MemoryDatabase();
    return simulationDb;
  }
  return selectRepository({
    storageBackend: backend,
    databaseUrl: env.DATABASE_URL,
  });
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    const app = createApp({
      db: database(env),
      environment: env.ENVIRONMENT,
      allowedModesRaw: env.ALLOWED_MODES,
      modeAEnv: env.NOWPAYMENTS_MODE_A_ENABLED,
      ipnSecret: env.SIMULATION_IPN_SECRET,
      checkoutBaseUrl: resolveCheckoutBaseUrl(env.ENVIRONMENT, env.PUBLIC_CHECKOUT_BASE_URL),
    });
    return app.fetch(request);
  },
} satisfies ExportedHandler<Env>;
