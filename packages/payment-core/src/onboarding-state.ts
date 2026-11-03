import type { OnboardingStatus } from '@airexpay/shared';

/**
 * Onboarding transitions. Every accepted change is audited by the caller.
 *
 * not_started      → in_progress
 * in_progress      → submitted
 * submitted        → under_review
 * under_review     → approved, rejected, needs_more_info
 * needs_more_info  → submitted
 * approved, rejected are terminal
 */
export const ONBOARDING_TRANSITIONS = {
  not_started: ['in_progress'],
  in_progress: ['submitted'],
  submitted: ['under_review'],
  under_review: ['approved', 'rejected', 'needs_more_info'],
  needs_more_info: ['submitted'],
  approved: [],
  rejected: [],
} as const satisfies Record<OnboardingStatus, readonly OnboardingStatus[]>;

export function isOnboardingTransitionAllowed(
  from: OnboardingStatus,
  to: OnboardingStatus,
): boolean {
  return (ONBOARDING_TRANSITIONS[from] as readonly OnboardingStatus[]).includes(to);
}

export interface OnboardingAuditEvent {
  id: string;
  organizationId: string;
  applicationId: string;
  fromStatus: OnboardingStatus | null;
  toStatus: OnboardingStatus;
  action: string;
  actor: 'merchant' | 'system' | 'admin';
  reason: string | null;
  createdAt: string;
}

export interface OnboardingTransitionDeps {
  now: () => string;
  id: () => string;
}

export function assertOnboardingTransition(from: OnboardingStatus, to: OnboardingStatus): void {
  if (!isOnboardingTransitionAllowed(from, to)) {
    throw new Error(`Onboarding cannot move from ${from} to ${to}`);
  }
}

/** A note that does not change status, such as saving a step. */
export function recordOnboardingEvent(
  input: {
    organizationId: string;
    applicationId: string;
    status: OnboardingStatus;
    action: string;
    actor: OnboardingAuditEvent['actor'];
    reason?: string | null;
  },
  deps: OnboardingTransitionDeps,
): OnboardingAuditEvent {
  return {
    id: deps.id(),
    organizationId: input.organizationId,
    applicationId: input.applicationId,
    fromStatus: input.status,
    toStatus: input.status,
    action: input.action,
    actor: input.actor,
    reason: input.reason ?? null,
    createdAt: deps.now(),
  };
}

export function onboardingAudit(
  input: {
    organizationId: string;
    applicationId: string;
    fromStatus: OnboardingStatus | null;
    toStatus: OnboardingStatus;
    action: string;
    actor: OnboardingAuditEvent['actor'];
    reason?: string | null;
  },
  deps: OnboardingTransitionDeps,
): OnboardingAuditEvent {
  if (input.fromStatus) assertOnboardingTransition(input.fromStatus, input.toStatus);
  return {
    id: deps.id(),
    organizationId: input.organizationId,
    applicationId: input.applicationId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    action: input.action,
    actor: input.actor,
    reason: input.reason ?? null,
    createdAt: deps.now(),
  };
}
