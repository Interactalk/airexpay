import {
  checkCsrf,
  clearCookie,
  corsDecision,
  csrfCookieSpec,
  originsFromEnv,
  readCookie,
  resolveRuntimeEnvironment,
  safeRedirect,
  serializeCookie,
  sessionCookieSpec,
  applyCors,
  type OriginSet,
  type RuntimeEnvironment,
} from '@airexpay/config';
import { Hono } from 'hono';
import { createSimulationAuth, type AuthProvider } from './provider.ts';
import type { MemorySessionStore } from '@airexpay/config';

export interface AuthAppDeps {
  environment?: string | undefined;
  env?: Record<string, string | undefined> | undefined;
  provider?: AuthProvider | undefined;
  sessions?: MemorySessionStore | undefined;
}

function randomCsrf(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createAuthApp(deps: AuthAppDeps = {}) {
  const environment = resolveRuntimeEnvironment(deps.environment);
  const origins = originsFromEnv(environment, deps.env ?? {});
  const simulation = createSimulationAuth();
  const provider = deps.provider ?? simulation.provider;
  const sessions = deps.sessions ?? simulation.sessions;
  const app = new Hono();

  app.use('*', async (c, next) => {
    const origin = c.req.header('origin');
    const decision = corsDecision({ environment, surface: 'auth', origin, origins });
    if (c.req.method === 'OPTIONS') {
      const headers = new Headers();
      applyCors(headers, decision);
      return new Response(null, { status: 204, headers });
    }
    await next();
    applyCors(c.res.headers, decision);
  });

  function guard(c: { req: { method: string; header: (name: string) => string | undefined } }) {
    return checkCsrf({
      method: c.req.method,
      origin: c.req.header('origin'),
      cookieHeader: c.req.header('cookie'),
      headerToken: c.req.header('x-airexpay-csrf'),
      environment,
      surface: 'auth',
      origins,
    });
  }

  app.get('/csrf', (c) => {
    const token = randomCsrf();
    c.header('Set-Cookie', serializeCookie(csrfCookieSpec(environment), token), { append: true });
    return c.json({ csrf_token: token });
  });

  app.post('/signup', async (c) => {
    const csrf = guard(c);
    if (!csrf.ok) return c.json({ error: csrf.reason }, 403);
    const body = await readJson(c);
    try {
      const identity = await provider.signUp(String(body.email ?? ''), String(body.password ?? ''));
      return await startSession(c, environment, origins, sessions, identity, body.redirect);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'signup_failed';
      return c.json({ error: code }, 400);
    }
  });

  app.post('/login', async (c) => {
    const csrf = guard(c);
    if (!csrf.ok) return c.json({ error: csrf.reason }, 403);
    const body = await readJson(c);
    try {
      const identity = await provider.signIn(String(body.email ?? ''), String(body.password ?? ''));
      return await startSession(c, environment, origins, sessions, identity, body.redirect);
    } catch {
      return c.json({ error: 'invalid_credentials' }, 401);
    }
  });

  app.post('/magic-link', async (c) => {
    const csrf = guard(c);
    if (!csrf.ok) return c.json({ error: csrf.reason }, 403);
    const body = await readJson(c);
    await provider.requestMagicLink(String(body.email ?? ''));
    return c.json({ sent: true }, 202);
  });

  app.post('/magic-link/consume', async (c) => {
    const csrf = guard(c);
    if (!csrf.ok) return c.json({ error: csrf.reason }, 403);
    const body = await readJson(c);
    const identity = await provider.consumeMagicLink(String(body.token ?? ''));
    if (!identity) return c.json({ error: 'invalid_token' }, 400);
    return startSession(c, environment, origins, sessions, identity, body.redirect);
  });

  app.get('/oauth/callback', async (c) => {
    const redirect = safeRedirect({
      target: c.req.query('redirect'),
      environment,
      origins,
    });
    const state = c.req.query('state') ?? '';
    const expected = readCookie(c.req.header('cookie'), 'ax_oauth_state');
    if (!state || !expected || state !== expected) return c.json({ error: 'invalid_state' }, 400);
    const identity = await provider.exchangeOAuthCode(c.req.query('code') ?? '');
    if (!identity) return c.json({ error: 'invalid_code' }, 400);
    const session = await sessions.issue(identity);
    const headers = new Headers({ Location: redirect });
    headers.append(
      'Set-Cookie',
      serializeCookie(sessionCookieSpec(environment), session.refreshToken),
    );
    headers.append('Set-Cookie', 'ax_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    return new Response(null, { status: 302, headers });
  });

  app.post('/session/refresh', async (c) => {
    const csrf = guard(c);
    if (!csrf.ok) return c.json({ error: csrf.reason }, 403);
    const refresh = readCookie(c.req.header('cookie'), sessionCookieSpec(environment).name);
    if (!refresh) return c.json({ error: 'no_session' }, 401);
    const next = await sessions.rotate(refresh);
    if (!next) {
      c.header('Set-Cookie', clearCookie(sessionCookieSpec(environment)));
      return c.json({ error: 'session_revoked' }, 401);
    }
    c.header('Set-Cookie', serializeCookie(sessionCookieSpec(environment), next.refreshToken));
    return c.json({
      access_token: next.accessToken,
      access_expires_at: next.accessExpiresAt,
      user_id: next.userId,
      role: next.role,
    });
  });

  app.post('/logout', async (c) => {
    const csrf = guard(c);
    if (!csrf.ok) return c.json({ error: csrf.reason }, 403);
    const spec = sessionCookieSpec(environment);
    const refresh = readCookie(c.req.header('cookie'), spec.name);
    if (refresh) await sessions.revoke(refresh);
    c.header('Set-Cookie', clearCookie(spec), { append: true });
    c.header('Set-Cookie', clearCookie(csrfCookieSpec(environment)), { append: true });
    return c.json({ logged_out: true });
  });

  app.get('/session', async (c) => {
    const header = c.req.header('authorization');
    const token = header?.replace(/^Bearer\s+/i, '') ?? '';
    const user = token ? await sessions.verifyAccess(token) : null;
    if (!user) return c.json({ error: 'invalid_session' }, 401);
    return c.json({ user_id: user.userId, role: user.role });
  });

  return app;
}

async function startSession(
  c: {
    json: (body: unknown, status?: number) => Response;
    header: (name: string, value: string) => void;
  },
  environment: RuntimeEnvironment,
  origins: OriginSet,
  sessions: MemorySessionStore,
  identity: { userId: string; role: 'merchant' | 'admin' },
  redirect: unknown,
) {
  const session = await sessions.issue(identity);
  c.header('Set-Cookie', serializeCookie(sessionCookieSpec(environment), session.refreshToken));
  return c.json({
    access_token: session.accessToken,
    access_expires_at: session.accessExpiresAt,
    user_id: session.userId,
    role: session.role,
    redirect: safeRedirect({
      target: typeof redirect === 'string' ? redirect : null,
      environment,
      origins,
    }),
  });
}

async function readJson(c: {
  req: { json: () => Promise<unknown> };
}): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    if (body && typeof body === 'object' && !Array.isArray(body))
      return body as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}
