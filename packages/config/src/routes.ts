import { defaultOrigins, type RuntimeEnvironment, type Surface } from './origins.ts';

export interface WorkerRoute {
  surface: Surface;
  environment: Exclude<RuntimeEnvironment, 'dev'>;
  worker: string;
  pattern: string;
  zoneName: 'airexpay.com';
}

const WORKER_NAMES: Record<Surface, string> = {
  marketing: 'airexpay-marketing',
  app: 'airexpay-app',
  pay: 'airexpay-pay',
  api: 'airexpay-api',
  auth: 'airexpay-auth',
  docs: 'airexpay-docs',
  admin: 'airexpay-admin',
};

/** Intended Worker routes. Nothing in this list is created or deployed by the app. */
export function workerRoutes(): WorkerRoute[] {
  const routes: WorkerRoute[] = [];
  for (const environment of ['production', 'staging'] as const) {
    const origins = defaultOrigins(environment);
    for (const surface of Object.keys(WORKER_NAMES) as Surface[]) {
      const host = new URL(origins[surface]).host;
      routes.push({
        surface,
        environment,
        worker:
          environment === 'staging' ? `${WORKER_NAMES[surface]}-staging` : WORKER_NAMES[surface],
        pattern: `${host}/*`,
        zoneName: 'airexpay.com',
      });
    }
  }
  return routes;
}
