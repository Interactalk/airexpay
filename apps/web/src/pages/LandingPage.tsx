import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon.tsx';
import { ExampleTag, StatusBadge } from '../components/StatusBadge.tsx';
import { EXAMPLE_ADDRESS, EXAMPLE_INVOICES } from '../data/examples.ts';
import { ThemeToggle } from '../theme.tsx';

const FEATURES = [
  {
    icon: 'lock' as const,
    title: 'Non-custodial by design',
    body: 'Customer payments go to wallets you control, not to an AirExpay balance. We never hold your funds.',
  },
  {
    icon: 'inv' as const,
    title: 'Invoices and payment links',
    body: 'Create an invoice or a shareable link, send it to a customer and follow its status from one dashboard.',
  },
  {
    icon: 'hook' as const,
    title: 'Developer-friendly',
    body: 'A documented REST API and signed webhooks, with a sandbox for testing integrations before going live.',
  },
];

export function LandingPage() {
  const [joined, setJoined] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setJoined(true);
  }

  return (
    <div className="mkt">
      <header>
        <div className="mkt-bar">
          <Link to="/" className="brand" style={{ padding: 0 }}>
            Airex<span>pay</span>
          </Link>
          <nav className="mkt-links" aria-label="Primary">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#dev">Developers</a>
            <Link to="/pricing">Pricing</Link>
          </nav>
          <div className="row">
            <ThemeToggle className="btn btn-outline btn-sm hide-m" />
            <span className="pill hide-m">In development</span>
            <a className="btn btn-primary" href="#join">
              Join the waitlist
            </a>
          </div>
        </div>
      </header>
      <main>
        <div className="mkt-hero">
          <div>
            <span className="pill">
              <b>Early access</b>
              Onboarding a small group of merchants
            </span>
            <h1>Accept digital-asset payments without handing over custody.</h1>
            <p className="lead">
              AirExpay is non-custodial payment software for online businesses: invoices, payment
              links and hosted checkout, with funds settling to wallets you control.
            </p>
            <form className="mkt-form" id="join" onSubmit={onSubmit}>
              <label htmlFor="work-email" className="sr-only">
                Work email
              </label>
              <input
                id="work-email"
                className="input"
                placeholder="you@company.com"
                aria-label="Work email"
              />
              <button className="btn btn-primary btn-lg" type="submit">
                Join the waitlist
              </button>
            </form>
            <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
              {joined
                ? 'This preview does not send your email anywhere. No payments are processed on this site.'
                : 'We’ll only email you about early access. No payments are processed on this site.'}
            </p>
          </div>
          <div style={{ position: 'relative' }}>
            <div
              className="pv card"
              style={{
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <div className="row between" style={{ padding: '14px 18px' }}>
                <span style={{ fontWeight: 600 }}>Invoices</span>
                <ExampleTag />
              </div>
              {EXAMPLE_INVOICES.slice(0, 4).map((invoice) => (
                <div
                  key={invoice.id}
                  className="row between"
                  style={{
                    padding: '11px 18px',
                    borderTop: '1px solid hsl(var(--border))',
                    fontSize: 13.5,
                  }}
                >
                  <div>
                    <div className="num" style={{ fontWeight: 500 }}>
                      {invoice.id}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {invoice.amount} {invoice.asset} · {invoice.network}
                    </div>
                  </div>
                  <StatusBadge
                    status={invoice.status}
                    audience="dashboard"
                    label={invoice.status === 'waiting' ? 'Waiting' : undefined}
                  />
                </div>
              ))}
              <div
                className="muted"
                style={{
                  padding: '10px 18px',
                  borderTop: '1px solid hsl(var(--border))',
                  fontSize: 12,
                }}
              >
                Example data only.
              </div>
            </div>
            <div className="pv card float-card" aria-hidden="true">
              <div className="row between">
                <span className="muted" style={{ fontSize: 12 }}>
                  INV-1046
                </span>
                <StatusBadge status="waiting" audience="dashboard" label="Waiting" />
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 600, margin: '6px 0 10px' }}>
                420.00{' '}
                <span className="muted" style={{ fontSize: 14 }}>
                  USDT
                </span>
              </div>
              <div className="addr">
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {EXAMPLE_ADDRESS}
                </span>
                <Icon name="copy" size={13} />
              </div>
            </div>
          </div>
        </div>
        <section id="product" style={{ borderTop: '1px solid hsl(var(--border))', marginTop: 40 }}>
          <div className="w">
            <div className="eyebrow">Product</div>
            <h2>
              The payment tools you need, <br />
              none of the custody you don’t.
            </h2>
            <div className="f3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="card">
                  <div className="ico">
                    <Icon name={feature.icon} size={19} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          id="how"
          style={{
            background: 'hsl(var(--card))',
            borderTop: '1px solid hsl(var(--border))',
            borderBottom: '1px solid hsl(var(--border))',
          }}
        >
          <div className="w">
            <div className="eyebrow">How it works</div>
            <h2>From invoice to confirmation</h2>
            <div className="steps">
              <div>
                <h3>Create an invoice or link</h3>
                <p>
                  Set the amount, accepted assets and networks. Share the hosted checkout link or
                  embed it.
                </p>
              </div>
              <div>
                <h3>Your customer pays</h3>
                <p>
                  Checkout shows the exact amount, a QR code and a time-limited quote. Funds go to
                  your wallet.
                </p>
              </div>
              <div>
                <h3>Track and reconcile</h3>
                <p>
                  Follow each payment through confirming to paid, and receive a signed webhook at
                  every step.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="dev">
          <div className="w dev">
            <div>
              <div className="eyebrow">Developers</div>
              <h2>Built to integrate cleanly</h2>
              <p className="muted" style={{ fontSize: 17, margin: 0 }}>
                A REST API with idempotent requests, signed webhooks you can verify, and a sandbox
                that simulates every payment state.
              </p>
              <ul className="ul">
                <li>
                  <Icon name="check" />
                  Every payment state, including underpaid and expired, testable in sandbox
                </li>
                <li>
                  <Icon name="check" />
                  HMAC-signed webhooks with automatic retries
                </li>
                <li>
                  <Icon name="check" />
                  Scoped API keys and team roles
                </li>
              </ul>
            </div>
            <div style={{ position: 'relative' }}>
              <span
                className="example"
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  color: 'hsl(210 20% 85%)',
                  borderColor: 'hsl(215 12% 50%)',
                }}
              >
                Example
              </span>
              <pre>
                <span className="c"># Example request (sandbox)</span>
                {'\n'}
                curl https://api.airexpay.com/v1/invoices \{'\n'}
                {'  '}-H <span className="s">&quot;Authorization: Bearer sk_test_…&quot;</span> \
                {'\n'}
                {'  '}-H <span className="s">&quot;Idempotency-Key: order_8812&quot;</span> \{'\n'}
                {'  '}-d amount=<span className="s">&quot;420.00&quot;</span> -d currency=
                <span className="s">&quot;USD&quot;</span> \{'\n'}
                {'  '}-d accept=<span className="s">&quot;USDC:base,USDT:tron&quot;</span>
                {'\n\n'}
                <span className="c"># Response</span>
                {'\n'}
                {'{ '}
                <span className="k">&quot;id&quot;</span>:{' '}
                <span className="s">&quot;inv_ex_1046&quot;</span>,{' '}
                <span className="k">&quot;status&quot;</span>:{' '}
                <span className="s">&quot;waiting&quot;</span>,{'\n  '}
                <span className="k">&quot;hosted_url&quot;</span>:{' '}
                <span className="s">&quot;https://pay.airexpay.com/i/…&quot;</span>
                {' }'}
              </pre>
            </div>
          </div>
        </section>
        <section style={{ paddingTop: 0 }}>
          <div className="w">
            <div className="cta">
              <div>
                <h2>Be one of our first merchants</h2>
                <p>
                  AirExpay is in development. Join the waitlist and we’ll reach out as we onboard
                  early merchants.
                </p>
              </div>
              <a
                className="btn btn-lg"
                style={{
                  background: 'hsl(var(--primary-foreground))',
                  color: 'hsl(var(--primary))',
                }}
                href="#join"
              >
                Join the waitlist
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="mkt-footer">
        <div className="w row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span>
            © 2026 AirexPay LLC. AirExpay is not yet available; no payments are processed on this
            site.
          </span>
          <span>Privacy policy (draft) · Terms (draft)</span>
        </div>
      </footer>
    </div>
  );
}
