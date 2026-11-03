import {
  assertSimulationEnvironment,
  parseAllowedModes,
  SIMULATION_IPN_SECRET,
  type ProviderMode,
} from '@airexpay/configuration';
import { ProviderError } from '@airexpay/payment-core';
import { Hono } from 'hono';
import type { MemoryDatabase } from './db/memory.ts';
import { errorBody, logEvent } from './http.ts';
import { createInvoice, getInvoice, type InvoiceDeps } from './services/invoices.ts';
import { handleNowPaymentsWebhook } from './services/webhooks.ts';

export interface AppConfig {
  db: MemoryDatabase;
  environment?: string | undefined;
  allowedModesRaw?: string | undefined;
  modeAEnv?: string | undefined;
  ipnSecret?: string | undefined;
  checkoutBaseUrl?: string | undefined;
}

type AppVariables = { requestId: string };

export function createApp(config: AppConfig) {
  assertSimulationEnvironment(config.environment);
  const allowedModes = parseAllowedModes(config.allowedModesRaw);
  const deps: InvoiceDeps = {
    db: config.db,
    ipnSecret: config.ipnSecret || SIMULATION_IPN_SECRET,
    allowedModes,
    modeAEnv: config.modeAEnv,
    checkoutBaseUrl: config.checkoutBaseUrl ?? 'http://localhost:5173',
  };

  const app = new Hono<{ Variables: AppVariables }>();

  app.use('*', async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const requestId = incoming && incoming.length <= 200 ? incoming : crypto.randomUUID();
    c.set('requestId', requestId);
    await next();
    c.header('X-Request-Id', requestId);
  });

  app.onError((error, c) => {
    const requestId = c.get('requestId') ?? crypto.randomUUID();
    if (error instanceof ProviderError) {
      logEvent({ level: 'error', msg: 'provider.error', request_id: requestId, code: error.code });
      return c.json(errorBody(requestId, 'provider_error', error.code, error.message), 502);
    }
    logEvent({
      level: 'error',
      msg: 'request.failed',
      request_id: requestId,
      error: error instanceof Error ? error.name : 'error',
    });
    return c.json(
      errorBody(requestId, 'api_error', 'internal_error', 'The request could not be completed'),
      500,
    );
  });

  app.get('/health', (c) => health(c, config.environment ?? 'dev', allowedModes));
  app.get('/api/health', (c) => health(c, config.environment ?? 'dev', allowedModes));

  app.post('/api/webhooks/nowpayments', (c) =>
    handleNowPaymentsWebhook(c, { db: deps.db, ipnSecret: deps.ipnSecret }),
  );

  app.post('/v1/invoices', (c) => createInvoice(c, deps));
  app.get('/v1/invoices/:id', (c) => getInvoice(c, deps));

  app.notFound((c) => {
    const requestId = c.get('requestId') ?? crypto.randomUUID();
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'not_found', 'Route not found'),
      404,
    );
  });

  return app;
}

function health(
  c: { json: (body: unknown, status?: number) => Response; get: (key: 'requestId') => string },
  environment: string,
  allowedModes: readonly ProviderMode[],
): Response {
  return c.json(
    {
      status: 'ok',
      service: 'airexpay-api',
      environment,
      mode: 'simulation',
      livemode: false,
      allowed_modes: allowedModes,
      mode_a_enabled: false,
      time: new Date().toISOString(),
      request_id: c.get('requestId'),
    },
    200,
  );
}
