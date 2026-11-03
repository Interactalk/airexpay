import { createAuthApp } from './app.ts';

export interface AuthEnv {
  ENVIRONMENT?: string;
  ORIGIN_MARKETING?: string;
  ORIGIN_APP?: string;
  ORIGIN_PAY?: string;
  ORIGIN_API?: string;
  ORIGIN_AUTH?: string;
  ORIGIN_DOCS?: string;
  ORIGIN_ADMIN?: string;
}

export default {
  fetch(request: Request, env: AuthEnv): Response | Promise<Response> {
    if (env.ENVIRONMENT === 'production') {
      return Response.json(
        { error: 'not_authorized', message: 'Production auth is not enabled' },
        { status: 403 },
      );
    }
    return createAuthApp({
      environment: env.ENVIRONMENT,
      env: {
        ORIGIN_MARKETING: env.ORIGIN_MARKETING,
        ORIGIN_APP: env.ORIGIN_APP,
        ORIGIN_PAY: env.ORIGIN_PAY,
        ORIGIN_API: env.ORIGIN_API,
        ORIGIN_AUTH: env.ORIGIN_AUTH,
        ORIGIN_DOCS: env.ORIGIN_DOCS,
        ORIGIN_ADMIN: env.ORIGIN_ADMIN,
      },
    }).fetch(request);
  },
};
