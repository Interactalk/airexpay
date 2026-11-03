import {
  requestWithoutAuthCookies,
  AUTH_COOKIE_NAMES,
  clearCookie,
  sessionCookieSpec,
  csrfCookieSpec,
} from './cookies.ts';
import { safeRedirect } from './redirect.ts';
import { defaultOrigins, type RuntimeEnvironment } from './origins.ts';
import type { SessionUser } from './session.ts';

export interface AccessCheck {
  ok: boolean;
  status: 200 | 401 | 403;
  reason: 'ok' | 'access_required' | 'not_admin';
}

/**
 * Admin is scaffold-only. Production and staging require a Cloudflare Access JWT
 * plus an admin role. The dev header is refused outside dev. This function does
 * not verify a live Access signature; the caller passes the result of its verifier.
 */
export function authorizeAdmin(input: {
  environment: RuntimeEnvironment;
  accessJwt: string | null | undefined;
  accessVerified: boolean;
  role: string | null | undefined;
  devRoleHeader: string | null | undefined;
}): AccessCheck {
  if (input.environment === 'dev' && input.devRoleHeader === 'admin') {
    return { ok: true, status: 200, reason: 'ok' };
  }
  if (!input.accessJwt || !input.accessVerified) {
    return { ok: false, status: 401, reason: 'access_required' };
  }
  if (input.role !== 'admin') return { ok: false, status: 403, reason: 'not_admin' };
  return { ok: true, status: 200, reason: 'ok' };
}

export function payResponse(
  request: Request,
  inner: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
  const stripped = requestWithoutAuthCookies(request);
  return Promise.resolve(inner(stripped)).then((response) => {
    const headers = new Headers(response.headers);
    const setCookies =
      typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : headers.get('set-cookie')
          ? [headers.get('set-cookie') ?? '']
          : [];
    headers.delete('set-cookie');
    for (const cookie of setCookies) {
      const name = cookie.slice(0, cookie.indexOf('='));
      if (!(AUTH_COOKIE_NAMES as readonly string[]).includes(name))
        headers.append('Set-Cookie', cookie);
    }
    return new Response(response.body, { status: response.status, headers });
  });
}

export function appLoginRedirect(input: {
  environment: RuntimeEnvironment;
  requestUrl: string;
  user: SessionUser | null;
}): Response {
  if (input.user) {
    return Response.json({ surface: 'app', user_id: input.user.userId, role: input.user.role });
  }
  const origins = defaultOrigins(input.environment);
  let returnTo = origins.app;
  try {
    const url = new URL(input.requestUrl);
    if (url.host === new URL(origins.app).host)
      returnTo = safeRedirect({
        target: url.origin + url.pathname + url.search,
        environment: input.environment,
        origins,
      });
  } catch {
    returnTo = origins.app;
  }
  const login = new URL('/login', origins.auth);
  login.searchParams.set('redirect', returnTo);
  return Response.json({ error: 'login_required', login: login.toString() }, { status: 401 });
}

export function clearSessionHeaders(environment: RuntimeEnvironment): string[] {
  return [clearCookie(sessionCookieSpec(environment)), clearCookie(csrfCookieSpec(environment))];
}
