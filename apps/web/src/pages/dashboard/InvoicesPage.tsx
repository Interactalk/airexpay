import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon.tsx';
import { InvoiceDrawer } from '../../components/InvoiceDrawer.tsx';
import { InvoiceTable } from '../../components/InvoiceTable.tsx';
import { ExampleTag } from '../../components/StatusBadge.tsx';
import {
  EXAMPLE_INVOICES,
  INVOICE_TABS,
  findInvoice,
  invoiceMatchesQuery,
  invoiceMatchesTab,
  type InvoiceTab,
} from '../../data/examples.ts';
import { withQuery } from '../../lib/chrome.ts';
import { useChrome } from '../../use-chrome.ts';

export function InvoicesPage() {
  const chrome = useChrome();
  const navigate = useNavigate();
  const params = useParams();
  const [tab, setTab] = useState<InvoiceTab>('all');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const selected = findInvoice(params.invoiceId);
  const rows = useMemo(
    () =>
      EXAMPLE_INVOICES.filter(
        (invoice) => invoiceMatchesTab(invoice.status, tab) && invoiceMatchesQuery(invoice, query),
      ),
    [query, tab],
  );

  return (
    <>
      <div className="ph">
        <div>
          <h1>Invoices</h1>
          <p>Create invoices and follow each payment from creation to confirmation.</p>
        </div>
        <div className="row actions">
          <button
            type="button"
            className="btn btn-outline hm"
            onClick={() => setNote('Example data is not exported from this preview.')}
          >
            <Icon name="dl" />
            Export CSV
          </button>
          <Link className="btn btn-primary" to="/pay">
            <Icon name="plus" />
            New invoice
          </Link>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Invoice status">
        {INVOICE_TABS.map((item) => {
          const count = EXAMPLE_INVOICES.filter((invoice) =>
            invoiceMatchesTab(invoice.status, item.id),
          ).length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`tab${tab === item.id ? ' on' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label} <span className="muted num">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="toolbar">
        <label className="input" style={{ width: 340 }}>
          <Icon name="search" size={15} />
          <input
            aria-label="Search by invoice, customer or tx hash"
            placeholder="Search by invoice, customer or tx hash"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{
              border: 0,
              outline: 'none',
              background: 'transparent',
              width: '100%',
              font: 'inherit',
              color: 'inherit',
            }}
          />
        </label>
        <span className="chip">
          <Icon name="plus" size={13} /> Status
        </span>
        <span className="chip">
          <Icon name="plus" size={13} /> Asset
        </span>
        <span className="chip hm">
          <Icon name="plus" size={13} /> Network
        </span>
        <span className="chip hm">
          <Icon name="clock" size={13} /> Last 30 days
        </span>
        <div style={{ flex: 1 }} />
        <ExampleTag>Example data</ExampleTag>
      </div>
      {note ? (
        <p className="muted" style={{ fontSize: 13 }}>
          {note}
        </p>
      ) : null}
      <div className="card">
        <InvoiceTable invoices={rows} search={chrome.search} />
        <div
          className="row between"
          style={{ padding: '10px 16px', borderTop: '1px solid hsl(var(--border))' }}
        >
          <span className="muted num" style={{ fontSize: 13 }}>
            Showing {rows.length === 0 ? '0' : `1–${rows.length}`} of {rows.length}
          </span>
          <div className="row">
            <button type="button" className="btn btn-outline btn-sm" disabled>
              Previous
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
      {selected ? (
        <InvoiceDrawer
          invoice={selected}
          onClose={() => navigate(withQuery('/dashboard/invoices', chrome.search))}
        />
      ) : null}
    </>
  );
}
