import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon.tsx';
import { InvoiceTable } from '../../components/InvoiceTable.tsx';
import { ExampleTag } from '../../components/StatusBadge.tsx';
import { CHECKLIST, EXAMPLE_INVOICES, VOLUME_BARS } from '../../data/examples.ts';
import { withQuery } from '../../lib/chrome.ts';
import { PAID_VOLUME_LABEL } from '../../lib/status.ts';
import { useChrome } from '../../use-chrome.ts';

const KPIS = [
  { label: 'Paid invoices', value: '38', note: 'Last 14 days' },
  {
    label: PAID_VOLUME_LABEL,
    value: '12,480.40 USD',
    note: 'Sum of paid invoices, valued at time of payment',
  },
  { label: 'Awaiting payment', value: '5', note: 'Open invoices' },
  { label: 'Webhook success rate', value: '99.2%', note: 'Last 7 days, 2xx responses' },
] as const;

export function OverviewPage() {
  const chrome = useChrome();
  return (
    <>
      <div className="ph">
        <div>
          <h1>Overview</h1>
          <p>Good afternoon, Alex. Here is what is happening with your payments.</p>
        </div>
        <div className="row actions">
          <span className="chip hm">
            <Icon name="clock" size={14} /> Last 14 days
          </span>
          <Link
            className="btn btn-outline hm"
            to={withQuery('/dashboard/payment-links/new', chrome.search)}
          >
            <Icon name="link" />
            New payment link
          </Link>
          <Link className="btn btn-primary" to="/pay">
            <Icon name="plus" />
            New invoice
          </Link>
        </div>
      </div>
      <div className="grid g4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="card kpi">
            <div className="row between">
              <span className="muted" style={{ fontWeight: 500, paddingRight: 8 }}>
                {kpi.label}
              </span>
              <ExampleTag />
            </div>
            <div
              className="v num"
              data-testid={kpi.label === PAID_VOLUME_LABEL ? 'volume-label' : undefined}
            >
              {kpi.value}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              {kpi.note}
            </div>
          </div>
        ))}
      </div>
      <div className="grid g2" style={{ gridTemplateColumns: '1.6fr 1fr', marginBottom: 16 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="row between">
            <div>
              <h3>Paid invoices per day</h3>
              <div className="muted" style={{ fontSize: 12.5 }}>
                Count of invoices reaching Paid
              </div>
            </div>
            <ExampleTag>Example data</ExampleTag>
          </div>
          <svg
            viewBox="0 0 560 170"
            width="100%"
            height="190"
            role="img"
            aria-label="Bar chart of example paid invoices per day"
            style={{ marginTop: 12 }}
          >
            <line x1="0" y1="150.5" x2="560" y2="150.5" stroke="hsl(var(--border))" />
            {VOLUME_BARS.map((bar, index) => (
              <rect
                key={index}
                x={index * 40 + 8}
                y={150 - bar * 10}
                width="24"
                height={bar * 10}
                rx="3"
                fill="hsl(var(--primary))"
                opacity={index < VOLUME_BARS.length - 1 ? 0.35 : 1}
              />
            ))}
          </svg>
          <div className="row between muted num" style={{ fontSize: 12 }}>
            <span>Oct 21</span>
            <span>Oct 28</span>
            <span>Nov 3</span>
          </div>
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="row between">
            <h3>Get ready to go live</h3>
            <span className="muted num" style={{ fontSize: 12.5 }}>
              2 of 5
            </span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
            {CHECKLIST.map((item) => (
              <li
                key={item.title}
                className="row"
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid hsl(var(--border))',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flex: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    background: item.done ? 'hsl(var(--status-paid))' : undefined,
                    color: item.done ? 'hsl(var(--status-paid-fg))' : undefined,
                    border: item.done ? undefined : '1.5px solid hsl(var(--input))',
                  }}
                >
                  {item.done ? <Icon name="check" size={12} /> : null}
                </span>
                <div>
                  <div
                    style={{
                      fontWeight: 500,
                      textDecoration: item.done ? 'line-through' : undefined,
                      color: item.done ? 'hsl(var(--muted-foreground))' : undefined,
                    }}
                  >
                    {item.title}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {item.body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card">
        <div className="sec row between">
          <h3>Recent invoices</h3>
          <div className="row">
            <ExampleTag>Example data</ExampleTag>
            <Link
              className="btn btn-ghost btn-sm"
              to={withQuery('/dashboard/invoices', chrome.search)}
            >
              View all
            </Link>
          </div>
        </div>
        <InvoiceTable invoices={EXAMPLE_INVOICES.slice(0, 5)} search={chrome.search} />
      </div>
    </>
  );
}
