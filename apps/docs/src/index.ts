const PAGE = `AirExpay API docs

This host is static. It does not read session cookies and it does not call the API.

Merchant requests use API keys against api.airexpay.com. Browser sessions are issued by auth.airexpay.com.
`;

export function handleDocs(): Response {
  return new Response(PAGE, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export default {
  fetch(): Response {
    return handleDocs();
  },
};
