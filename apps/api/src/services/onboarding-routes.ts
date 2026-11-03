import { isDocumentKind, isOnboardingStep } from '@airexpay/shared';
import type { Context } from 'hono';
import { errorBody } from '../http.ts';
import {
  currentApplication,
  issueAdminSession,
  OnboardingError,
  readDocument,
  resubmit,
  saveStep,
  signUp,
  simulateReview,
  submitApplication,
  uploadDocument,
  verifyEmail,
  type OnboardingDeps,
} from './onboarding.ts';

export async function handleOnboarding(
  c: Context,
  deps: OnboardingDeps,
  action: string,
): Promise<Response> {
  const requestId = c.get('requestId') as string;
  const live = await openOnboarding(deps);
  try {
    if (action === 'signup') return c.json(await signUp(live, await c.req.json()), 201);
    if (action === 'verify') return c.json(await verifyEmail(live, await c.req.json()), 200);
    if (action === 'admin-session') return c.json(await issueAdminSession(live), 200);
    const token = bearer(c);
    if (action === 'get') return c.json(currentApplication(live, token), 200);
    if (action === 'step') {
      const step = c.req.param('step') ?? '';
      if (!isOnboardingStep(step)) {
        return c.json(
          errorBody(requestId, 'invalid_request_error', 'validation_failed', 'Unknown step'),
          400,
        );
      }
      return c.json(await saveStep(live, token, step, await c.req.json()), 200);
    }
    if (action === 'upload') {
      const body = (await c.req.json()) as { kind?: unknown; data_base64?: unknown };
      if (typeof body.kind !== 'string' || !isDocumentKind(body.kind)) {
        return c.json(
          errorBody(requestId, 'invalid_request_error', 'validation_failed', 'Unknown document'),
          400,
        );
      }
      if (typeof body.data_base64 !== 'string') {
        return c.json(
          errorBody(
            requestId,
            'invalid_request_error',
            'validation_failed',
            'Document bytes are required',
          ),
          400,
        );
      }
      const bytes = decodeBase64(body.data_base64);
      return c.json(await uploadDocument(live, token, body.kind, bytes), 201);
    }
    if (action === 'download') {
      const file = await readDocument(live, token, c.req.param('documentId') ?? '');
      const body = new Uint8Array(file.bytes.byteLength);
      body.set(file.bytes);
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': file.contentType,
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }
    if (action === 'submit')
      return c.json(await submitApplication(live, token, await c.req.json()), 200);
    if (action === 'resubmit') return c.json(await resubmit(live, token), 200);
    if (action === 'simulate') {
      const body = (await c.req.json()) as {
        outcome?: 'approved' | 'rejected' | 'needs_more_info' | 'under_review';
        item?: string;
        reason?: string;
      };
      if (
        body.outcome !== 'approved' &&
        body.outcome !== 'rejected' &&
        body.outcome !== 'needs_more_info' &&
        body.outcome !== 'under_review'
      ) {
        return c.json(
          errorBody(requestId, 'invalid_request_error', 'validation_failed', 'Unknown outcome'),
          400,
        );
      }
      return c.json(
        await simulateReview(
          live,
          c.req.param('organizationId') ?? '',
          body.outcome,
          body.item,
          body.reason,
        ),
        200,
      );
    }
    return c.json(
      errorBody(requestId, 'invalid_request_error', 'not_found', 'Route not found'),
      404,
    );
  } catch (error) {
    if (error instanceof OnboardingError) {
      return c.json(
        errorBody(requestId, 'invalid_request_error', error.code, error.message),
        error.status as 400,
      );
    }
    throw error;
  }
}

async function openOnboarding(deps: OnboardingDeps): Promise<OnboardingDeps> {
  if (!deps.load) return deps;
  const { MemoryDatabase } = await import('../db/memory.ts');
  const db = new MemoryDatabase();
  db.onboarding.restore(await deps.load());
  return {
    ...deps,
    db,
    persist: async () => {
      await deps.save?.(db.onboarding.snapshot());
    },
  };
}

function bearer(c: Context): string {
  const header = c.req.header('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim().replaceAll('-', '+').replaceAll('_', '/');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new OnboardingError('Document bytes are not valid', 400, 'invalid_document');
  }
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
