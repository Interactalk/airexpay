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
 * The Live mode pill replaces the banner only after onboarding is approved
 * and the environment is production. The thin strip is never used for the pill.
 * Live keys stay locked until that approval.
 */
export function resolveChrome(
  environment: AppEnvironment,
  routeReview: ReviewState | null,
  onboardingApproved = false,
): { live: boolean; banner: boolean; review: ReviewState; onboardingApproved: boolean } {
  if (environment === 'production' && onboardingApproved) {
    return { live: true, banner: false, review: 'approved', onboardingApproved: true };
  }
  return {
    live: false,
    banner: true,
    review: routeReview ?? 'pending',
    onboardingApproved,
  };
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
