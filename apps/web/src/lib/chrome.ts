export type ReviewState = 'pending' | 'approved' | 'rejected';
export type AppEnvironment = 'staging' | 'production';

export function isReviewState(value: string | undefined): value is ReviewState {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}

export function readEnvironment(value: string | null): AppEnvironment {
  return value === 'production' ? 'production' : 'staging';
}

/**
 * Staging always shows the simulation banner.
 * Production exists only with an approved review, and then the Live mode pill
 * replaces the banner. The thin strip is never used for the live pill.
 */
export function resolveChrome(
  environment: AppEnvironment,
  routeReview: ReviewState | null,
): { live: boolean; banner: boolean; review: ReviewState } {
  if (environment === 'production') {
    return { live: true, banner: false, review: 'approved' };
  }
  return { live: false, banner: true, review: routeReview ?? 'pending' };
}

export function preservedQuery(search: string): string {
  const current = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const next = new URLSearchParams();
  const environment = current.get('environment');
  const theme = current.get('theme');
  if (environment === 'production' || environment === 'staging') {
    next.set('environment', environment);
  }
  if (theme === 'dark' || theme === 'light') next.set('theme', theme);
  const value = next.toString();
  return value ? `?${value}` : '';
}

export function withQuery(path: string, search: string): string {
  return `${path}${preservedQuery(search)}`;
}
