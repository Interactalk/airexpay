export const PROVIDER_MODES = ['mock', 'nowpayments_direct', 'nowpayments_platform'] as const;

export type ProviderMode = (typeof PROVIDER_MODES)[number];

/**
 * Compile-time kill switch for NOWPayments Mode A (platform / sub-partner).
 * Typed as boolean so callers cannot "turn it on" by editing an env var.
 * Do not set this to true without written provider approval and counsel sign-off.
 */
export const MODE_A_FEATURE_FLAG: boolean = false;

/** Public in-memory placeholders. Not credentials. Safe to publish. */
export const SIMULATION_API_KEYS = {
  alpha: 'ak_test_simulation_alpha',
  beta: 'ak_test_simulation_beta_',
} as const;

export const SIMULATION_IPN_SECRET = 'simulation-ipn-secret';

export const SIMULATION_ORG_IDS = {
  alpha: '11111111-1111-4111-8111-111111111111',
  beta: '22222222-2222-4222-8222-222222222222',
} as const;

export function isProviderMode(value: string): value is ProviderMode {
  return (PROVIDER_MODES as readonly string[]).includes(value);
}

export function parseAllowedModes(raw: string | undefined): ProviderMode[] {
  const parts = (raw ?? 'mock')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return ['mock'];
  }
  const modes: ProviderMode[] = [];
  for (const part of parts) {
    if (!isProviderMode(part)) {
      throw new Error(`Unknown provider mode: ${part}`);
    }
    if (!modes.includes(part)) {
      modes.push(part);
    }
  }
  return modes;
}

/** Mode A stays off unless the compile-time flag and an explicit env opt-in are both true. */
export function isModeAEnabled(envValue: string | undefined): boolean {
  return MODE_A_FEATURE_FLAG === true && envValue === 'true';
}

export function assertSimulationEnvironment(environment: string | undefined): void {
  if (environment === 'production') {
    throw new Error('Production is not authorized for AirExpay Phase 1');
  }
}
