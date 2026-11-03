import { useState } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { ExampleTag } from '../../components/StatusBadge.tsx';
import { EXAMPLE_DELIVERIES } from '../../data/examples.ts';

export function WebhooksPage() {
  const [note, setNote] = useState<string | null>(null);
  return (
    <>
      <div className="ph">
        <div>
          <h1>Webhooks</h1>
          <p>Signed HTTPS callbacks for invoice and payment events.</p>
        </div>
        <div className="row actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setNote('No test event was sent. This dashboard is example data.')}
          >
            Send test event
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setNote('Adding an endpoint needs the API. Nothing was saved.')}
          >
            <Icon name="plus" />
            Add endpoint
          </button>
        </div>
      </div>
      {note ? (
        <p className="muted" style={{ marginTop: -8 }}>
          {note}
        </p>
      ) : null}
      <div className="grid g2" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 18 }}>
        <article className="card" style={{ padding: '16px 18px' }}>
          <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
            <div
              className="mono break-anywhere"
              style={{ fontSize: 13.5, fontWeight: 500, minWidth: 0 }}
            >
              https://example.com/webhooks/airexpay
            </div>
            <span className="badge s-paid">Enabled</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            invoice.* · 5 events · API version 2026-10-01
          </div>
          <div
            className="row between"
            style={{ marginTop: 12, fontSize: 13, gap: 8, flexWrap: 'wrap' }}
          >
            <span className="muted">
              Signing secret <span className="mono">whsec_ex••••••••</span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setNote('Signing secrets stay on the server. This preview only shows a mask.')
              }
            >
              Reveal
            </button>
          </div>
        </article>
        <article className="card" style={{ padding: '16px 18px' }}>
          <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
            <div
              className="mono break-anywhere"
              style={{ fontSize: 13.5, fontWeight: 500, minWidth: 0 }}
            >
              https://staging.example.com/hooks
            </div>
            <span className="badge s-expired">Disabled</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            invoice.paid · 1 event · API version 2026-10-01
          </div>
          <div
            className="row between"
            style={{ marginTop: 12, fontSize: 13, gap: 8, flexWrap: 'wrap' }}
          >
            <span className="muted">Disabled by a team member on Oct 30</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setNote('This preview does not enable the endpoint.')}
            >
              Enable
            </button>
          </div>
        </article>
      </div>
      <div className="card">
        <div className="sec row between">
          <div>
            <h3>Delivery log</h3>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Failed deliveries retry with exponential backoff, up to 8 attempts.
            </div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="chip">
              <Icon name="plus" size={13} /> Event
            </span>
            <span className="chip">
              <Icon name="plus" size={13} /> Result
            </span>
            <ExampleTag>Example data</ExampleTag>
          </div>
        </div>
        <table className="cl">
          <thead>
            <tr>
              <th>Event</th>
              <th>Invoice</th>
              <th>Result</th>
              <th>HTTP</th>
              <th className="r">Duration</th>
              <th>Sent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_DELIVERIES.map((row) => (
              <tr key={`${row.event}-${row.sent}`}>
                <td className="mono" data-label="Event">
                  {row.event}
                </td>
                <td className="num" data-label="Invoice">
                  {row.invoice}
                </td>
                <td data-label="Result">
                  <span className={`badge s-${row.tone}`}>{row.result}</span>
                </td>
                <td className="mono" data-label="HTTP">
                  {row.http}
                </td>
                <td className="r num muted" data-label="Duration">
                  {row.duration}
                </td>
                <td className="muted num" data-label="Sent">
                  {row.sent}
                </td>
                <td data-label="">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setNote('Example only. No webhook was sent.')}
                  >
                    Resend
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
