import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePublicCheckout } from '../../apps/web/src/api/public-checkout.ts';
import { EXAMPLE_TX } from '../../apps/web/src/lib/checkout-model.ts';
import { preservedQuery, resolveChrome } from '../../apps/web/src/lib/chrome.ts';
import { formatCountdown } from '../../apps/web/src/lib/countdown.ts';
import { subtractAmounts } from '../../apps/web/src/lib/money.ts';
import {
  PAID_VOLUME_LABEL,
  PRICING_HEADING,
  UNDERPAID_GUIDANCE,
  checkoutStatusLabel,
  dashboardStatusLabel,
} from '../../apps/web/src/lib/status.ts';
import { TX_1045 } from '../../apps/web/src/data/examples.ts';

const root = path.resolve(import.meta.dirname, '../..');

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...sourceFiles(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.css')) {
      files.push(full);
    }
  }
  return files;
}

describe('design rules', () => {
  it('uses the dashboard and checkout labels from the design system', () => {
    expect(dashboardStatusLabel('underpaid')).toBe('Underpaid');
    expect(checkoutStatusLabel('underpaid')).toBe('Partially paid');
    expect(checkoutStatusLabel('confirming', 'tron')).toBe('Confirming on Tron');
    expect(checkoutStatusLabel('paid')).toBe('Paid');
    expect(PAID_VOLUME_LABEL).toBe('Paid invoice volume (USD equivalent, not a balance)');
    expect(PRICING_HEADING).toBe('Pricing coming soon');
    expect(UNDERPAID_GUIDANCE).toContain('stays Underpaid');
  });

  it('keeps staging on the simulation banner and production on the live pill', () => {
    expect(resolveChrome('staging', 'approved')).toEqual({
      live: false,
      banner: true,
      review: 'approved',
    });
    expect(resolveChrome('staging', null)).toEqual({
      live: false,
      banner: true,
      review: 'pending',
    });
    expect(resolveChrome('production', 'rejected')).toEqual({
      live: true,
      banner: false,
      review: 'approved',
    });
    expect(preservedQuery('?environment=production&theme=dark&x=1')).toBe(
      '?environment=production&theme=dark',
    );
  });

  it('does not treat a short payment as paid', () => {
    expect(subtractAmounts('420.00', '380.00')).toBe('40.00');
    expect(subtractAmounts('0.00256000', '0.00100000')).toBe('0.00156000');
  });

  it('formats the countdown in full words', () => {
    const parts = formatCountdown(
      '2026-11-03T12:14:32.000Z',
      Date.parse('2026-11-03T12:00:00.000Z'),
    );
    expect(parts?.clock).toBe('14:32');
    expect(parts?.label).toBe('Time left 14 minutes 32 seconds');
  });

  it('uses full example transaction hashes', () => {
    expect(TX_1045).toMatch(/^[0-9a-f]{64}$/);
    expect(EXAMPLE_TX.tron).toMatch(/^[0-9a-f]{64}$/);
    expect(EXAMPLE_TX.eth).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('rejects a checkout payload that is not the server contract', () => {
    expect(() => parsePublicCheckout({ status: 'paid', livemode: true })).toThrow(/Live checkout/);
    expect(() => parsePublicCheckout({ status: 'finished', livemode: false })).toThrow(
      /could not be shown/,
    );
  });

  it('parses a simulation checkout without promoting the status', () => {
    const checkout = parsePublicCheckout({
      livemode: false,
      public_id: 'inv_123',
      status: 'underpaid',
      merchant_name: 'Northwind Studio',
      price_amount: '49.00',
      price_currency: 'usd',
      pay_amount: '0.001',
      pay_currency: 'btc',
      pay_address: 'tb1qexample',
      actually_paid: '0.0004',
      network: 'bitcoin',
      description: null,
      expires_at: '2026-11-03T12:00:00.000Z',
      overpaid: false,
      late_payment_review: false,
    });
    expect(checkout.status).toBe('underpaid');
    expect(checkout.livemode).toBe(false);
  });

  it('keeps Outfit, the old green accent, secrets, and the underpaid override out of the web app', () => {
    const banned = [
      'Outfit',
      '156 38% 18%',
      'ak_test_simulation',
      'simulation-ipn-secret',
      'Accept as paid',
      'manually accepted',
      'zero fee',
      'instant settlement',
    ];
    const files = sourceFiles(path.join(root, 'apps/web/src'));
    const combined = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    for (const phrase of banned) {
      expect(combined.includes(phrase)).toBe(false);
    }
    const css = readFileSync(path.join(root, 'apps/web/src/index.css'), 'utf8');
    const designCss = readFileSync(path.join(root, 'design/mockups/app.css'), 'utf8');
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('env(safe-area-inset-right)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('env(safe-area-inset-left)');
    expect(designCss).toContain('min-height:44px');
    expect(readFileSync(path.join(root, 'design/tokens.css'), 'utf8')).toContain(
      '--primary: 214 52% 25%',
    );
  });
});
