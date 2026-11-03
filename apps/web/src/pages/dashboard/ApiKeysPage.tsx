import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoLiveReview } from '../../components/GoLiveReview.tsx';
import { Icon } from '../../components/Icon.tsx';
import { ExampleTag, StatusBadge } from '../../components/StatusBadge.tsx';
import { EXAMPLE_LIVE_KEY, EXAMPLE_TEST_KEYS, type ExampleKey } from '../../data/examples.ts';
import { useChrome } from '../../use-chrome.ts';

export function ApiKeysPage() {
  const chrome = useChrome();
  const [keys, setKeys] = useState<ExampleKey[]>(EXAMPLE_TEST_KEYS);
  const [notice, setNotice] = useState<string | null>(null);
  const [requestNote, setRequestNote] = useState<string | null>(null);
  const review = chrome.review;

  return (
    <>
      <div className="ph">
        <div>
          <h1>API keys</h1>
          <p>Authenticate server-to-server requests to the AirExpay REST API.</p>
        </div>
        <div className="row actions">
          <a className="btn btn-outline hm" href="/#dev">
            <Icon name="doc" />
            API reference
          </a>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setKeys((current) => [
                {
                  name: 'New test key',
                  mask: 'sk_test_ex…c0de',
                  permissions: 'Full access',
                  created: 'Just now',
                  lastUsed: 'Never',
                },
                ...current,
              ])
            }
          >
            <Icon name="plus" />
            Create test key
          </button>
        </div>
      </div>
      {chrome.onboardingApproved ? (
        <>
          <GoLiveReview
            review={review}
            notice={notice}
            onResubmit={() => setNotice('This preview does not submit a review.')}
          />
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="sec row between">
              <div className="row">
                <h3>Live keys</h3>
                {review === 'pending' ? (
                  <StatusBadge status="confirming" audience="dashboard" label="Pending" />
                ) : null}
                {review === 'approved' ? (
                  <StatusBadge status="paid" audience="dashboard" label="Approved" />
                ) : null}
                {review === 'rejected' ? (
                  <StatusBadge status="failed" audience="dashboard" label="Rejected" />
                ) : null}
              </div>
              <span className="muted hm" style={{ fontSize: 12.5 }}>
                <Icon name="lock" size={12} /> Issued by AirExpay only
              </span>
            </div>
            {review === 'approved' ? (
              <table className="cl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="hm">Issued</th>
                    <th className="hm">Last used</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td data-label="Name" style={{ fontWeight: 500 }}>
                      {EXAMPLE_LIVE_KEY.name}
                      <div className="mono muted" style={{ fontSize: 12 }}>
                        {EXAMPLE_LIVE_KEY.mask}
                      </div>
                    </td>
                    <td className="muted num hm" data-label="Issued">
                      {EXAMPLE_LIVE_KEY.issued}
                    </td>
                    <td className="muted hm" data-label="Last used">
                      {EXAMPLE_LIVE_KEY.lastUsed}
                    </td>
                    <td data-label="">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setRequestNote(
                            'Live keys are requested from AirExpay. This preview does not issue one.',
                          )
                        }
                      >
                        Request another key
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 28, textAlign: 'center' }} className="muted">
                <Icon name="lock" size={20} />
                <div style={{ fontWeight: 600, color: 'hsl(var(--foreground))', marginTop: 6 }}>
                  Live keys are locked
                </div>
                <div style={{ fontSize: 13 }}>
                  {review === 'rejected'
                    ? 'Resolve the review items above and resubmit.'
                    : 'Available after your go-live review is approved.'}
                </div>
              </div>
            )}
            {requestNote ? (
              <p className="muted" style={{ fontSize: 13, padding: '0 20px 16px' }}>
                {requestNote}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div
          className="card"
          data-testid="go-live-locked"
          style={{ padding: '18px 20px', marginBottom: 16 }}
        >
          <h3>Go-live review is locked</h3>
          <p className="muted" style={{ margin: '8px 0 14px' }}>
            Live API keys and go-live review stay locked until onboarding is approved. AirExpay does
            not claim a licence or that this check is complete.
          </p>
          <Link className="btn btn-primary" to="/onboarding">
            Continue onboarding
          </Link>
        </div>
      )}
      <div className="card">
        <div className="sec row between">
          <div className="row">
            <h3>Test keys</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Simulation only
            </span>
          </div>
          <ExampleTag>Example data</ExampleTag>
        </div>
        <table className="cl">
          <thead>
            <tr>
              <th>Name / key</th>
              <th className="hm">Permissions</th>
              <th className="hm">Created</th>
              <th className="hm">Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.mask}>
                <td data-label="Name / key" style={{ fontWeight: 500 }}>
                  {key.name}
                  <div className="mono muted" style={{ fontSize: 12 }}>
                    {key.mask}
                  </div>
                </td>
                <td className="hm" data-label="Permissions">
                  <span className="badge plain neutral">{key.permissions}</span>
                </td>
                <td className="muted num hm" data-label="Created">
                  {key.created}
                </td>
                <td className="muted hm" data-label="Last used">
                  {key.lastUsed}
                </td>
                <td data-label="">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'hsl(var(--destructive))' }}
                    onClick={() =>
                      setKeys((current) => current.filter((item) => item.mask !== key.mask))
                    }
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
        Keys are shown masked. Keep secret keys on your server; never embed them in a browser or
        mobile app. The masks on this page are example data, not credentials.
      </p>
    </>
  );
}
