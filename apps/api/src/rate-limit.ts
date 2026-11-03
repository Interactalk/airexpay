import { SIMULATION_CHECKOUT_LIMIT, SIMULATION_CHECKOUT_WINDOW_MS } from '@airexpay/configuration';

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface SimulationRateLimit {
  take(key: string, nowMs: number): RateLimitDecision | Promise<RateLimitDecision>;
}

/**
 * Fixed window kept in this isolate. Staging uses the Durable Object limiter instead,
 * because this map is not shared across isolates.
 */
export class MemoryRateLimiter implements SimulationRateLimit {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit = SIMULATION_CHECKOUT_LIMIT,
    private readonly windowMs = SIMULATION_CHECKOUT_WINDOW_MS,
  ) {}

  take(key: string, nowMs: number): RateLimitDecision {
    return decide(this.hits.get(key) ?? [], nowMs, this.limit, this.windowMs, (next) => {
      this.hits.set(key, next);
    });
  }
}

export function decide(
  existing: readonly number[],
  nowMs: number,
  limit: number,
  windowMs: number,
  store: (next: number[]) => void,
): RateLimitDecision {
  const windowStart = nowMs - windowMs;
  const recent = existing.filter((at) => at > windowStart);
  const oldest = recent[0];
  if (recent.length >= limit && oldest !== undefined) {
    store(recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000)),
    };
  }
  recent.push(nowMs);
  store(recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Cloudflare sets CF-Connecting-IP. Local dev falls back to the first forwarded hop. */
export function simulationClientKey(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip')?.trim();
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const raw = cf || forwarded || 'local';
  return raw.slice(0, 200);
}

export function durableObjectRateName(clientKey: string): string {
  const safe = clientKey.replace(/[^A-Za-z0-9:._-]/g, '_').slice(0, 180);
  return `rate:${safe || 'unknown'}`;
}
