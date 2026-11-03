import { useEffect, useRef } from 'react';
import type { ExampleInvoice } from '../data/examples.ts';
import { EXAMPLE_ADDRESS } from '../data/examples.ts';
import { Icon } from './Icon.tsx';
import { ExampleTag, StatusBadge } from './StatusBadge.tsx';

export function InvoiceDrawer({
  invoice,
  onClose,
}: {
  invoice: ExampleInvoice;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Invoice ${invoice.id}`}
        data-testid="invoice-drawer"
      >
        <div className="sec row between" style={{ padding: '16px 20px' }}>
          <div className="row">
            <span className="num" style={{ fontWeight: 600, fontSize: 16 }}>
              {invoice.id}
            </span>
            <StatusBadge status={invoice.status} audience="dashboard" />
          </div>
          <div className="row">
            <ExampleTag>Example data</ExampleTag>
            <button
              ref={closeRef}
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon name="x" />
            </button>
          </div>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <div className="sec">
            <div className="muted" style={{ fontSize: 12.5 }}>
              Amount due
            </div>
            <div
              className="num"
              style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}
            >
              {invoice.amount}{' '}
              <span className="muted" style={{ fontSize: 18, fontWeight: 500 }}>
                {invoice.asset}
              </span>
            </div>
            {invoice.received && invoice.outstanding ? (
              <div
                className="grid"
                style={{ gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}
              >
                <div className="callout">
                  <div className="muted" style={{ fontSize: 12 }}>
                    Received
                  </div>
                  <div className="num" style={{ fontWeight: 600 }}>
                    {invoice.received}
                  </div>
                </div>
                <div
                  className="callout"
                  style={{
                    background: 'hsl(var(--status-underpaid))',
                    borderColor: 'hsl(var(--status-underpaid-border))',
                    color: 'hsl(var(--status-underpaid-fg))',
                  }}
                >
                  <div style={{ fontSize: 12 }}>Outstanding</div>
                  <div className="num" style={{ fontWeight: 600 }}>
                    {invoice.outstanding}
                  </div>
                </div>
              </div>
            ) : null}
            {invoice.guidance ? (
              <div
                className="callout"
                style={{ marginTop: 12, fontSize: 13 }}
                data-testid="underpaid-guidance"
              >
                {invoice.guidance}
              </div>
            ) : null}
          </div>
          <div className="sec">
            <h3 style={{ marginBottom: 12 }}>Details</h3>
            <dl className="kv" style={{ margin: 0 }}>
              <dt>Customer</dt>
              <dd>
                {invoice.customer} · {invoice.email}
              </dd>
              <dt>Asset / network</dt>
              <dd>
                {invoice.asset} · {invoice.network}
                {invoice.network === 'Tron' ? ' (TRC-20)' : ''}
              </dd>
              <dt>Pay-to address</dt>
              <dd className="mono break-anywhere">{EXAMPLE_ADDRESS}</dd>
              {invoice.txHash ? (
                <>
                  <dt>Transaction</dt>
                  <dd className="mono break-anywhere" style={{ fontSize: 12, lineHeight: 1.45 }}>
                    {invoice.txHash} <Icon name="ext" size={13} />
                  </dd>
                </>
              ) : null}
              <dt>Created</dt>
              <dd className="num">{invoice.createdDetail}</dd>
              <dt>Expires</dt>
              <dd className="num">{invoice.expires}</dd>
              <dt>Reference</dt>
              <dd className="mono">{invoice.reference}</dd>
              <dt>Hosted page</dt>
              <dd className="row" style={{ color: 'hsl(var(--primary))', fontWeight: 500 }}>
                pay.airexpay.com/i/{invoice.id.toLowerCase()} <Icon name="copy" size={13} />
              </dd>
            </dl>
          </div>
          <div className="sec" style={{ border: 0 }}>
            <h3 style={{ marginBottom: 6 }}>Timeline</h3>
            <ul className="timeline">
              {invoice.timeline.map((entry) => (
                <li key={`${entry.at}-${entry.label}`}>
                  <span
                    className={`dot${entry.tone === 'ok' ? ' ok' : entry.tone === 'info' ? ' info' : ''}`}
                    style={
                      entry.tone === 'warn'
                        ? { background: 'hsl(var(--status-underpaid-fg))' }
                        : undefined
                    }
                  />
                  <span>{entry.label}</span>
                  <span className="muted num" style={{ fontSize: 12.5 }}>
                    {entry.at}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}
