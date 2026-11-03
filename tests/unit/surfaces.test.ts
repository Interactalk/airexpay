import { readFileSync } from 'node:fs';
import { SIMULATION_API_KEYS } from '@airexpay/configuration';
import {
  MemorySessionStore,
  authorizeAdmin,
  payResponse,
  checkCsrf,
  clearCookie,
  corsDecision,
  csrfCookieSpec,
  originsFromEnv,
  readCookie,
  safeRedirect,
  serializeCookie,
  sessionCookieSpec,
  stripAuthCookies,
  workerRoutes,
} from '@airexpay/config';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.ts';
import { MemoryDatabase } from '../../apps/api/src/db/memory.ts';
import { handleAdmin } from '../../apps/admin/src/index.ts';
import { handleApp } from '../../apps/app/src/index.ts';
import { createAuthApp } from '../../apps/auth/src/app.ts';
import { handleDocs } from '../../apps/docs/src/index.ts';
import { handleMarketing } from '../../apps/marketing/src/index.ts';
import { handlePay } from '../../apps/pay/src/index.ts';

const PROD_AUTH = 'https://auth.airexpay.com';

async function csrfFor(app: ReturnType<typeof createAuthApp>, origin: string) {
  const response = await app.request('/csrf', { headers: { origin } });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { csrf_token: string };
  const setCookie = response.headers.get('set-cookie') ?? '';
  return { token: body.csrf_token, cookie: setCookie };
}

describe('session cookies', () => {
  it('uses distinct HttpOnly Secure Lax names and does not use the __Host- prefix', () => {
    const production = sessionCookieSpec('production');
    const staging = sessionCookieSpec('staging');
    expect(production.name).toBe('ax_sess');
    expect(staging.name).toBe('ax_sess_stg');
    expect(production.name.startsWith('__Host-')).toBe(false);
    expect(staging.name.startsWith('__Host-')).toBe(false);
    expect(production.domain).toBe('.airexpay.com');
    expect(staging.domain).toBe('.airexpay.com');
    expect(production.httpOnly).toBe(true);
    expect(production.secure).toBe(true);
    expect(production.sameSite).toBe('Lax');
    const header = serializeCookie(production, 'refresh-token');
    expect(header).toContain('ax_sess=');
    expect(header).not.toContain('ax_sess_stg');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Domain=.airexpay.com');
    const stagingHeader = serializeCookie(staging, 'other');
    expect(stagingHeader.startsWith('ax_sess_stg=')).toBe(true);
    expect(clearCookie(production)).toContain('Max-Age=0');
  });

  it('does not let one environment accept the other cookie name', () => {
    expect(sessionCookieSpec('production').name).not.toBe(sessionCookieSpec('staging').name);
    const header = 'ax_sess=prod; ax_sess_stg=stage';
    expect(readCookie(header, 'ax_sess')).toBe('prod');
    expect(readCookie(header, 'ax_sess_stg')).toBe('stage');
    expect(stripAuthCookies(`ax_sess=secret; theme=light`)).toBe('theme=light');
    expect(stripAuthCookies('ax_sess_stg=secret; ax_csrf=abc')).toBeNull();
  });
});

describe('CSRF', () => {
  it('rejects a state-changing request whose origin or double-submit token does not match', () => {
    const spec = csrfCookieSpec('production');
    const missing = checkCsrf({
      method: 'POST',
      origin: 'https://evil.example',
      cookieHeader: `${spec.name}=token`,
      headerToken: 'token',
      environment: 'production',
      surface: 'api',
    });
    expect(missing.ok).toBe(false);
    const mismatched = checkCsrf({
      method: 'POST',
      origin: 'https://app.airexpay.com',
      cookieHeader: `${spec.name}=expected`,
      headerToken: 'presented',
      environment: 'production',
      surface: 'api',
    });
    expect(mismatched).toEqual({ ok: false, reason: 'token' });
    const ok = checkCsrf({
      method: 'POST',
      origin: 'https://app.airexpay.com',
      cookieHeader: `${spec.name}=expected`,
      headerToken: 'expected',
      environment: 'production',
      surface: 'api',
    });
    expect(ok).toEqual({ ok: true });
    expect(
      checkCsrf({
        method: 'GET',
        origin: 'https://evil.example',
        cookieHeader: null,
        headerToken: null,
        environment: 'production',
        surface: 'api',
      }).ok,
    ).toBe(true);
  });
});

describe('redirect allowlist', () => {
  it('accepts only this environment’s origins', () => {
    expect(
      safeRedirect({
        target: 'https://app.airexpay.com/invoices?tab=open',
        environment: 'production',
      }),
    ).toBe('https://app.airexpay.com/invoices?tab=open');
    expect(safeRedirect({ target: 'https://evil.example/phish', environment: 'production' })).toBe(
      'https://app.airexpay.com',
    );
    expect(
      safeRedirect({ target: 'https://airexpay.com.evil.example', environment: 'production' }),
    ).toBe('https://app.airexpay.com');
    expect(
      safeRedirect({ target: 'https://user:pass@app.airexpay.com', environment: 'production' }),
    ).toBe('https://app.airexpay.com');
    expect(safeRedirect({ target: '//evil.example', environment: 'production' })).toBe(
      'https://app.airexpay.com',
    );
    expect(safeRedirect({ target: 'javascript:alert(1)', environment: 'production' })).toBe(
      'https://app.airexpay.com',
    );
    expect(
      safeRedirect({ target: 'https://app.airexpay.com/dashboard', environment: 'staging' }),
    ).toBe('https://app-staging.airexpay.com');
    expect(
      safeRedirect({
        target: 'https://app-staging.airexpay.com/onboarding',
        environment: 'staging',
      }),
    ).toBe('https://app-staging.airexpay.com/onboarding');
  });
});

describe('CORS allowlist', () => {
  it('keeps staging and production origins apart and does not credential pay', () => {
    expect(
      corsDecision({
        environment: 'staging',
        surface: 'api',
        origin: 'https://app-staging.airexpay.com',
      }),
    ).toEqual({ allow: true, credentials: true, origin: 'https://app-staging.airexpay.com' });
    expect(
      corsDecision({ environment: 'staging', surface: 'api', origin: 'https://app.airexpay.com' })
        .allow,
    ).toBe(false);
    expect(
      corsDecision({
        environment: 'production',
        surface: 'api',
        origin: 'https://pay.airexpay.com',
      }),
    ).toEqual({ allow: true, credentials: false, origin: 'https://pay.airexpay.com' });
    expect(
      corsDecision({ environment: 'production', surface: 'api', origin: 'https://evil.example' })
        .allow,
    ).toBe(false);
    const overridden = originsFromEnv('production', { ORIGIN_APP: 'https://app.example.test' });
    expect(overridden.app).toBe('https://app.example.test');
    expect(overridden.api).toBe('https://api.airexpay.com');
  });
});

describe('surface workers', () => {
  it('strips auth cookies on pay and never returns them', async () => {
    const response = await handlePay(
      new Request('https://pay.airexpay.com/pay/inv_1', {
        headers: { cookie: 'ax_sess=super-secret; theme=light' },
      }),
    );
    const body = (await response.json()) as { cookie: string | null };
    expect(body.cookie).toBe('theme=light');
    expect(JSON.stringify(body)).not.toContain('super-secret');
    const stripped = await payResponse(
      new Request('https://pay.airexpay.com/', { headers: { cookie: 'ax_sess_stg=stage' } }),
      () => new Response('ok', { headers: { 'Set-Cookie': 'ax_sess=nope; Path=/' } }),
    );
    expect(stripped.headers.get('set-cookie')).toBeNull();
  });

  it('logs in with a production cookie, rotates it, and logout clears it', async () => {
    const app = createAuthApp({ environment: 'production' });
    const csrf = await csrfFor(app, PROD_AUTH);
    const signup = await app.request('/signup', {
      method: 'POST',
      headers: {
        origin: PROD_AUTH,
        cookie: csrf.cookie,
        'x-airexpay-csrf': csrf.token,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'merchant@example.com',
        password: 'simulation-pass',
        redirect: 'https://evil.example/steal',
      }),
    });
    expect(signup.status).toBe(200);
    const session = (await signup.json()) as { redirect: string; access_token: string };
    expect(session.redirect).toBe('https://app.airexpay.com');
    const setCookie = signup.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('ax_sess=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).not.toContain('ax_sess_stg');
    const refresh = await app.request('/session/refresh', {
      method: 'POST',
      headers: {
        origin: PROD_AUTH,
        cookie: `${csrf.cookie}; ${setCookie.split(';')[0]}`,
        'x-airexpay-csrf': csrf.token,
      },
    });
    expect(refresh.status).toBe(200);
    const rotated = refresh.headers.get('set-cookie') ?? '';
    expect(rotated.startsWith('ax_sess=')).toBe(true);
    expect(rotated).not.toBe(setCookie);
    const logout = await app.request('/logout', {
      method: 'POST',
      headers: {
        origin: PROD_AUTH,
        cookie: `${csrf.cookie}; ${rotated.split(';')[0]}`,
        'x-airexpay-csrf': csrf.token,
      },
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    const again = await app.request('/session/refresh', {
      method: 'POST',
      headers: {
        origin: PROD_AUTH,
        cookie: `${csrf.cookie}; ${rotated.split(';')[0]}`,
        'x-airexpay-csrf': csrf.token,
      },
    });
    expect(again.status).toBe(401);
  });

  it('rejects a staging cookie on the production app and an open redirect host', () => {
    const denied = handleApp(
      new Request('https://app.airexpay.com/dashboard', {
        headers: { cookie: 'ax_sess_stg=nope' },
      }),
      { environment: 'production', verify: () => ({ userId: 'user_1', role: 'merchant' }) },
    );
    expect(denied.status).toBe(401);
    const login = handleApp(new Request('https://evil.example/dashboard'), {
      environment: 'production',
      verify: () => null,
    });
    expect(login.status).toBe(401);
    return login.json().then((body) => {
      const payload = body as { login: string };
      const redirect = new URL(payload.login).searchParams.get('redirect');
      expect(redirect).toBe('https://app.airexpay.com');
      expect(payload.login.startsWith('https://auth.airexpay.com/login?')).toBe(true);
    });
  });

  it('keeps marketing and docs free of session cookies', () => {
    const marketing = handleMarketing(
      new Request('https://airexpay.com/', { headers: { cookie: 'ax_sess=secret' } }),
    );
    expect(marketing.headers.get('set-cookie')).toBeNull();
    expect(marketing.status).toBe(200);
    const www = handleMarketing(new Request('https://www.airexpay.com/pricing'));
    expect(www.status).toBe(301);
    expect(www.headers.get('location')).toBe('https://airexpay.com/pricing');
    expect(handleDocs().headers.get('set-cookie')).toBeNull();
  });

  it('scaffolds admin behind Access and an admin role', () => {
    expect(handleAdmin(new Request('https://admin.airexpay.com/'), 'production').status).toBe(401);
    const devHeader = handleAdmin(
      new Request('https://admin.airexpay.com/', { headers: { 'x-airexpay-admin-role': 'admin' } }),
      'production',
    );
    expect(devHeader.status).toBe(401);
    const dev = handleAdmin(
      new Request('http://127.0.0.1:8789/', { headers: { 'x-airexpay-admin-role': 'admin' } }),
      'dev',
    );
    expect(dev.status).toBe(200);
    const merchant = handleAdmin(
      new Request('https://admin.airexpay.com/', {
        headers: { 'cf-access-jwt-assertion': 'jwt', 'x-airexpay-role': 'merchant' },
      }),
      'production',
      () => true,
    );
    expect(merchant.status).toBe(403);
    const admin = handleAdmin(
      new Request('https://admin.airexpay.com/', {
        headers: { 'cf-access-jwt-assertion': 'jwt', 'x-airexpay-role': 'admin' },
      }),
      'staging',
      () => true,
    );
    expect(admin.status).toBe(200);
    expect(
      authorizeAdmin({
        environment: 'production',
        accessJwt: 'jwt',
        accessVerified: false,
        role: 'admin',
        devRoleHeader: 'admin',
      }).status,
    ).toBe(401);
  });
});

describe('api session and API keys', () => {
  it('validates a staging session on /v1/me and still requires an API key for invoices', async () => {
    const sessions = new MemorySessionStore();
    const issued = await sessions.issue({ userId: 'user_1', role: 'merchant' });
    const api = createApp({
      db: new MemoryDatabase(),
      environment: 'staging',
      sessions,
      checkoutBaseUrl: 'https://pay-staging.airexpay.com',
    });
    const me = await api.request('/v1/me', {
      headers: { cookie: `ax_sess_stg=${issued.refreshToken}` },
    });
    expect(me.status).toBe(200);
    const foreign = await api.request('/v1/me', {
      headers: { cookie: `ax_sess=${issued.refreshToken}` },
    });
    expect(foreign.status).toBe(401);
    const invoice = await api.request('/v1/invoices', {
      method: 'POST',
      headers: {
        cookie: `ax_sess_stg=${issued.refreshToken}`,
        'content-type': 'application/json',
        'idempotency-key': 'idem_session_only',
      },
      body: JSON.stringify({
        price_amount: '100.00',
        price_currency: 'usd',
        order_id: 'order_session',
      }),
    });
    expect(invoice.status).toBe(401);
    const keyed = await api.request('/v1/invoices', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${SIMULATION_API_KEYS.alpha}`,
        'content-type': 'application/json',
        'idempotency-key': 'idem_key_only',
      },
      body: JSON.stringify({
        price_amount: '100.00',
        price_currency: 'usd',
        order_id: 'order_key',
      }),
    });
    expect(keyed.status).toBe(201);
    const cors = await api.request('/health', {
      headers: { origin: 'https://app.airexpay.com' },
    });
    expect(cors.headers.get('access-control-allow-origin')).toBeNull();
    const stagingCors = await api.request('/health', {
      headers: { origin: 'https://app-staging.airexpay.com' },
    });
    expect(stagingCors.headers.get('access-control-allow-origin')).toBe(
      'https://app-staging.airexpay.com',
    );
    expect(stagingCors.headers.get('access-control-allow-credentials')).toBe('true');
    const payCors = await api.request('/health', {
      headers: { origin: 'https://pay-staging.airexpay.com' },
    });
    expect(payCors.headers.get('access-control-allow-credentials')).toBeNull();
  });
});

describe('worker route table', () => {
  it('lists every production and staging host and keeps those routes commented in wrangler', () => {
    const routes = workerRoutes();
    expect(routes.map((route) => route.pattern).sort()).toEqual(
      [
        'admin-staging.airexpay.com/*',
        'admin.airexpay.com/*',
        'api-staging.airexpay.com/*',
        'api.airexpay.com/*',
        'app-staging.airexpay.com/*',
        'app.airexpay.com/*',
        'auth-staging.airexpay.com/*',
        'auth.airexpay.com/*',
        'docs-staging.airexpay.com/*',
        'docs.airexpay.com/*',
        'pay-staging.airexpay.com/*',
        'pay.airexpay.com/*',
        'staging.airexpay.com/*',
        'airexpay.com/*',
      ].sort(),
    );
    const files = [
      'apps/api/wrangler.toml',
      'apps/auth/wrangler.toml',
      'apps/app/wrangler.toml',
      'apps/pay/wrangler.toml',
      'apps/marketing/wrangler.toml',
      'apps/docs/wrangler.toml',
      'apps/admin/wrangler.toml',
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text).toContain('workers_dev = false');
      expect(text).not.toMatch(/^\[\[routes\]\]/m);
      expect(text).toContain('# route:');
    }
  });
});
