import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ALLOWED_BUSINESS_CATEGORIES,
  ENTITY_TYPES,
  PROHIBITED_BUSINESS_CATEGORIES,
} from '@airexpay/validation';
import {
  identityDocumentKinds,
  type IdentityDocumentType,
  type OnboardingStep,
} from '@airexpay/shared';
import { CameraCapture } from '../../components/onboarding/CameraCapture.tsx';
import {
  loadApplication,
  rememberSession,
  rememberStatus,
  resubmitApplication,
  saveStep,
  signup,
  submitApplication,
  uploadDocument,
  verifyEmail,
  type ApplicationView,
} from './api.ts';

const STEPS: { id: OnboardingStep | 'status'; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'business', label: 'Business' },
  { id: 'owners', label: 'Owners' },
  { id: 'identity', label: 'Identity' },
  { id: 'documents', label: 'Documents' },
  { id: 'review', label: 'Review' },
  { id: 'status', label: 'Status' },
];

const DOCUMENT_LABELS: Record<string, string> = {
  passport: 'Passport photo page',
  national_id_front: 'National ID front',
  national_id_back: 'National ID back',
  driving_licence_front: 'Driving licence front',
  driving_licence_back: 'Driving licence back',
  selfie: 'Liveness selfie',
  proof_of_address: 'Proof of address',
  registration_certificate: 'Registration certificate',
};

export function OnboardingPage({ preview = false }: { preview?: boolean }) {
  const params = useParams();
  const requested = params.step ?? 'account';
  const step = (STEPS.some((item) => item.id === requested) ? requested : 'account') as
    OnboardingStep | 'status';
  return (
    <div className="onboarding">
      <Link to="/" className="brand">
        Airex<span>pay</span>
      </Link>
      <h1 style={{ fontSize: 28, margin: '18px 0 6px' }}>Merchant onboarding</h1>
      <p className="muted">
        Simulation only. AirExpay does not claim to be licensed or compliant. Document retention and
        the KYC provider are still waiting on legal review.
      </p>
      <ol className="stepper" aria-label="Onboarding progress" style={{ margin: '18px 0' }}>
        {STEPS.map((item) => (
          <span key={item.id} className={item.id === step ? 'on' : undefined}>
            {item.label}
          </span>
        ))}
      </ol>
      {preview ? <PreviewStep step={step} /> : <LiveStep step={step} />}
    </div>
  );
}

function LiveStep({ step }: { step: OnboardingStep | 'status' }) {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [application, setApplication] = useState<ApplicationView | null>(null);

  useEffect(() => {
    if (!sessionStorage.getItem('airexpay.onboarding.token')) return;
    void loadApplication()
      .then((next) => {
        rememberStatus(next.status);
        setApplication(next);
      })
      .catch(() => undefined);
  }, []);

  async function run(task: () => Promise<void>) {
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The onboarding service is not reachable.',
      );
    }
  }

  return (
    <div>
      {error ? <p role="alert">{error}</p> : null}
      {info ? <p role="status">{info}</p> : null}
      {step === 'account' ? (
        <AccountStep
          onSignup={async (email, password) => {
            const result = (await signup(email, password)) as { simulation_code?: string };
            setInfo(
              `Simulation code: ${result.simulation_code ?? '000000'}. It is a public placeholder.`,
            );
          }}
          onVerify={async (email, code) => {
            const result = await verifyEmail(email, code);
            rememberSession(result.token, result.application.status);
            setApplication(result.application);
          }}
          run={run}
        />
      ) : null}
      {step === 'business' ? (
        <BusinessStep
          onSave={async (body) => {
            const next = await saveStep('business', body);
            rememberStatus(next.status);
            setApplication(next);
          }}
          run={run}
        />
      ) : null}
      {step === 'owners' ? (
        <OwnersStep
          onSave={async (body) => {
            const next = await saveStep('owners', body);
            rememberStatus(next.status);
            setApplication(next);
          }}
          run={run}
        />
      ) : null}
      {step === 'identity' ? (
        <IdentityStep
          preview={false}
          onUpload={async (kind, file) => {
            await uploadDocument(kind, file);
            const next = await loadApplication();
            setApplication(next);
          }}
          onType={async (type) => {
            const next = await saveStep('identity', { identity_document_type: type });
            setApplication(next);
          }}
          saved={new Set(application?.documents.map((document) => document.kind) ?? [])}
          run={run}
        />
      ) : null}
      {step === 'documents' ? (
        <DocumentsStep
          preview={false}
          onUpload={async (kind, file) => {
            await uploadDocument(kind, file);
          }}
          run={run}
        />
      ) : null}
      {step === 'review' ? (
        <ReviewStep
          application={application}
          onSubmit={async (consents) => {
            const next = await submitApplication(consents);
            rememberStatus(next.status);
            setApplication(next);
          }}
          run={run}
        />
      ) : null}
      {step === 'status' ? (
        <StatusStep
          application={application}
          onLoad={async () => {
            const next = await loadApplication();
            rememberStatus(next.status);
            setApplication(next);
          }}
          onResubmit={async () => {
            const next = await resubmitApplication();
            rememberStatus(next.status);
            setApplication(next);
          }}
          run={run}
        />
      ) : null}
      <StepLinks step={step} />
    </div>
  );
}

function PreviewStep({ step }: { step: OnboardingStep | 'status' }) {
  const [search] = useSearchParams();
  const previewStatus = search.get('state') === 'submitted' ? 'submitted' : 'needs_more_info';
  if (step === 'account')
    return (
      <AccountStep
        onSignup={async () => undefined}
        onVerify={async () => undefined}
        run={async (task) => task()}
      />
    );
  if (step === 'business')
    return <BusinessStep onSave={async () => undefined} run={async (task) => task()} />;
  if (step === 'owners')
    return <OwnersStep onSave={async () => undefined} run={async (task) => task()} />;
  if (step === 'identity') {
    return (
      <IdentityStep
        preview
        saved={new Set()}
        onUpload={async () => undefined}
        onType={async () => undefined}
        run={async (task) => task()}
      />
    );
  }
  if (step === 'documents') {
    return <DocumentsStep preview onUpload={async () => undefined} run={async (task) => task()} />;
  }
  if (step === 'review')
    return (
      <ReviewStep
        application={null}
        onSubmit={async () => undefined}
        run={async (task) => task()}
      />
    );
  return (
    <StatusStep
      application={{
        status: previewStatus,
        step: 'review',
        email: 'alex@example.com',
        email_verified: true,
        business: null,
        representative: null,
        owners: [],
        no_ubo: false,
        identity_document_type: 'passport',
        needs_more_info: [{ item: 'selfie', reason: 'The selfie was too dark. Retake it.' }],
        documents: [],
      }}
      onLoad={async () => undefined}
      onResubmit={async () => undefined}
      run={async (task) => task()}
    />
  );
}

function AccountStep({
  onSignup,
  onVerify,
  run,
}: {
  onSignup: (email: string, password: string) => Promise<void>;
  onVerify: (email: string, code: string) => Promise<void>;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  const [email, setEmail] = useState('alex@example.com');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Sign up and verify email</h2>
      <p className="muted">
        This follows a Supabase Auth shaped flow, mocked on this machine. No message is sent.
      </p>
      <label className="label">
        Email
        <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="label">
        Password
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void run(() => onSignup(email, password))}
      >
        Create account
      </button>
      <label className="label" style={{ marginTop: 16 }}>
        Verification code
        <input
          className="input"
          inputMode="numeric"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => void run(() => onVerify(email, code))}
      >
        Verify email
      </button>
    </section>
  );
}

function BusinessStep({
  onSave,
  run,
}: {
  onSave: (body: Record<string, string>) => Promise<void>;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    legal_name: 'Northwind Studio LLC',
    country: 'US',
    entity_type: 'llc',
    website: 'https://example.com',
    category: 'software',
    expected_monthly_volume: '25000.00',
  });
  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Business profile</h2>
      <p className="muted">
        Categories prohibited by NOWPayments merchant terms are rejected. This is not a licence
        decision.
      </p>
      {(['legal_name', 'country', 'website', 'expected_monthly_volume'] as const).map((field) => (
        <label key={field} className="label">
          {field.replaceAll('_', ' ')}
          <input
            className="input"
            value={form[field]}
            onChange={(event) => setForm({ ...form, [field]: event.target.value })}
          />
        </label>
      ))}
      <label className="label">
        Entity type
        <select
          className="input"
          value={form.entity_type}
          onChange={(event) => setForm({ ...form, entity_type: event.target.value })}
        >
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="label">
        Category
        <select
          className="input"
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
        >
          {ALLOWED_BUSINESS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.replaceAll('_', ' ')}
            </option>
          ))}
          {PROHIBITED_BUSINESS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.replaceAll('_', ' ')} (blocked)
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void run(() => onSave(form))}
      >
        Save and continue
      </button>
    </section>
  );
}

function OwnersStep({
  onSave,
  run,
}: {
  onSave: (body: unknown) => Promise<void>;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  const [representative, setRepresentative] = useState({
    given_name: 'Alex',
    family_name: 'Kim',
    date_of_birth: '1990-04-12',
    nationality: 'US',
  });
  const [ownership, setOwnership] = useState('40');
  const [noUbo, setNoUbo] = useState(false);
  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Representative and owners</h2>
      <p className="muted">
        List every person who owns 25% or more. Those people are the UBOs for this application.
      </p>
      {(['given_name', 'family_name', 'date_of_birth', 'nationality'] as const).map((field) => (
        <label key={field} className="label">
          Representative {field.replaceAll('_', ' ')}
          <input
            className="input"
            value={representative[field]}
            onChange={(event) =>
              setRepresentative({ ...representative, [field]: event.target.value })
            }
          />
        </label>
      ))}
      <label className="label">
        UBO ownership percent
        <input
          className="input"
          value={ownership}
          onChange={(event) => setOwnership(event.target.value)}
        />
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={noUbo}
          onChange={(event) => setNoUbo(event.target.checked)}
        />
        No individual owns 25% or more
      </label>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() =>
          void run(() =>
            onSave({
              representative,
              no_ubo: noUbo,
              owners: noUbo ? [] : [{ ...representative, ownership_percent: Number(ownership) }],
            }),
          )
        }
      >
        Save and continue
      </button>
    </section>
  );
}

function IdentityStep({
  preview,
  saved,
  onUpload,
  onType,
  run,
}: {
  preview: boolean;
  saved: Set<string>;
  onUpload: (kind: string, file: Blob) => Promise<void>;
  onType: (type: IdentityDocumentType) => Promise<void>;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  const [type, setType] = useState<IdentityDocumentType>('passport');
  const kinds = [...identityDocumentKinds(type), 'selfie' as const];
  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Identity documents</h2>
      <label className="label">
        Document type
        <select
          className="input"
          value={type}
          onChange={(event) => setType(event.target.value as IdentityDocumentType)}
        >
          <option value="passport">Passport</option>
          <option value="national_id">National ID</option>
          <option value="driving_licence">Driving licence</option>
        </select>
      </label>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => void run(() => onType(type))}
      >
        Save document type
      </button>
      {kinds.map((kind) => (
        <div key={kind} style={{ marginTop: 18 }}>
          <CameraCapture
            facing={kind === 'selfie' ? 'user' : 'environment'}
            liveness={kind === 'selfie'}
            label={DOCUMENT_LABELS[kind] ?? kind}
            onConfirm={(file) => {
              if (!preview) void run(() => onUpload(kind, file));
            }}
          />
          {saved.has(kind) ? (
            <p className="muted">
              Saved for this application. The image is not kept in the browser.
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function DocumentsStep({
  preview,
  onUpload,
  run,
}: {
  preview: boolean;
  onUpload: (kind: string, file: Blob) => Promise<void>;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Proof of address and business documents</h2>
      {(['proof_of_address', 'registration_certificate'] as const).map((kind) => (
        <div key={kind} style={{ marginTop: 18 }}>
          <CameraCapture
            facing="environment"
            label={DOCUMENT_LABELS[kind] ?? kind}
            onConfirm={(file) => {
              if (!preview) void run(() => onUpload(kind, file));
            }}
          />
        </div>
      ))}
    </section>
  );
}

function ReviewStep({
  application,
  onSubmit,
  run,
}: {
  application: ApplicationView | null;
  onSubmit: (consents: { terms: true; privacy: true; accuracy: true }) => Promise<void>;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Review and submit</h2>
      <p>Email: {application?.email ?? 'alex@example.com'}</p>
      <p>Business: {application?.business?.legal_name ?? 'Northwind Studio LLC'}</p>
      <label className="row">
        <input
          type="checkbox"
          checked={terms}
          onChange={(event) => setTerms(event.target.checked)}
        />
        I agree to the <Link to="/terms">Terms</Link> (draft placeholder)
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(event) => setPrivacy(event.target.checked)}
        />
        I agree to the <Link to="/privacy">Privacy</Link> note (draft placeholder)
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={accuracy}
          onChange={(event) => setAccuracy(event.target.checked)}
        />
        The information and documents are accurate to the best of my knowledge
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!terms || !privacy || !accuracy}
        onClick={() => {
          if (!terms || !privacy || !accuracy) return;
          void run(() => onSubmit({ terms: true, privacy: true, accuracy: true }));
        }}
      >
        Submit application
      </button>
    </section>
  );
}

function StatusStep({
  application,
  onLoad,
  onResubmit,
  run,
}: {
  application: ApplicationView | null;
  onLoad: () => Promise<void>;
  onResubmit: () => Promise<void>;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  const status = application?.status ?? 'not_started';
  return (
    <section className="card" style={{ padding: 20 }} data-testid="onboarding-status">
      <h2 style={{ marginTop: 0 }}>Application status</h2>
      <p className="badge s-confirming" style={{ width: 'fit-content' }}>
        {status.replaceAll('_', ' ')}
      </p>
      <p className="muted">
        Statuses: not started, in progress, submitted, under review, needs more info, approved,
        rejected.
      </p>
      <button type="button" className="btn btn-outline" onClick={() => void run(onLoad)}>
        Refresh status
      </button>
      {status === 'needs_more_info' ? (
        <div style={{ marginTop: 12 }}>
          {application?.needs_more_info.map((item) => (
            <p key={item.item}>
              <strong>{item.item.replaceAll('_', ' ')}</strong>: {item.reason}
            </p>
          ))}
          <Link className="btn btn-outline" to="/onboarding/identity">
            Replace the requested item
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => void run(onResubmit)}>
            Resubmit
          </button>
        </div>
      ) : null}
      {status === 'approved' ? (
        <p>
          Onboarding is approved. Go-live review can proceed. Live keys are still issued by
          AirExpay, not from this page.
        </p>
      ) : null}
      {status === 'rejected' ? (
        <p>This application was rejected in the simulation. It does not create a live account.</p>
      ) : null}
    </section>
  );
}

function StepLinks({ step }: { step: string }) {
  const index = STEPS.findIndex((item) => item.id === step);
  const previous = STEPS[index - 1];
  const next = STEPS[index + 1];
  return (
    <div className="row" style={{ marginTop: 16 }}>
      {previous ? (
        <Link className="btn btn-outline" to={`/onboarding/${previous.id}`}>
          Back
        </Link>
      ) : null}
      {next ? (
        <Link className="btn btn-outline" to={`/onboarding/${next.id}`}>
          Next
        </Link>
      ) : null}
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="onboarding">
      <h1>Terms (draft placeholder)</h1>
      <p>
        These terms are not final. They do not say that AirExpay is licensed or compliant. Retention
        periods are TODO for legal review.
      </p>
      <Link className="btn btn-outline" to="/onboarding/review">
        Back to review
      </Link>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="onboarding">
      <h1>Privacy (draft placeholder)</h1>
      <p>
        Identity images are encrypted at rest and are not public. How long they are kept, and which
        KYC provider reviews them, is TODO for legal review.
      </p>
      <Link className="btn btn-outline" to="/onboarding/review">
        Back to review
      </Link>
    </div>
  );
}
