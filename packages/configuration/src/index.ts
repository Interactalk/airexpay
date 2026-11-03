import { defaultOrigins } from '@airexpay/config';

export * from './pricing.ts';

export const PROVIDER_MODES = ['mock', 'nowpayments_direct', 'nowpayments_platform'] as const;

export type ProviderMode = (typeof PROVIDER_MODES)[number];

/**
 * Compile-time kill switch for NOWPayments Mode A (platform / sub-partner).
 * Typed as boolean so callers cannot "turn it on" by editing an env var.
 * Do not set this to true without written provider approval and counsel sign-off.
 */
export const MODE_A_FEATURE_FLAG: boolean = false;

/** Public in-memory placeholders. Not credentials. Safe to publish. */
export const SIMULATION_API_KEYS = {
  alpha: 'ak_test_simulation_alpha',
  beta: 'ak_test_simulation_beta_',
} as const;

export const SIMULATION_IPN_SECRET = 'simulation-ipn-secret';

/** Public simulation email code. Not a credential. Accepted only on dev and staging mock routes. */
export const SIMULATION_EMAIL_CODE = '000000';

export const SIMULATION_ORG_IDS = {
  alpha: '11111111-1111-4111-8111-111111111111',
  beta: '22222222-2222-4222-8222-222222222222',
} as const;

export function isProviderMode(value: string): value is ProviderMode {
  return (PROVIDER_MODES as readonly string[]).includes(value);
}

export function parseAllowedModes(raw: string | undefined): ProviderMode[] {
  const parts = (raw ?? 'mock')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return ['mock'];
  }
  const modes: ProviderMode[] = [];
  for (const part of parts) {
    if (!isProviderMode(part)) {
      throw new Error(`Unknown provider mode: ${part}`);
    }
    if (!modes.includes(part)) {
      modes.push(part);
    }
  }
  return modes;
}

/** Mode A stays off unless the compile-time flag and an explicit env opt-in are both true. */
export function isModeAEnabled(envValue: string | undefined): boolean {
  return MODE_A_FEATURE_FLAG === true && envValue === 'true';
}

export function isProductionEnvironment(environment: string | undefined): boolean {
  return environment === 'production';
}

export function assertSimulationEnvironment(environment: string | undefined): void {
  if (isProductionEnvironment(environment)) {
    throw new Error('Production is not authorized for AirExpay Phase 1');
  }
}

export type StorageBackendName = 'memory' | 'postgres' | 'durable_object';

/**
 * Default is in-memory. `postgres` still needs a caller-supplied local SQL client.
 * `durable_object` needs the INVOICE_STORE binding and does not open a database.
 */
export function resolveStorageBackend(raw: string | undefined): StorageBackendName {
  const value = (raw ?? 'memory').trim() || 'memory';
  if (value === 'memory' || value === 'postgres' || value === 'durable_object') return value;
  throw new Error(`Unknown STORAGE_BACKEND: ${value}`);
}

/** Only the exact string `true` turns livemode on. Missing and every other value stay false. */
export function parseLivemode(raw: string | undefined): boolean {
  return raw === 'true';
}

/** Fixed window for the simulation checkout routes. Shared by the memory and Durable Object limiters. */
export const SIMULATION_CHECKOUT_LIMIT = 30;
export const SIMULATION_CHECKOUT_WINDOW_MS = 60_000;

export function isExactlyMockMode(modes: readonly ProviderMode[]): boolean {
  return modes.length === 1 && modes[0] === 'mock';
}

/**
 * Dev checkout routes are simulation-only.
 * Allowed for `ENVIRONMENT=dev`, or for staging when the only provider mode is mock and livemode is false.
 * Production, livemode, and any real provider mode are rejected.
 */
export function simulationCheckoutAllowed(input: {
  environment: string | undefined;
  allowedModes: readonly ProviderMode[];
  livemode: boolean;
}): boolean {
  if (input.livemode) return false;
  if (!isExactlyMockMode(input.allowedModes)) return false;
  if (isProductionEnvironment(input.environment)) return false;
  return input.environment === 'dev' || input.environment === 'staging';
}

/**
 * Refuses hosted database URLs. The Worker does not open a connection itself.
 * localhost is the only accepted host, and only as a guard before an injected client.
 */
export function assertLocalDatabaseUrl(databaseUrl: string | undefined): void {
  const trimmed = databaseUrl?.trim() ?? '';
  if (!trimmed) {
    throw new Error(
      'STORAGE_BACKEND=postgres requires DATABASE_URL on localhost. Hosted databases are not used.',
    );
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('DATABASE_URL must be a postgres URL on localhost');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const hosted =
    host.endsWith('.supabase.co') ||
    host.endsWith('.supabase.com') ||
    host.includes('pooler.supabase');
  if (!local || hosted || (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:')) {
    throw new Error('DATABASE_URL must point at localhost. Hosted databases are refused.');
  }
}

const STAGING_CHECKOUT_ORIGIN = defaultOrigins('staging').pay;
const STAGING_API_ORIGIN = defaultOrigins('staging').api;

export function stagingCheckoutOrigin(): string {
  return STAGING_CHECKOUT_ORIGIN;
}

export function stagingApiOrigin(): string {
  return STAGING_API_ORIGIN;
}

/** Public checkout links. Dev falls back to the local Vite origin when unset. */
export function resolveCheckoutBaseUrl(
  environment: string | undefined,
  configured: string | undefined,
): string {
  const value = configured?.trim().replace(/\/$/, '') ?? '';
  if (value) {
    assertPublicHttpUrl(value, 'PUBLIC_CHECKOUT_BASE_URL');
    return value;
  }
  if ((environment ?? 'dev') === 'dev' || environment === 'test') {
    return 'http://localhost:5173';
  }
  throw new Error('PUBLIC_CHECKOUT_BASE_URL is required when ENVIRONMENT is not dev');
}

export function assertPublicHttpUrl(value: string, name: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an http(s) URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must be an http(s) URL`);
  }
  if (url.username || url.password) {
    throw new Error(`${name} must not include credentials`);
  }
}
