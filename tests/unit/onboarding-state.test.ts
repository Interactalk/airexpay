import {
  isOnboardingTransitionAllowed,
  ONBOARDING_TRANSITIONS,
  onboardingAudit,
} from '@airexpay/payment-core';
import { ONBOARDING_STATUSES, type OnboardingStatus } from '@airexpay/shared';
import {
  businessProfileSchema,
  documentMimeFromBytes,
  PROHIBITED_BUSINESS_CATEGORIES,
} from '@airexpay/validation';
import { describe, expect, it } from 'vitest';

describe('onboarding state machine', () => {
  it('lists every status and refuses terminal moves', () => {
    expect(Object.keys(ONBOARDING_TRANSITIONS)).toEqual([...ONBOARDING_STATUSES]);
    expect(isOnboardingTransitionAllowed('approved', 'in_progress')).toBe(false);
    expect(isOnboardingTransitionAllowed('rejected', 'submitted')).toBe(false);
    expect(isOnboardingTransitionAllowed('under_review', 'needs_more_info')).toBe(true);
    expect(isOnboardingTransitionAllowed('needs_more_info', 'submitted')).toBe(true);
  });

  it('audits an allowed transition and rejects a skip', () => {
    const event = onboardingAudit(
      {
        organizationId: 'org',
        applicationId: 'app',
        fromStatus: 'in_progress',
        toStatus: 'submitted',
        action: 'onboarding.submitted',
        actor: 'merchant',
      },
      { now: () => '2026-11-03T00:00:00.000Z', id: () => 'evt_1' },
    );
    expect(event.toStatus).toBe('submitted');
    expect(() =>
      onboardingAudit(
        {
          organizationId: 'org',
          applicationId: 'app',
          fromStatus: 'in_progress',
          toStatus: 'approved',
          action: 'skip',
          actor: 'merchant',
        },
        { now: () => '2026-11-03T00:00:00.000Z', id: () => 'evt_2' },
      ),
    ).toThrow(/cannot move/);
  });

  it('blocks prohibited business categories', () => {
    for (const category of PROHIBITED_BUSINESS_CATEGORIES) {
      const parsed = businessProfileSchema.safeParse({
        legal_name: 'Example LLC',
        country: 'us',
        entity_type: 'llc',
        website: 'https://example.com',
        category,
        expected_monthly_volume: '1000.00',
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('identifies documents from magic bytes and ignores the name', () => {
    expect(documentMimeFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(
      documentMimeFromBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(documentMimeFromBytes(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(documentMimeFromBytes(new TextEncoder().encode('not a file'))).toBeNull();
  });
});

describe('onboarding transitions are exhaustive', () => {
  it('has no unknown status', () => {
    const statuses: OnboardingStatus[] = [...ONBOARDING_STATUSES];
    expect(statuses).toContain('needs_more_info');
  });
});
