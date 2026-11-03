import { apiUrl } from '../../apiBase.ts';

const TOKEN_KEY = 'airexpay.onboarding.token';
const STATUS_KEY = 'airexpay.onboarding.status';

export function onboardingToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function rememberSession(token: string, status: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(STATUS_KEY, status);
}

export function rememberStatus(status: string) {
  sessionStorage.setItem(STATUS_KEY, status);
}

async function request(path: string, init: RequestInit = {}) {
  const token = onboardingToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(apiUrl(path), { ...init, headers });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error?: { message?: string } }).error?.message ?? 'Request failed')
        : 'Request failed';
    throw new Error(message);
  }
  return body;
}

export function signup(email: string, password: string) {
  return request('/v1/onboarding/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function verifyEmail(email: string, code: string) {
  return request('/v1/onboarding/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  }) as Promise<{ token: string; application: ApplicationView }>;
}

export function loadApplication() {
  return request('/v1/onboarding') as Promise<ApplicationView>;
}

export function saveStep(step: string, body: unknown) {
  return request(`/v1/onboarding/steps/${step}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as Promise<ApplicationView>;
}

export async function uploadDocument(kind: string, file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return request('/v1/onboarding/documents', {
    method: 'POST',
    body: JSON.stringify({ kind, data_base64: btoa(binary) }),
  });
}

export function submitApplication(consents: { terms: true; privacy: true; accuracy: true }) {
  return request('/v1/onboarding/submit', {
    method: 'POST',
    body: JSON.stringify(consents),
  }) as Promise<ApplicationView>;
}

export function resubmitApplication() {
  return request('/v1/onboarding/resubmit', { method: 'POST' }) as Promise<ApplicationView>;
}

export interface ApplicationView {
  status: string;
  step: string;
  email: string;
  email_verified: boolean;
  business: Record<string, string> | null;
  representative: Record<string, string> | null;
  owners: Array<Record<string, string | number>>;
  no_ubo: boolean;
  identity_document_type: string | null;
  needs_more_info: Array<{ item: string; reason: string }>;
  documents: Array<{ id: string; kind: string }>;
}
