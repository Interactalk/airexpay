import { useLocation, useMatch, useSearchParams } from 'react-router-dom';
import { isReviewState, readEnvironment, resolveChrome } from './lib/chrome.ts';

export function useChrome() {
  const location = useLocation();
  const [search] = useSearchParams();
  const matched = useMatch('/dashboard/api-keys/:reviewState');
  const segment = matched?.params.reviewState;
  const routeReview = isReviewState(segment) ? segment : null;
  const environment = readEnvironment(search.get('environment'));
  return {
    ...resolveChrome(environment, routeReview),
    environment,
    search: location.search,
  };
}
