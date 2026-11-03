export const RUNTIME_ENVIRONMENTS = ['production', 'staging', 'dev'] as const;

export type RuntimeEnvironment = (typeof RUNTIME_ENVIRONMENTS)[number];

export const SURFACES = ['marketing', 'app', 'pay', 'api', 'auth', 'docs', 'admin'] as const;

export type Surface = (typeof SURFACES)[number];

export interface OriginSet {
  marketing: string;
  app: string;
  pay: string;
  api: string;
  auth: string;
  docs: string;
  admin: string;
}

/**
 * Production hosts. Marketing is the apex and contains no dashboard or checkout code.
 * Pay is public. Auth is the only host that sets the session cookie.
 */
export const PRODUCTION_ORIGINS: OriginSet = {
  marketing: 'https://airexpay.com',
  app: 'https://app.airexpay.com',
  pay: 'https://pay.airexpay.com',
  api: 'https://api.airexpay.com',
  auth: 'https://auth.airexpay.com',
  docs: 'https://docs.airexpay.com',
  admin: 'https://admin.airexpay.com',
};

/**
 * Staging uses a -staging host for every app surface.
 * The apex exception is marketing, which stays https://staging.airexpay.com.
 * These hosts must not accept the production session cookie.
 */
export const STAGING_ORIGINS: OriginSet = {
  marketing: 'https://staging.airexpay.com',
  app: 'https://app-staging.airexpay.com',
  pay: 'https://pay-staging.airexpay.com',
  api: 'https://api-staging.airexpay.com',
  auth: 'https://auth-staging.airexpay.com',
  docs: 'https://docs-staging.airexpay.com',
  admin: 'https://admin-staging.airexpay.com',
};

/** Local combined preview. Override any origin with ORIGIN_* when the Workers are split. */
export const DEV_ORIGINS: OriginSet = {
  marketing: 'http://localhost:5173',
  app: 'http://localhost:5173',
  pay: 'http://localhost:5173',
  api: 'http://127.0.0.1:8787',
  auth: 'http://127.0.0.1:8788',
  docs: 'http://localhost:5173',
  admin: 'http://127.0.0.1:8789',
};

const ORIGIN_ENV_KEYS: Record<Surface, string> = {
  marketing: 'ORIGIN_MARKETING',
  app: 'ORIGIN_APP',
  pay: 'ORIGIN_PAY',
  api: 'ORIGIN_API',
  auth: 'ORIGIN_AUTH',
  docs: 'ORIGIN_DOCS',
  admin: 'ORIGIN_ADMIN',
};

export function isRuntimeEnvironment(value: string | undefined): value is RuntimeEnvironment {
  return value === 'production' || value === 'staging' || value === 'dev';
}

export function resolveRuntimeEnvironment(value: string | undefined): RuntimeEnvironment {
  if (value === 'production' || value === 'staging') return value;
  return 'dev';
}

export function defaultOrigins(environment: RuntimeEnvironment): OriginSet {
  if (environment === 'production') return PRODUCTION_ORIGINS;
  if (environment === 'staging') return STAGING_ORIGINS;
  return DEV_ORIGINS;
}

export function originsFromEnv(
  environment: RuntimeEnvironment,
  env: Record<string, string | undefined> = {},
): OriginSet {
  const defaults = defaultOrigins(environment);
  const next = { ...defaults };
  for (const surface of SURFACES) {
    const raw = env[ORIGIN_ENV_KEYS[surface]]?.trim();
    if (!raw) continue;
    assertOrigin(raw, ORIGIN_ENV_KEYS[surface]);
    next[surface] = raw.replace(/\/$/, '');
  }
  return next;
}

export function assertOrigin(value: string, name: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) origin`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} must be an absolute http(s) origin`);
  }
  if (url.username || url.password) {
    throw new Error(`${name} must not include credentials`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an origin without a path, query, or hash`);
  }
  if (url.protocol === 'http:' && !isLocalHost(url.hostname)) {
    throw new Error(`${name} may use http only for localhost`);
  }
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function originHost(origin: string): string {
  return new URL(origin).host;
}
