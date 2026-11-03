import { MemoryDatabase } from './db/memory.ts';
import { createApp } from './app.ts';

/**
 * Simulation-only isolate cache. Not durable, not shared across isolates,
 * and not a substitute for Postgres. See docs/KNOWN_LIMITATIONS.md.
 */
let simulationDb: MemoryDatabase | undefined;

function database(): MemoryDatabase {
  simulationDb ??= new MemoryDatabase();
  return simulationDb;
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    const app = createApp({
      db: database(),
      environment: env.ENVIRONMENT,
      allowedModesRaw: env.ALLOWED_MODES,
      modeAEnv: env.NOWPAYMENTS_MODE_A_ENABLED,
      ipnSecret: env.SIMULATION_IPN_SECRET,
      checkoutBaseUrl: 'http://localhost:5173',
    });
    return app.fetch(request);
  },
} satisfies ExportedHandler<Env>;
