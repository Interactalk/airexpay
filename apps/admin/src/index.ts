import { authorizeAdmin, resolveRuntimeEnvironment } from '@airexpay/config';

export interface AdminEnv {
  ENVIRONMENT?: string;
}

/**
 * Scaffold only. Cloudflare Access is not configured in this repo.
 * Production fails closed unless a verifier has already accepted the Access JWT
 * and the role is admin. The dev role header is ignored outside dev.
 */
export function handleAdmin(
  request: Request,
  environmentRaw: string | undefined,
  verifyAccess: (jwt: string) => boolean = () => false,
): Response {
  const environment = resolveRuntimeEnvironment(environmentRaw);
  const accessJwt = request.headers.get('cf-access-jwt-assertion');
  const decision = authorizeAdmin({
    environment,
    accessJwt,
    accessVerified: accessJwt ? verifyAccess(accessJwt) : false,
    role: request.headers.get('x-airexpay-role'),
    devRoleHeader: request.headers.get('x-airexpay-admin-role'),
  });
  if (!decision.ok) {
    return Response.json({ error: decision.reason, scaffold: true }, { status: decision.status });
  }
  return Response.json({
    surface: 'admin',
    scaffold: true,
    note: 'KYC review console is not built yet. Access and the admin role are the only gate.',
  });
}

export default {
  fetch(request: Request, env: AdminEnv): Response {
    return handleAdmin(request, env.ENVIRONMENT);
  },
};
