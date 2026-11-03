/**
 * KYC/KYB provider boundary.
 *
 * MockKycProvider is the only implementation. Sumsub, Persona, and Onfido are
 * not integrated. Which provider to use, and how long documents are kept, is
 * TODO for legal review. This module does not claim that AirExpay is licensed
 * or compliant.
 */

export interface KycSubmission {
  applicationId: string;
  organizationId: string;
}

export interface KycProvider {
  readonly name: 'mock';
  submit(input: KycSubmission): Promise<{ providerRef: string }>;
}

export class MockKycProvider implements KycProvider {
  readonly name = 'mock' as const;

  submit(input: KycSubmission): Promise<{ providerRef: string }> {
    return Promise.resolve({ providerRef: `mock_${input.applicationId}` });
  }
}
