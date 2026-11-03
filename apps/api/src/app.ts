import {
  parseAllowedModes,
  resolveCheckoutBaseUrl,
  simulationCheckoutAllowed,
  SIMULATION_IPN_SECRET,
  type ProviderMode,
} from '@airexpay/configuration';
import { ProviderError, randomDocumentKey } from '@airexpay/payment-core';
import { Hono } from 'hono';
import { MemoryDatabase } from './db/memory.ts';
import type { OnboardingSnapshot } from './db/onboarding-store.ts';
import type { InvoiceRepository } from './db/repository.ts';
import { errorBody, logEvent } from './http.ts';
import { MemoryRateLimiter, type SimulationRateLimit } from './rate-limit.ts';
import { createDevCheckout, getPublicCheckout, simulateDevCheckout } from './services/checkout.ts';
import { createInvoice, getInvoice, type InvoiceDeps } from './services/invoices.ts';
import { handleOnboarding } from './services/onboarding-routes.ts';
import type { OnboardingDeps } from './services/onboarding.ts';
import { handleNowPaymentsWebhook } from './services/webhooks.ts';

export interface AppConfig {
  db: InvoiceRepository;
  environment?: string | undefined;
  allowedModesRaw?: string | undefined;
  modeAEnv?: string | undefined;
  ipnSecret?: string | undefined;
  checkoutBaseUrl?: string | undefined;
  livemode?: boolean | undefined;
  rateLimit?: SimulationRateLimit | undefined;
  onboardingStore?: MemoryDatabase | undefined;
  loadOnboarding?: (() => Promise<OnboardingSnapshot>) | undefined;
  saveOnboarding?: ((snapshot: OnboardingSnapshot) => Promise<void>) | undefined;
  documentKey?: string | undefined;
}

type AppVariables = { requestId: string };

export function createApp(config: AppConfig) {
  const environment = config.environment ?? 'dev';
  const allowedModes = parseAllowedModes(config.allowedModesRaw);
  const livemode = config.livemode ?? false;
  const deps: InvoiceDeps = {
    db: config.db,
    ipnSecret: config.ipnSecret || SIMULATION_IPN_SECRET,
    allowedModes,
    modeAEnv: config.modeAEnv,
    checkoutBaseUrl: resolveCheckoutBaseUrl(environment, config.checkoutBaseUrl),
    environment,
    livemode,
    rateLimit: config.rateLimit ?? new MemoryRateLimiter(),
  };

  const app = new Hono<{ Variables: AppVariables }>();

  app.use('*', async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const requestId = incoming && incoming.length <= 200 ? incoming : crypto.randomUUID();
    c.set('requestId', requestId);
    const origin = c.req.header('origin');
    if (origin && origin === deps.checkoutBaseUrl) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header(
        'Access-Control-Allow-Headers',
        'authorization, content-type, idempotency-key, x-request-id',
      );
      c.header('Access-Control-Expose-Headers', 'x-request-id, idempotency-replayed');
      c.header('Access-Control-Max-Age', '600');
    }
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }
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

  app.get('/health', (c) => health(c, environment, allowedModes, livemode));
  app.get('/api/health', (c) => health(c, environment, allowedModes, livemode));

  app.post('/api/webhooks/nowpayments', (c) =>
    handleNowPaymentsWebhook(c, { db: deps.db, ipnSecret: deps.ipnSecret }),
  );

  app.post('/v1/invoices', (c) => createInvoice(c, deps));
  app.get('/v1/invoices/:id', (c) => getInvoice(c, deps));
  app.get('/v1/checkout/:publicId', (c) => getPublicCheckout(c, deps));

  app.post('/api/dev/checkout/invoices', (c) =>
    createDevCheckout(c, deps, (request) => app.request(request)),
  );
  app.post('/api/dev/checkout/:publicId/simulate', (c) =>
    simulateDevCheckout(c, deps, (request) => app.request(request)),
  );

  const onboarding = onboardingDeps(config, allowedModes, livemode, environment);
  app.post('/v1/onboarding/signup', (c) => handleOnboarding(c, onboarding, 'signup'));
  app.post('/v1/onboarding/verify-email', (c) => handleOnboarding(c, onboarding, 'verify'));
  app.get('/v1/onboarding', (c) => handleOnboarding(c, onboarding, 'get'));
  app.patch('/v1/onboarding/steps/:step', (c) => handleOnboarding(c, onboarding, 'step'));
  app.post('/v1/onboarding/documents', (c) => handleOnboarding(c, onboarding, 'upload'));
  app.get('/v1/onboarding/documents/:documentId', (c) =>
    handleOnboarding(c, onboarding, 'download'),
  );
  app.post('/v1/onboarding/submit', (c) => handleOnboarding(c, onboarding, 'submit'));
  app.post('/v1/onboarding/resubmit', (c) => handleOnboarding(c, onboarding, 'resubmit'));
  app.post('/api/dev/onboarding/admin-session', (c) =>
    handleOnboarding(c, onboarding, 'admin-session'),
  );
  app.post('/api/dev/onboarding/:organizationId/simulate', (c) =>
    handleOnboarding(c, onboarding, 'simulate'),
  );

  app.notFound((c) => {
    const requestId = c.get('requestId') ?? crypto.randomUUID();
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'not_found', 'Route not found'),
      404,
    );
  });

  return app;
}

let ephemeralDocumentKey: string | undefined;

function onboardingDeps(
  config: AppConfig,
  allowedModes: readonly ProviderMode[],
  livemode: boolean,
  environment: string,
): OnboardingDeps {
  const store =
    config.onboardingStore ??
    (config.db instanceof MemoryDatabase ? config.db : new MemoryDatabase());
  if (!config.documentKey) ephemeralDocumentKey ??= randomDocumentKey();
  return {
    db: store,
    documentKey: config.documentKey ?? ephemeralDocumentKey ?? randomDocumentKey(),
    simulation: simulationCheckoutAllowed({ environment, allowedModes, livemode }),
    ...(config.loadOnboarding ? { load: config.loadOnboarding } : {}),
    ...(config.saveOnboarding ? { save: config.saveOnboarding } : {}),
  };
}

function health(
  c: { json: (body: unknown, status?: number) => Response; get: (key: 'requestId') => string },
  environment: string,
  allowedModes: readonly ProviderMode[],
  livemode: boolean,
): Response {
  return c.json(
    {
      status: 'ok',
      service: 'airexpay-api',
      environment,
      mode: 'simulation',
      livemode,
      allowed_modes: allowedModes,
      mode_a_enabled: false,
      time: new Date().toISOString(),
      request_id: c.get('requestId'),
    },
    200,
  );
}
