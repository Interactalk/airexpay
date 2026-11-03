/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { App } from './App.tsx';
import { exampleCheckout } from './lib/checkout-model.ts';
import { CheckoutPanel } from './pages/checkout/CheckoutPanel.tsx';
import { ThemeProvider } from './theme.tsx';

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('dark');
});

function renderAt(path: string, ui: ReactElement = <App />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>{ui}</ThemeProvider>
    </MemoryRouter>,
  );
}

describe('dashboard and marketing pages', () => {
  it('shows the simulation banner on staging and the live pill only in production', () => {
    renderAt('/dashboard/api-keys/approved');
    expect(screen.getByTestId('simulation-banner')).toBeTruthy();
    expect(screen.queryByTestId('live-mode-pill')).toBeNull();
    cleanup();

    renderAt('/dashboard/api-keys/approved?environment=production');
    expect(screen.getByTestId('simulation-banner')).toBeTruthy();
    expect(screen.queryByTestId('live-mode-pill')).toBeNull();
    expect(screen.getByTestId('go-live-locked')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /create live key/i })).toBeNull();
  });

  it('keeps INV-1045 underpaid with guidance and no override', () => {
    renderAt('/dashboard/invoices/INV-1045');
    const drawer = screen.getByTestId('invoice-drawer');
    expect(drawer.textContent).toContain('Underpaid');
    expect(drawer.textContent).toContain(
      'The customer can contact you to arrange the remaining amount. This invoice stays Underpaid.',
    );
    expect(drawer.textContent?.toLowerCase().includes('accept as paid')).toBe(false);
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    const fees = screen.getByTestId('fee-breakdown');
    expect(fees.textContent).toContain('Provider fee');
    expect(fees.textContent).toContain('passed through');
    expect(fees.textContent).toContain('not taken from the customer payment');
  });

  it('lists paid invoices on the usage statement and leaves public pricing without amounts', () => {
    renderAt('/dashboard/usage');
    const statement = screen.getByTestId('usage-statement');
    expect(statement.textContent).toContain('INV-1048');
    expect(statement.textContent).toContain('INV-1040');
    expect(statement.textContent).not.toContain('INV-1045');
    expect(statement.textContent).toContain('1.50');
    expect(statement.textContent).toContain('0.75');
    expect(statement.textContent).toContain('2.25');
    expect(statement.textContent).toContain('not deducted from the customer payment');
    expect(screen.queryByRole('button', { name: /withdraw|payout|cash out/i })).toBeNull();
    cleanup();

    renderAt('/dashboard/invoices/INV-1048');
    const breakdown = screen.getByTestId('fee-breakdown');
    expect(breakdown.textContent).toContain('1.5');
    expect(breakdown.textContent).toContain('28.13');
    expect(breakdown.textContent).toContain('2.50');
    expect(breakdown.textContent).toContain('passed through');
  });

  it('labels the overview volume and leaves pricing without amounts', () => {
    renderAt('/dashboard');
    expect(screen.getByText('Paid invoice volume (USD equivalent, not a balance)')).toBeTruthy();
    cleanup();
    renderAt('/pricing');
    const page = screen.getByTestId('pricing-page');
    expect(page.textContent).toContain('Pricing coming soon');
    expect(page.textContent).not.toMatch(/\$\s?\d/);
    expect(page.textContent).not.toMatch(/\d+\.\d{2}/);
  });

  it('renders the six checkout states from server-shaped example data', () => {
    const states = ['waiting', 'confirming', 'paid', 'underpaid', 'expired', 'failed'] as const;
    const labels = [
      'Waiting for payment',
      'Confirming on Tron',
      'Paid',
      'Partially paid',
      'Expired',
      'Failed',
    ];
    states.forEach((state, index) => {
      cleanup();
      render(
        <MemoryRouter>
          <ThemeProvider>
            <CheckoutPanel view={exampleCheckout(state)} />
          </ThemeProvider>
        </MemoryRouter>,
      );
      expect(screen.getByTestId('checkout-status').textContent).toBe(labels[index]);
    });
  });

  it('does not show paid when the server status is underpaid', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Routes>
            <Route path="*" element={<CheckoutPanel view={exampleCheckout('underpaid')} />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('checkout-status').textContent).toBe('Partially paid');
    expect(screen.getByTestId('checkout-status').textContent).not.toBe('Paid');
  });
});
