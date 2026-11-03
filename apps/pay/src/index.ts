import { payResponse } from '@airexpay/config';

/** Public checkout surface. Auth cookies are removed before the handler and never copied onto the response. */
export function handlePay(request: Request): Promise<Response> {
  return payResponse(request, (stripped) =>
    Response.json({
      surface: 'pay',
      public: true,
      cookie: stripped.headers.get('cookie'),
    }),
  );
}

export default {
  fetch(request: Request): Promise<Response> {
    return handlePay(request);
  },
};
