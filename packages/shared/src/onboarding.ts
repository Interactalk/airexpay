export const ONBOARDING_STATUSES = [
  'not_started',
  'in_progress',
  'submitted',
  'under_review',
  'needs_more_info',
  'approved',
  'rejected',
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const ONBOARDING_STEPS = [
  'account',
  'business',
  'owners',
  'identity',
  'documents',
  'review',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const DOCUMENT_KINDS = [
  'passport',
  'national_id_front',
  'national_id_back',
  'driving_licence_front',
  'driving_licence_back',
  'selfie',
  'proof_of_address',
  'registration_certificate',
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const IDENTITY_DOCUMENT_TYPES = ['passport', 'national_id', 'driving_licence'] as const;

export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

export function isOnboardingStatus(value: string): value is OnboardingStatus {
  return (ONBOARDING_STATUSES as readonly string[]).includes(value);
}

export function isOnboardingStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/** Sides required before the liveness selfie. */
export function identityDocumentKinds(type: IdentityDocumentType): DocumentKind[] {
  switch (type) {
    case 'passport':
      return ['passport'];
    case 'national_id':
      return ['national_id_front', 'national_id_back'];
    case 'driving_licence':
      return ['driving_licence_front', 'driving_licence_back'];
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}
