import {
  defaultOrigins,
  type OriginSet,
  type RuntimeEnvironment,
  type Surface,
} from './origins.ts';

export interface CorsDecision {
  allow: boolean;
  credentials: boolean;
  origin: string | null;
}

/**
 * Credentialed browser calls are limited to app, admin, and auth.
 * Pay may call the API for public checkout without credentials and without a session cookie.
 * Marketing and docs are not API clients. An origin from another environment is denied.
 */
export function corsDecision(input: {
  environment: RuntimeEnvironment;
  surface: Surface;
  origin: string | null | undefined;
  origins?: OriginSet;
}): CorsDecision {
  const origin = input.origin?.trim() || null;
  if (!origin) return { allow: false, credentials: false, origin: null };
  const origins = input.origins ?? defaultOrigins(input.environment);
  const credentialed = new Set<string>([origins.app, origins.admin, origins.auth]);
  if (
    input.surface === 'api' ||
    input.surface === 'auth' ||
    input.surface === 'app' ||
    input.surface === 'admin'
  ) {
    if (credentialed.has(origin)) return { allow: true, credentials: true, origin };
  }
  if (input.surface === 'api' && origin === origins.pay) {
    return { allow: true, credentials: false, origin };
  }
  if (input.surface === 'auth' && origin === origins.marketing) {
    return { allow: false, credentials: false, origin: null };
  }
  return { allow: false, credentials: false, origin: null };
}

export function applyCors(headers: Headers, decision: CorsDecision): void {
  if (!decision.allow || !decision.origin) return;
  headers.set('Access-Control-Allow-Origin', decision.origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'authorization, content-type, idempotency-key, x-request-id, x-airexpay-csrf',
  );
  headers.set('Access-Control-Expose-Headers', 'x-request-id, idempotency-replayed');
  headers.set('Access-Control-Max-Age', '600');
  if (decision.credentials) headers.set('Access-Control-Allow-Credentials', 'true');
}
