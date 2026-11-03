import { SIMULATION_EMAIL_CODE } from '@airexpay/configuration';
import {
  decryptDocumentBytes,
  encryptDocumentBytes,
  MockKycProvider,
  onboardingAudit,
  recordOnboardingEvent,
  type KycProvider,
  type OnboardingAuditEvent,
} from '@airexpay/payment-core';
import {
  identityDocumentKinds,
  type DocumentKind,
  type OnboardingStatus,
  type OnboardingStep,
} from '@airexpay/shared';
import {
  businessProfileSchema,
  consentsSchema,
  documentMimeFromBytes,
  MAX_DOCUMENT_BYTES,
  ownersStepSchema,
  signupSchema,
  verifyEmailSchema,
  type DocumentMime,
} from '@airexpay/validation';
import type { MemoryDatabase } from '../db/memory.ts';
import type {
  OnboardingApplication,
  OnboardingDocument,
  OnboardingSession,
  OnboardingSnapshot,
} from '../db/onboarding-store.ts';

export class OnboardingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'OnboardingError';
  }
}

export interface OnboardingDeps {
  db: MemoryDatabase;
  documentKey: string;
  provider?: KycProvider;
  now?: () => string;
  id?: () => string;
  simulation: boolean;
  load?: () => Promise<OnboardingSnapshot>;
  save?: (snapshot: OnboardingSnapshot) => Promise<void>;
  persist?: () => Promise<void>;
}

const STEP_ORDER: OnboardingStep[] = [
  'account',
  'business',
  'owners',
  'identity',
  'documents',
  'review',
];

export function publicApplication(
  application: OnboardingApplication,
  documents: OnboardingDocument[],
) {
  return {
    id: application.id,
    organization_id: application.organizationId,
    status: application.status,
    step: application.step,
    email: application.email,
    email_verified: application.emailVerified,
    business: application.business,
    representative: application.representative,
    owners: application.owners,
    no_ubo: application.noUbo,
    identity_document_type: application.identityDocumentType,
    consents: application.consents,
    needs_more_info: application.needsMoreInfo,
    provider: application.provider,
    provider_ref: application.providerRef,
    documents: documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      content_type: document.contentType,
      byte_length: document.byteLength,
      created_at: document.createdAt,
    })),
    updated_at: application.updatedAt,
  };
}

export async function signUp(deps: OnboardingDeps, body: unknown) {
  assertSimulation(deps);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) fail(400, 'validation_failed', 'Check the email and password');
  const email = parsed.data.email.toLowerCase();
  if (deps.db.onboarding.findUser(email)) {
    fail(409, 'email_in_use', 'That email is already registered in this simulation');
  }
  const organizationId = deps.id?.() ?? crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  const now = clock(deps);
  const passwordHash = await hashPassword(parsed.data.password);
  deps.db.onboarding.saveUser({
    email,
    organizationId,
    passwordHash,
    emailVerified: false,
  });
  const application = blankApplication({
    id: applicationId,
    organizationId,
    email,
    now,
  });
  const audit = onboardingAudit(
    {
      organizationId,
      applicationId,
      fromStatus: 'not_started',
      toStatus: 'in_progress',
      action: 'onboarding.started',
      actor: 'merchant',
    },
    transitionDeps(deps),
  );
  application.status = 'in_progress';
  deps.db.onboarding.saveApplication(application);
  deps.db.onboarding.addAudit(audit);
  await commit(deps);
  return {
    organization_id: organizationId,
    email,
    verification_required: true,
    simulation_code: SIMULATION_EMAIL_CODE,
  };
}

export async function verifyEmail(deps: OnboardingDeps, body: unknown) {
  assertSimulation(deps);
  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) fail(400, 'validation_failed', 'Check the email and code');
  if (parsed.data.code !== SIMULATION_EMAIL_CODE) {
    fail(400, 'invalid_code', 'That verification code was not accepted');
  }
  const user = deps.db.onboarding.findUser(parsed.data.email.toLowerCase());
  if (!user) fail(404, 'not_found', 'Sign up before verifying the email');
  user.emailVerified = true;
  deps.db.onboarding.saveUser(user);
  const application = requireApplication(deps, user.organizationId);
  application.emailVerified = true;
  application.updatedAt = clock(deps);
  deps.db.onboarding.saveApplication(application);
  const session = issueSession(deps, user.organizationId, user.email, 'owner');
  await commit(deps);
  return { token: session.token, application: view(deps, application) };
}

export function currentApplication(deps: OnboardingDeps, token: string) {
  const session = requireSession(deps, token);
  const application = requireApplication(deps, session.organizationId);
  return view(deps, application);
}

export async function saveStep(
  deps: OnboardingDeps,
  token: string,
  step: OnboardingStep,
  body: unknown,
) {
  const session = requireSession(deps, token);
  if (session.role !== 'owner')
    fail(403, 'forbidden', 'Only the account owner can edit onboarding');
  const application = requireApplication(deps, session.organizationId);
  if (!application.emailVerified)
    fail(400, 'email_unverified', 'Verify the email before continuing');
  if (application.status !== 'in_progress' && application.status !== 'needs_more_info') {
    fail(409, 'invalid_state', 'This application can no longer be edited');
  }
  if (stepIndex(step) > stepIndex(application.step) && application.status === 'in_progress') {
    fail(400, 'step_skipped', 'Finish the current step before moving ahead');
  }
  applyStep(application, step, body);
  const now = clock(deps);
  application.updatedAt = now;
  if (application.status === 'in_progress') application.step = laterStep(application.step, step);
  deps.db.onboarding.saveApplication(application);
  deps.db.onboarding.addAudit(
    recordOnboardingEvent(
      {
        organizationId: application.organizationId,
        applicationId: application.id,
        status: application.status,
        action: `onboarding.saved.${step}`,
        actor: 'merchant',
      },
      transitionDeps(deps),
    ),
  );
  await commit(deps);
  return view(deps, application);
}

export async function uploadDocument(
  deps: OnboardingDeps,
  token: string,
  kind: DocumentKind,
  bytes: Uint8Array,
) {
  const session = requireSession(deps, token);
  const application = requireApplication(deps, session.organizationId);
  if (application.status !== 'in_progress' && application.status !== 'needs_more_info') {
    fail(409, 'invalid_state', 'Documents cannot be added in this state');
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES) {
    fail(400, 'invalid_document', 'Documents must be larger than 0 bytes and at most 10 MB');
  }
  const contentType = documentMimeFromBytes(bytes);
  if (!contentType) {
    fail(400, 'invalid_document', 'Upload a JPG, PNG, or PDF file');
  }
  const ciphertext = await encryptDocumentBytes(bytes, deps.documentKey);
  const document: OnboardingDocument = {
    id: crypto.randomUUID(),
    organizationId: application.organizationId,
    applicationId: application.id,
    kind,
    contentType,
    byteLength: bytes.byteLength,
    ciphertext,
    createdAt: clock(deps),
  };
  deps.db.onboarding.saveDocument(document);
  application.updatedAt = document.createdAt;
  deps.db.onboarding.saveApplication(application);
  await commit(deps);
  return {
    id: document.id,
    kind: document.kind,
    content_type: document.contentType,
    byte_length: document.byteLength,
  };
}

export async function readDocument(deps: OnboardingDeps, token: string, documentId: string) {
  const session = requireSession(deps, token);
  const document = deps.db.onboarding.findDocument(documentId);
  if (!document) fail(404, 'not_found', 'Document not found');
  if (session.role !== 'admin' && document.organizationId !== session.organizationId) {
    fail(404, 'not_found', 'Document not found');
  }
  const bytes = await decryptDocumentBytes(document.ciphertext, deps.documentKey);
  return {
    bytes,
    contentType: document.contentType as DocumentMime,
    organizationId: document.organizationId,
  };
}

export async function submitApplication(deps: OnboardingDeps, token: string, body: unknown) {
  const session = requireSession(deps, token);
  const application = requireApplication(deps, session.organizationId);
  const consents = consentsSchema.safeParse(body);
  if (!consents.success) {
    fail(400, 'consent_required', 'Terms, privacy, and accuracy must be accepted');
  }
  assertReady(deps, application);
  const now = clock(deps);
  application.consents = { ...consents.data, at: now };
  move(deps, application, 'submitted', 'merchant', 'onboarding.submitted', null);
  const provider = deps.provider ?? new MockKycProvider();
  const result = await provider.submit({
    applicationId: application.id,
    organizationId: application.organizationId,
  });
  application.providerRef = result.providerRef;
  move(deps, application, 'under_review', 'system', 'onboarding.provider_submitted', null);
  await commit(deps);
  return view(deps, application);
}

export async function resubmit(deps: OnboardingDeps, token: string) {
  const session = requireSession(deps, token);
  const application = requireApplication(deps, session.organizationId);
  if (application.status !== 'needs_more_info') {
    fail(409, 'invalid_state', 'Nothing is waiting to be resubmitted');
  }
  const requestedAt = latestAuditTime(deps, application.id, 'needs_more_info');
  for (const item of application.needsMoreInfo) {
    const replaced = deps.db.onboarding
      .listDocuments(application.organizationId)
      .some((document) => document.kind === item.item && document.createdAt > requestedAt);
    const edited = application.updatedAt > requestedAt && !isDocumentKindValue(item.item);
    if (!replaced && !edited) {
      fail(400, 'item_missing', `Replace ${item.item} before resubmitting`);
    }
  }
  move(deps, application, 'submitted', 'merchant', 'onboarding.resubmitted', null);
  move(deps, application, 'under_review', 'system', 'onboarding.provider_submitted', null);
  application.needsMoreInfo = [];
  deps.db.onboarding.saveApplication(application);
  await commit(deps);
  return view(deps, application);
}

export async function simulateReview(
  deps: OnboardingDeps,
  organizationId: string,
  outcome: 'approved' | 'rejected' | 'needs_more_info' | 'under_review',
  item?: string,
  reason?: string,
) {
  assertSimulation(deps);
  const application = requireApplication(deps, organizationId);
  if (outcome === 'under_review') {
    if (application.status === 'submitted') {
      move(deps, application, 'under_review', 'admin', 'onboarding.simulated', reason ?? null);
    }
    await commit(deps);
    return view(deps, application);
  }
  if (application.status !== 'under_review') {
    fail(409, 'invalid_state', 'Simulation can review an application that is under review');
  }
  if (outcome === 'needs_more_info') {
    if (!item || !reason) fail(400, 'validation_failed', 'Say which item to replace and why');
    application.needsMoreInfo = [{ item, reason }];
  }
  move(deps, application, outcome, 'admin', 'onboarding.simulated', reason ?? null);
  await commit(deps);
  return view(deps, application);
}

export async function issueAdminSession(deps: OnboardingDeps) {
  assertSimulation(deps);
  const session = issueSession(deps, 'admin', 'admin@example.com', 'admin');
  await commit(deps);
  return { token: session.token };
}

async function commit(deps: OnboardingDeps): Promise<void> {
  await deps.persist?.();
}

function view(deps: OnboardingDeps, application: OnboardingApplication) {
  return publicApplication(
    application,
    deps.db.onboarding.listDocuments(application.organizationId),
  );
}

function applyStep(application: OnboardingApplication, step: OnboardingStep, body: unknown) {
  if (step === 'business') {
    const parsed = businessProfileSchema.safeParse(body);
    if (!parsed.success)
      fail(
        400,
        'validation_failed',
        parsed.error.issues[0]?.message ?? 'Check the business profile',
      );
    application.business = parsed.data;
    return;
  }
  if (step === 'owners') {
    const parsed = ownersStepSchema.safeParse(body);
    if (!parsed.success)
      fail(400, 'validation_failed', parsed.error.issues[0]?.message ?? 'Check the owner details');
    application.representative = parsed.data.representative;
    application.owners = parsed.data.owners;
    application.noUbo = parsed.data.no_ubo;
    return;
  }
  if (step === 'identity') {
    const parsed = identityTypeSchema(body);
    application.identityDocumentType = parsed;
    return;
  }
  if (step === 'account' || step === 'documents' || step === 'review') return;
  fail(400, 'validation_failed', 'Unknown step');
}

function identityTypeSchema(body: unknown): OnboardingApplication['identityDocumentType'] {
  if (!body || typeof body !== 'object' || !('identity_document_type' in body)) {
    fail(400, 'validation_failed', 'Choose a document type');
  }
  const value = (body as { identity_document_type?: unknown }).identity_document_type;
  if (value === 'passport' || value === 'national_id' || value === 'driving_licence') return value;
  fail(400, 'validation_failed', 'Choose a passport, national ID, or driving licence');
}

function assertReady(deps: OnboardingDeps, application: OnboardingApplication) {
  if (!application.emailVerified || !application.business || !application.representative) {
    fail(400, 'incomplete', 'Finish every step before submitting');
  }
  if (!application.identityDocumentType) fail(400, 'incomplete', 'Choose an identity document');
  const documents = deps.db.onboarding.listDocuments(application.organizationId);
  const kinds = new Set(documents.map((document) => document.kind));
  for (const kind of identityDocumentKinds(application.identityDocumentType)) {
    if (!kinds.has(kind)) fail(400, 'incomplete', `Add the ${kind.replaceAll('_', ' ')} photo`);
  }
  if (!kinds.has('selfie')) fail(400, 'incomplete', 'Add the selfie');
  if (!kinds.has('proof_of_address')) fail(400, 'incomplete', 'Add proof of address');
  if (!kinds.has('registration_certificate')) {
    fail(400, 'incomplete', 'Add the registration certificate');
  }
}

function move(
  deps: OnboardingDeps,
  application: OnboardingApplication,
  to: OnboardingStatus,
  actor: 'merchant' | 'system' | 'admin',
  action: string,
  reason: string | null,
) {
  const audit = onboardingAudit(
    {
      organizationId: application.organizationId,
      applicationId: application.id,
      fromStatus: application.status,
      toStatus: to,
      action,
      actor,
      reason,
    },
    transitionDeps(deps),
  );
  application.status = to;
  application.updatedAt = audit.createdAt;
  deps.db.onboarding.saveApplication(application);
  deps.db.onboarding.addAudit(audit);
}

function latestAuditTime(
  deps: OnboardingDeps,
  applicationId: string,
  status: OnboardingStatus,
): string {
  const events = deps.db.onboarding
    .listAudits()
    .filter((event) => event.applicationId === applicationId && event.toStatus === status);
  return events.at(-1)?.createdAt ?? '';
}

function issueSession(
  deps: OnboardingDeps,
  organizationId: string,
  email: string,
  role: 'owner' | 'admin',
): OnboardingSession {
  const now = Date.parse(clock(deps));
  const session: OnboardingSession = {
    token: crypto.randomUUID(),
    organizationId,
    email,
    role,
    expiresAt: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
  };
  deps.db.onboarding.saveSession(session);
  return session;
}

function requireSession(deps: OnboardingDeps, token: string): OnboardingSession {
  const session = deps.db.onboarding.findSession(token, clock(deps));
  if (!session) fail(401, 'unauthorized', 'Sign in again to continue onboarding');
  return session;
}

function requireApplication(deps: OnboardingDeps, organizationId: string): OnboardingApplication {
  const application = deps.db.onboarding.findApplication(organizationId);
  if (!application) fail(404, 'not_found', 'Onboarding has not been started');
  return application;
}

function blankApplication(input: {
  id: string;
  organizationId: string;
  email: string;
  now: string;
}): OnboardingApplication {
  return {
    id: input.id,
    organizationId: input.organizationId,
    status: 'not_started',
    step: 'account',
    email: input.email,
    emailVerified: false,
    business: null,
    representative: null,
    owners: [],
    noUbo: false,
    identityDocumentType: null,
    consents: { terms: false, privacy: false, accuracy: false, at: null },
    needsMoreInfo: [],
    provider: 'mock',
    providerRef: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function laterStep(current: OnboardingStep, saved: OnboardingStep): OnboardingStep {
  return stepIndex(saved) >= stepIndex(current) ? nextStep(saved) : current;
}

function nextStep(step: OnboardingStep): OnboardingStep {
  const index = stepIndex(step);
  return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)] ?? step;
}

function stepIndex(step: OnboardingStep): number {
  return STEP_ORDER.indexOf(step);
}

function isDocumentKindValue(value: string): boolean {
  return (
    value === 'passport' ||
    value === 'national_id_front' ||
    value === 'national_id_back' ||
    value === 'driving_licence_front' ||
    value === 'driving_licence_back' ||
    value === 'selfie' ||
    value === 'proof_of_address' ||
    value === 'registration_certificate'
  );
}

function assertSimulation(deps: OnboardingDeps) {
  if (!deps.simulation) fail(404, 'not_found', 'Route not found');
}

function clock(deps: OnboardingDeps): string {
  return deps.now?.() ?? new Date().toISOString();
}

function transitionDeps(deps: OnboardingDeps) {
  return {
    now: () => clock(deps),
    id: () => deps.id?.() ?? crypto.randomUUID(),
  };
}

function fail(status: number, code: string, message: string): never {
  throw new OnboardingError(message, status, code);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 20_000, hash: 'SHA-256' },
    key,
    256,
  );
  return `${toBase64(salt)}.${toBase64(new Uint8Array(bits))}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export type { OnboardingAuditEvent };
