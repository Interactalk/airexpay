import type { DocumentKind, OnboardingStatus, OnboardingStep } from '@airexpay/shared';
import type { OnboardingAuditEvent } from '@airexpay/payment-core';

export interface OnboardingBusiness {
  legal_name: string;
  country: string;
  entity_type: string;
  website: string;
  category: string;
  expected_monthly_volume: string;
}

export interface OnboardingPerson {
  given_name: string;
  family_name: string;
  date_of_birth: string;
  nationality: string;
  ownership_percent?: number;
}

export interface OnboardingConsents {
  terms: boolean;
  privacy: boolean;
  accuracy: boolean;
  at: string | null;
}

export interface NeedsMoreInfo {
  item: string;
  reason: string;
}

export interface OnboardingApplication {
  id: string;
  organizationId: string;
  status: OnboardingStatus;
  step: OnboardingStep;
  email: string;
  emailVerified: boolean;
  business: OnboardingBusiness | null;
  representative: OnboardingPerson | null;
  owners: OnboardingPerson[];
  noUbo: boolean;
  identityDocumentType: 'passport' | 'national_id' | 'driving_licence' | null;
  consents: OnboardingConsents;
  needsMoreInfo: NeedsMoreInfo[];
  provider: 'mock';
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingUser {
  email: string;
  organizationId: string;
  passwordHash: string;
  emailVerified: boolean;
}

export interface OnboardingSession {
  token: string;
  organizationId: string;
  email: string;
  role: 'owner' | 'admin';
  expiresAt: string;
}

export interface OnboardingDocument {
  id: string;
  organizationId: string;
  applicationId: string;
  kind: DocumentKind;
  contentType: 'image/jpeg' | 'image/png' | 'application/pdf';
  byteLength: number;
  ciphertext: string;
  createdAt: string;
}

export interface OnboardingSnapshot {
  users: OnboardingUser[];
  sessions: OnboardingSession[];
  applications: OnboardingApplication[];
  documents: OnboardingDocument[];
  audits: OnboardingAuditEvent[];
}

export function emptyOnboardingSnapshot(): OnboardingSnapshot {
  return { users: [], sessions: [], applications: [], documents: [], audits: [] };
}

/** In-memory onboarding records. Document fields hold ciphertext only. */
export class OnboardingRecords {
  private users: OnboardingUser[] = [];
  private sessions: OnboardingSession[] = [];
  private applications: OnboardingApplication[] = [];
  private documents: OnboardingDocument[] = [];
  private audits: OnboardingAuditEvent[] = [];

  snapshot(): OnboardingSnapshot {
    return {
      users: structuredClone(this.users),
      sessions: structuredClone(this.sessions),
      applications: structuredClone(this.applications),
      documents: structuredClone(this.documents),
      audits: structuredClone(this.audits),
    };
  }

  restore(snapshot: OnboardingSnapshot | undefined): void {
    const data = snapshot ?? emptyOnboardingSnapshot();
    this.users = structuredClone(data.users);
    this.sessions = structuredClone(data.sessions);
    this.applications = structuredClone(data.applications);
    this.documents = structuredClone(data.documents);
    this.audits = structuredClone(data.audits);
  }

  listAudits(): readonly OnboardingAuditEvent[] {
    return this.audits;
  }

  addAudit(event: OnboardingAuditEvent): void {
    this.audits.push(event);
  }

  findUser(email: string): OnboardingUser | null {
    return this.users.find((user) => user.email === email.toLowerCase()) ?? null;
  }

  saveUser(user: OnboardingUser): void {
    const email = user.email.toLowerCase();
    const next = { ...user, email };
    const index = this.users.findIndex((row) => row.email === email);
    if (index === -1) this.users.push(next);
    else this.users[index] = next;
  }

  saveSession(session: OnboardingSession): void {
    this.sessions = this.sessions.filter((row) => row.token !== session.token);
    this.sessions.push(session);
  }

  findSession(token: string, nowIso: string): OnboardingSession | null {
    const session = this.sessions.find((row) => row.token === token);
    if (!session || session.expiresAt <= nowIso) return null;
    return session;
  }

  findApplication(organizationId: string): OnboardingApplication | null {
    return this.applications.find((row) => row.organizationId === organizationId) ?? null;
  }

  saveApplication(application: OnboardingApplication): void {
    const index = this.applications.findIndex((row) => row.id === application.id);
    if (index === -1) this.applications.push(structuredClone(application));
    else this.applications[index] = structuredClone(application);
  }

  saveDocument(document: OnboardingDocument): OnboardingDocument {
    this.documents = this.documents.filter(
      (row) => !(row.applicationId === document.applicationId && row.kind === document.kind),
    );
    this.documents.push(structuredClone(document));
    return document;
  }

  findDocument(id: string): OnboardingDocument | null {
    return this.documents.find((row) => row.id === id) ?? null;
  }

  listDocuments(organizationId: string): OnboardingDocument[] {
    return this.documents.filter((row) => row.organizationId === organizationId);
  }
}
