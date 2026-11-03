import type { ReviewState } from '../lib/chrome.ts';
import { Icon } from './Icon.tsx';
import { StatusBadge } from './StatusBadge.tsx';

const STEPS = [
  'Business details',
  'Settlement addresses verified',
  'Integration tested in simulation',
  'AirExpay review',
] as const;

const DONE: Record<ReviewState, boolean[]> = {
  pending: [true, true, true, false],
  approved: [true, true, true, true],
  rejected: [true, false, true, false],
};

export function GoLiveReview({
  review,
  notice,
  onResubmit,
}: {
  review: ReviewState;
  notice: string | null;
  onResubmit: () => void;
}) {
  return (
    <div
      className="card"
      style={{ padding: '18px 20px', marginBottom: 16 }}
      data-testid="go-live-review"
    >
      <div className="row between" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 560 }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <h3>Go-live review</h3>
            {review === 'pending' ? (
              <StatusBadge status="confirming" audience="dashboard" label="Review pending" />
            ) : null}
            {review === 'approved' ? (
              <StatusBadge status="paid" audience="dashboard" label="Approved" />
            ) : null}
            {review === 'rejected' ? (
              <StatusBadge status="failed" audience="dashboard" label="Rejected" />
            ) : null}
          </div>
          {review === 'pending' ? (
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Submitted Oct 30, 2026. Our team is reviewing your account; we’ll email the account
              owner with the outcome. Live keys cannot be created from the dashboard — they are
              issued by AirExpay after approval.
            </p>
          ) : null}
          {review === 'approved' ? (
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Approved Nov 2, 2026. Your live key was issued by AirExpay and sent to the account
              owner. Additional live keys are requested from AirExpay — they are not self-serve.
            </p>
          ) : null}
          {review === 'rejected' ? (
            <>
              <p className="muted" style={{ margin: '0 0 8px', fontSize: 13.5 }}>
                Reviewed Nov 1, 2026. We couldn’t approve live access yet:
              </p>
              <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13.5 }}>
                <li>Settlement address ownership could not be verified (example reason).</li>
                <li>Business website is unreachable (example reason).</li>
              </ul>
              <button type="button" className="btn btn-primary btn-sm" onClick={onResubmit}>
                Fix and resubmit
              </button>
            </>
          ) : null}
          {notice ? (
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
              {notice}
            </p>
          ) : null}
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STEPS.map((step, index) => {
            const done = DONE[review][index] === true;
            return (
              <li key={step} className="row" style={{ gap: 8, padding: '3px 0', fontSize: 13 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    flex: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    background: done ? 'hsl(var(--status-paid))' : undefined,
                    color: done ? 'hsl(var(--status-paid-fg))' : undefined,
                    border: done ? undefined : '1.5px solid hsl(var(--input))',
                  }}
                >
                  {done ? <Icon name="check" size={10} /> : null}
                </span>
                {step}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
