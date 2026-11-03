import type { RuntimeEnvironment } from './origins.ts';

export interface CookieSpec {
  name: string;
  /** Parent domain. Absent means host-only. Staging still uses a distinct name. */
  domain: string | undefined;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
  path: '/';
  maxAge: number;
}

/**
 * `__Host-` is intentionally not used. That prefix forbids a Domain attribute,
 * and the session cookie must be sent to sibling hosts (app, api, auth, admin).
 * Production and staging use different names so a Worker never accepts the other environment.
 * Both names use Domain=.airexpay.com because `app-staging.airexpay.com` and
 * `auth-staging.airexpay.com` have no narrower common parent. Servers must ignore
 * the other environment's name. Pay strips both and never reads them.
 */
const PARENT_DOMAIN = '.airexpay.com';
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 14 * 24 * 60 * 60;

export function sessionCookieSpec(environment: RuntimeEnvironment): CookieSpec {
  if (environment === 'production') {
    return {
      name: 'ax_sess',
      domain: PARENT_DOMAIN,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: REFRESH_MAX_AGE,
    };
  }
  if (environment === 'staging') {
    return {
      name: 'ax_sess_stg',
      domain: PARENT_DOMAIN,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: REFRESH_MAX_AGE,
    };
  }
  return {
    name: 'ax_sess_dev',
    domain: undefined,
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  };
}

export function csrfCookieSpec(environment: RuntimeEnvironment): CookieSpec {
  const session = sessionCookieSpec(environment);
  const name =
    environment === 'production'
      ? 'ax_csrf'
      : environment === 'staging'
        ? 'ax_csrf_stg'
        : 'ax_csrf_dev';
  return { ...session, name, httpOnly: false, maxAge: ACCESS_MAX_AGE };
}

export function acceptsSessionCookie(environment: RuntimeEnvironment, name: string): boolean {
  return name === sessionCookieSpec(environment).name;
}

export const AUTH_COOKIE_NAMES = [
  'ax_sess',
  'ax_sess_stg',
  'ax_sess_dev',
  'ax_csrf',
  'ax_csrf_stg',
  'ax_csrf_dev',
] as const;

export function serializeCookie(spec: CookieSpec, value: string): string {
  const parts = [
    `${spec.name}=${encodeURIComponent(value)}`,
    `Path=${spec.path}`,
    `Max-Age=${spec.maxAge}`,
    'SameSite=Lax',
  ];
  if (spec.domain) parts.push(`Domain=${spec.domain}`);
  if (spec.httpOnly) parts.push('HttpOnly');
  if (spec.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(spec: CookieSpec): string {
  return serializeCookie({ ...spec, maxAge: 0 }, '');
}

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** Drop auth cookies before pay or any public handler reads the request. */
export function stripAuthCookies(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const kept = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const name = part.slice(0, part.indexOf('='));
      return !(AUTH_COOKIE_NAMES as readonly string[]).includes(name);
    });
  return kept.length > 0 ? kept.join('; ') : null;
}

export function requestWithoutAuthCookies(request: Request): Request {
  const headers = new Headers(request.headers);
  const kept = stripAuthCookies(headers.get('cookie'));
  if (kept) headers.set('cookie', kept);
  else headers.delete('cookie');
  return new Request(request, { headers });
}
