import { timingSafeEqualString } from './timing.ts';
import { corsDecision } from './cors.ts';
import { csrfCookieSpec, readCookie } from './cookies.ts';
import type { OriginSet, RuntimeEnvironment, Surface } from './origins.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfInput {
  method: string;
  origin: string | null | undefined;
  cookieHeader: string | null | undefined;
  headerToken: string | null | undefined;
  environment: RuntimeEnvironment;
  surface: Surface;
  origins?: OriginSet;
}

export type CsrfResult = { ok: true } | { ok: false; reason: 'origin' | 'token' };

/**
 * State-changing browser requests need an allowlisted Origin and a double-submit token.
 * The token cookie is not HttpOnly so the app can copy it into `x-airexpay-csrf`.
 * Missing Origin fails closed for cookie-authenticated mutations.
 */
export function checkCsrf(input: CsrfInput): CsrfResult {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return { ok: true };
  const decision = corsDecision({
    environment: input.environment,
    surface: input.surface,
    origin: input.origin,
    ...(input.origins ? { origins: input.origins } : {}),
  });
  if (!decision.allow || !decision.credentials) return { ok: false, reason: 'origin' };
  const expected = readCookie(input.cookieHeader, csrfCookieSpec(input.environment).name);
  const presented = input.headerToken?.trim() ?? '';
  if (!expected || !presented || !timingSafeEqualString(expected, presented)) {
    return { ok: false, reason: 'token' };
  }
  return { ok: true };
}
