import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon.tsx';
import { PRICING_HEADING } from '../lib/status.ts';
import { ThemeToggle } from '../theme.tsx';

export function PricingPage() {
  return (
    <div className="mkt">
      <header>
        <div className="mkt-bar">
          <Link to="/" className="brand" style={{ padding: 0 }}>
            Airex<span>pay</span>
          </Link>
          <nav className="mkt-links" aria-label="Primary">
            <a href="/#product">Product</a>
            <a href="/#how">How it works</a>
            <a href="/#dev">Developers</a>
            <Link to="/pricing" style={{ color: 'hsl(var(--foreground))' }}>
              Pricing
            </Link>
          </nav>
          <div className="row">
            <ThemeToggle className="btn btn-outline btn-sm hide-m" />
            <a className="btn btn-primary" href="/#join">
              Join the waitlist
            </a>
          </div>
        </div>
      </header>
      <main
        className="w"
        style={{ paddingTop: 96, paddingBottom: 120, maxWidth: 760 }}
        data-testid="pricing-page"
      >
        <div className="eyebrow">Pricing</div>
        <h1 style={{ fontSize: 48 }}>{PRICING_HEADING}</h1>
        <p className="lead">
          We’re finalising AirExpay pricing with our early merchants. Every fee will be published
          here before any live payment is processed, and shown in your dashboard before you go live.
        </p>
        <div className="card" style={{ padding: 24, boxShadow: 'none' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 17 }}>What we can say today</h3>
          <ul className="ul" style={{ margin: 0 }}>
            <li>
              <Icon name="check" />
              AirExpay is non-custodial: payments go to wallets you control, not to an AirExpay
              balance.
            </li>
            <li>
              <Icon name="check" />
              Network fees are paid by the customer’s wallet and are separate from any AirExpay fee.
            </li>
            <li>
              <Icon name="check" />
              Simulation mode is available for testing before going live.
            </li>
          </ul>
        </div>
        <div className="row" style={{ marginTop: 28, gap: 12, flexWrap: 'wrap' }}>
          <a className="btn btn-primary btn-lg" href="/#join">
            Join the waitlist
          </a>
          <Link className="btn btn-outline btn-lg" to="/">
            Back to home
          </Link>
        </div>
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
