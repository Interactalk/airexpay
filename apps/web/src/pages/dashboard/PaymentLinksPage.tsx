import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon.tsx';
import { ExampleTag } from '../../components/StatusBadge.tsx';
import { EXAMPLE_LINKS, type ExampleLink } from '../../data/examples.ts';
import { withQuery } from '../../lib/chrome.ts';
import { useChrome } from '../../use-chrome.ts';

export function PaymentLinksPage({ creating = false }: { creating?: boolean }) {
  const chrome = useChrome();
  const navigate = useNavigate();
  const [links, setLinks] = useState<ExampleLink[]>(EXAMPLE_LINKS);
  const [name, setName] = useState('Design consultation');
  const [price, setPrice] = useState('150.00');
  const [copied, setCopied] = useState<string | null>(null);

  function close() {
    navigate(withQuery('/dashboard/payment-links', chrome.search));
  }

  function createLink() {
    setLinks((current) => [
      {
        name: name.trim() || 'Untitled link',
        url: `pay.airexpay.com/l/ex-${String(current.length + 1).padStart(3, '0')}`,
        price: `${price || '0.00'} USD`,
        accepted: 'USDC, USDT',
        status: 'Active',
        paidInvoices: '0',
      },
      ...current,
    ]);
    close();
  }

  return (
    <>
      <div className="ph">
        <div>
          <h1>Payment links</h1>
          <p>Shareable links for fixed or customer-chosen amounts.</p>
        </div>
        <Link
          className="btn btn-primary"
          to={withQuery('/dashboard/payment-links/new', chrome.search)}
        >
          <Icon name="plus" />
          New payment link
        </Link>
      </div>
      <div className="card">
        <div className="sec row between">
          <span className="muted">{links.length} links</span>
          <ExampleTag>Example data</ExampleTag>
        </div>
        <table className="cl">
          <thead>
            <tr>
              <th>Link</th>
              <th className="r">Price</th>
              <th>Accepted</th>
              <th>Status</th>
              <th className="r">Paid invoices</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.url}>
                <td data-label="Link">
                  <div style={{ fontWeight: 500 }}>{link.name}</div>
                  <div className="muted mono" style={{ fontSize: 12 }}>
                    {link.url}
                  </div>
                </td>
                <td className="r num" data-label="Price" style={{ fontWeight: 500 }}>
                  {link.price}
                </td>
                <td className="muted" data-label="Accepted">
                  {link.accepted}
                </td>
                <td data-label="Status">
                  <span className={`badge ${link.status === 'Active' ? 's-paid' : 'neutral'}`}>
                    {link.status}
                  </span>
                </td>
                <td className="r num" data-label="Paid invoices">
                  {link.paidInvoices}
                </td>
                <td data-label="">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(`https://${link.url}`)
                        .catch(() => undefined);
                      setCopied(link.url);
                    }}
                  >
                    <Icon name="copy" size={13} />
                    {copied === link.url ? 'Copied' : 'Copy link'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating ? (
        <>
          <div className="overlay" onClick={close} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label="New payment link">
            <div className="row between">
              <h3 style={{ fontSize: 17, margin: 0 }}>New payment link</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Close"
                onClick={close}
              >
                <Icon name="x" />
              </button>
            </div>
            <p className="muted" style={{ margin: '4px 0 18px' }}>
              A reusable link that creates a fresh invoice for each customer. This preview keeps the
              link in the browser only.
            </p>
            <label className="label" htmlFor="link-name">
              Name
            </label>
            <input
              id="link-name"
              className="input"
              style={{ marginBottom: 14, width: '100%' }}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div
              className="grid"
              style={{ gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 14 }}
            >
              <div>
                <label className="label" htmlFor="link-price">
                  Price
                </label>
                <input
                  id="link-price"
                  className="input num"
                  value={price}
                  inputMode="decimal"
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="link-currency">
                  Currency
                </label>
                <input id="link-currency" className="input" value="USD" readOnly />
              </div>
            </div>
            <span className="label">Accepted assets</span>
            <div className="row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
              <span className="badge plain s-confirming">USDC · Base</span>
              <span className="badge plain s-confirming">USDT · Tron</span>
              <span className="chip" style={{ height: 'auto' }}>
                + Add
              </span>
            </div>
            <div className="callout" style={{ marginBottom: 18 }}>
              Network fees are paid by the customer’s wallet. AirExpay fees will be published on the{' '}
              <Link to="/pricing" style={{ textDecoration: 'underline' }}>
                pricing page
              </Link>{' '}
              (pricing coming soon).
            </div>
            <div className="row dialog-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={close}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={createLink}>
                Create link
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
