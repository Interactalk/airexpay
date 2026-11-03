import {
  acceptsSessionCookie,
  appLoginRedirect,
  readCookie,
  resolveRuntimeEnvironment,
  sessionCookieSpec,
  type SessionUser,
} from '@airexpay/config';

export interface AppEnv {
  ENVIRONMENT?: string;
}

export interface AppDeps {
  environment?: string | undefined;
  verify: (refreshToken: string) => SessionUser | null;
}

export function handleApp(request: Request, deps: AppDeps): Response {
  const environment = resolveRuntimeEnvironment(deps.environment);
  const spec = sessionCookieSpec(environment);
  const token = readCookie(request.headers.get('cookie'), spec.name);
  const other =
    environment === 'production'
      ? readCookie(request.headers.get('cookie'), 'ax_sess_stg')
      : readCookie(request.headers.get('cookie'), 'ax_sess');
  if (!acceptsSessionCookie(environment, spec.name)) {
    return Response.json({ error: 'cookie_rejected' }, { status: 401 });
  }
  const user = token ? deps.verify(token) : null;
  if (!user && other) {
    return Response.json({ error: 'foreign_session_ignored' }, { status: 401 });
  }
  return appLoginRedirect({ environment, requestUrl: request.url, user });
}

export default {
  fetch(request: Request, env: AppEnv): Response {
    return handleApp(request, {
      environment: env.ENVIRONMENT,
      verify: () => null,
    });
  },
};
