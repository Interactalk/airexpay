export interface ErrorBody {
  error: {
    type: string;
    code: string;
    message: string;
    request_id: string;
  };
}

export function errorBody(
  requestId: string,
  type: string,
  code: string,
  message: string,
): ErrorBody {
  return { error: { type, code, message, request_id: requestId } };
}

export function logEvent(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'airexpay-api', ...fields }));
}

export function redactHeaders(headers: Headers): Record<string, string> {
  const hidden = new Set(['authorization', 'cookie', 'x-api-key']);
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const name = key.toLowerCase();
    out[name] = hidden.has(name) ? '[redacted]' : value;
  });
  return out;
}
