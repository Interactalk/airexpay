const PAGES: Record<string, string> = {
  '/': 'AirExpay marketing. Pricing and the waitlist live here. This Worker does not ship the dashboard or checkout.',
  '/pricing': 'Pricing coming soon. No amounts are published on this host.',
  '/waitlist': 'Waitlist. This host does not set a session cookie.',
};

/** Marketing Worker. No dashboard, checkout, or auth code is imported. */
export function handleMarketing(request: Request): Response {
  const url = new URL(request.url);
  if (url.hostname === 'www.airexpay.com') {
    return Response.redirect('https://airexpay.com' + url.pathname + url.search, 301);
  }
  const body = PAGES[url.pathname];
  if (!body) return new Response('Not found', { status: 404 });
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default {
  fetch(request: Request): Response {
    return handleMarketing(request);
  },
};
