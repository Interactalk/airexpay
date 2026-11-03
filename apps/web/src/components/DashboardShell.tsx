import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { withQuery } from '../lib/chrome.ts';
import { ThemeToggle } from '../theme.tsx';
import { useChrome } from '../use-chrome.ts';
import { Icon, type IconName } from './Icon.tsx';
import { LiveModePill } from './StatusBadge.tsx';

const SECTIONS: { label: string; short: string; to: string; icon: IconName; end?: boolean }[] = [
  { label: 'Overview', short: 'Overview', to: '/dashboard', icon: 'home', end: true },
  { label: 'Invoices', short: 'Invoices', to: '/dashboard/invoices', icon: 'inv' },
  { label: 'Payment links', short: 'Links', to: '/dashboard/payment-links', icon: 'link' },
  { label: 'API keys', short: 'API keys', to: '/dashboard/api-keys', icon: 'key' },
  { label: 'Webhooks', short: 'Webhooks', to: '/dashboard/webhooks', icon: 'hook' },
  { label: 'Settings & team', short: 'Settings', to: '/dashboard/settings', icon: 'gear' },
];

function hrefFor(to: string, review: string, search: string): string {
  if (to === '/dashboard/api-keys') {
    return withQuery(`/dashboard/api-keys/${review}`, search);
  }
  return withQuery(to, search);
}

export function DashboardLayout() {
  const chrome = useChrome();
  const [menuOpen, setMenuOpen] = useState(false);
  const link = (to: string) => hrefFor(to, chrome.review, chrome.search);

  return (
    <div>
      {chrome.banner ? (
        <div className="sim" role="status" data-testid="simulation-banner">
          <Icon name="alert" size={15} />
          <span>
            <b>Simulation mode.</b> No real payments are processed. Invoices, payments and webhooks
            on this screen are simulated example data.
          </span>
          <Link
            className="sim-more"
            to={link('/dashboard/api-keys')}
            style={{ textDecoration: 'underline' }}
          >
            Learn about going live
          </Link>
        </div>
      ) : null}
      <div className="mtop">
        <div className="row">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            style={{ padding: '0 6px' }}
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={20} />
          </button>
          <Link to={link('/dashboard')} className="brand" style={{ padding: 0 }}>
            Airex<span>pay</span>
          </Link>
        </div>
        <div className="row">
          <ThemeToggle className="btn btn-ghost btn-sm" />
          <span className="muted" style={{ fontSize: '12.5px' }}>
            Northwind Studio
          </span>
          {chrome.live ? <LiveModePill /> : null}
          <div className="av">N</div>
        </div>
      </div>
      <nav className="mnav" aria-label="Sections">
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={link(section.to)}
            end={section.end}
            className={({ isActive }) => (isActive ? 'on' : undefined)}
          >
            {section.short}
          </NavLink>
        ))}
      </nav>
      {menuOpen ? (
        <>
          <div className="overlay" onClick={() => setMenuOpen(false)} />
          <nav className="menu-sheet" aria-label="Menu">
            {SECTIONS.map((section) => (
              <NavLink
                key={section.to}
                to={link(section.to)}
                end={section.end}
                onClick={() => setMenuOpen(false)}
              >
                {section.label}
              </NavLink>
            ))}
            <button type="button" className="btn btn-outline" onClick={() => setMenuOpen(false)}>
              Close
            </button>
          </nav>
        </>
      ) : null}
      <div className="app">
        <aside className="side">
          <Link to={link('/dashboard')} className="brand">
            Airex<span>pay</span>
          </Link>
          <div className="org">
            <div className="av">N</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                Northwind Studio
                {chrome.live ? <LiveModePill /> : null}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Example merchant · {chrome.live ? 'Live' : 'Sandbox'}
              </div>
            </div>
          </div>
          {SECTIONS.slice(0, 3).map((section) => (
            <SideLink key={section.to} to={link(section.to)} end={section.end} icon={section.icon}>
              {section.label}
            </SideLink>
          ))}
          <div className="navh">Developers</div>
          {SECTIONS.slice(3, 5).map((section) => (
            <SideLink key={section.to} to={link(section.to)} icon={section.icon}>
              {section.label}
            </SideLink>
          ))}
          <div className="navh">Account</div>
          <SideLink to={link('/dashboard/settings')} icon="gear">
            Settings &amp; team
          </SideLink>
          <div style={{ flex: 1 }} />
          <a className="nav" href="/#dev">
            <Icon name="doc" />
            Documentation
          </a>
          <div className="row" style={{ padding: '10px 4px 0' }}>
            <ThemeToggle />
          </div>
          <div
            className="row"
            style={{
              padding: 10,
              borderTop: '1px solid hsl(var(--border))',
              marginTop: 8,
            }}
          >
            <div
              className="av"
              style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
            >
              AK
            </div>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 500 }}>Alex Kim</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Owner
              </div>
            </div>
          </div>
        </aside>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SideLink({
  to,
  icon,
  end,
  children,
}: {
  to: string;
  icon: IconName;
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav${isActive ? ' on' : ''}`}>
      <Icon name={icon} />
      {children}
    </NavLink>
  );
}
