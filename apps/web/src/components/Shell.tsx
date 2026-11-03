import { Badge } from '@airexpay/ui';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/80 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="font-serif text-2xl tracking-tight">
            AirExpay
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="quiet">Simulation</Badge>
            <nav className="flex items-center gap-4">
              <NavLink to="/" className="text-muted-foreground hover:text-foreground">
                Overview
              </NavLink>
              <NavLink
                to="/pay/demo/waiting"
                className="text-muted-foreground hover:text-foreground"
              >
                Checkout
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/80">
        <div className="mx-auto max-w-5xl px-5 py-8 text-sm text-muted-foreground">
          <p>AirExpay is a product of AirexPay LLC. This build does not move money.</p>
          <p className="mt-2">
            Not a bank, wallet, or money transmitter offering. Company registration details are not
            published on this page. Live processing is not authorized.
          </p>
        </div>
      </footer>
    </div>
  );
}
