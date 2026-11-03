import {
  isProductionEnvironment,
  parseLivemode,
  resolveCheckoutBaseUrl,
  resolveStorageBackend,
} from '@airexpay/configuration';
import { webhookKeyring } from '@airexpay/payment-core';
import { createApp } from './app.ts';
import { DurableObjectRateLimit, DurableObjectRepository } from './db/durable-object-repository.ts';
import { InvoiceStore } from './db/invoice-store.ts';
import { MemoryDatabase } from './db/memory.ts';
import { selectRepository } from './db/select.ts';
import type { InvoiceRepository } from './db/repository.ts';
import { errorBody } from './http.ts';
import { MemoryRateLimiter, type SimulationRateLimit } from './rate-limit.ts';

export { InvoiceStore };

/**
 * In-memory simulation state for STORAGE_BACKEND=memory.
 * One isolate only. Staging uses InvoiceStore instead.
 */
let simulationDb: MemoryDatabase | undefined;
let memoryLimiter: MemoryRateLimiter | undefined;

function database(env: Env): InvoiceRepository {
  const backend = resolveStorageBackend(env.STORAGE_BACKEND);
  const keys = webhookKeyring(
    env.WEBHOOK_SECRET_ENCRYPTION_KEY,
    env.WEBHOOK_SECRET_ENCRYPTION_KEY_PREVIOUS,
  );
  if (backend === 'memory') {
    simulationDb ??= new MemoryDatabase(keys);
    return simulationDb;
  }
  if (backend === 'durable_object') {
    return new DurableObjectRepository(env.INVOICE_STORE);
  }
  return selectRepository({
    storageBackend: backend,
    databaseUrl: env.DATABASE_URL,
    webhookKeys: keys,
  });
}

function rateLimit(env: Env): SimulationRateLimit {
  if (resolveStorageBackend(env.STORAGE_BACKEND) === 'durable_object') {
    return new DurableObjectRateLimit(env.INVOICE_STORE);
  }
  memoryLimiter ??= new MemoryRateLimiter();
  return memoryLimiter;
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    if (isProductionEnvironment(env.ENVIRONMENT)) {
      return Response.json(
        errorBody(
          crypto.randomUUID(),
          'invalid_request_error',
          'not_authorized',
          'Production is not authorized',
        ),
        { status: 403 },
      );
    }
    const app = createApp({
      db: database(env),
      environment: env.ENVIRONMENT,
      allowedModesRaw: env.ALLOWED_MODES,
      modeAEnv: env.NOWPAYMENTS_MODE_A_ENABLED,
      ipnSecret: env.SIMULATION_IPN_SECRET,
      checkoutBaseUrl: resolveCheckoutBaseUrl(env.ENVIRONMENT, env.PUBLIC_CHECKOUT_BASE_URL),
      livemode: parseLivemode(env.LIVEMODE),
      rateLimit: rateLimit(env),
    });
    return app.fetch(request);
  },
} satisfies ExportedHandler<Env>;
