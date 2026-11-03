import { defaultOrigins, originHost, type OriginSet, type RuntimeEnvironment } from './origins.ts';

/**
 * Login return URLs must be an exact configured origin for this environment.
 * A suffix match on `airexpay.com` is not enough: `airexpay.com.evil.example` and
 * userinfo URLs are rejected. Staging cannot return to a production host.
 */
export function safeRedirect(input: {
  target: string | null | undefined;
  environment: RuntimeEnvironment;
  origins?: OriginSet;
  fallbackSurface?: 'app' | 'admin';
}): string {
  const origins = input.origins ?? defaultOrigins(input.environment);
  const fallback = origins[input.fallbackSurface ?? 'app'];
  const target = input.target?.trim() ?? '';
  if (!target || target.startsWith('//') || target.includes('\\')) return fallback;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return fallback;
  }
  if (url.username || url.password) return fallback;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
  const allowed = new Set(Object.values(origins).map((origin) => originHost(origin)));
  if (!allowed.has(url.host)) return fallback;
  const matched = Object.values(origins).find((origin) => originHost(origin) === url.host);
  if (!matched || new URL(matched).protocol !== url.protocol) return fallback;
  return url.origin + url.pathname + url.search;
}
