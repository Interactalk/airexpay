import { expect, test, type Page } from '@playwright/test';

const STATES = [
  ['waiting', 'Waiting for payment'],
  ['confirming', 'Confirming on Tron'],
  ['paid', 'Paid'],
  ['underpaid', 'Partially paid'],
  ['expired', 'Expired'],
  ['failed', 'Failed'],
] as const;

test.describe('checkout states', () => {
  for (const [state, label] of STATES) {
    test(`example ${state} shows ${label}`, async ({ page }) => {
      await page.goto(`/pay/demo/${state}`);
      await expect(page.getByTestId('checkout-status')).toHaveText(label);
      await expect(page.getByText('Example — do not send funds')).toBeVisible();
    });
  }

  test('live checkout shows the server status and updates when it changes', async ({ page }) => {
    let status: 'waiting' | 'paid' = 'waiting';
    await page.route('**/v1/checkout/inv_e2e', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(checkoutBody(status)),
      });
    });
    await page.goto('/pay/inv_e2e?status=paid');
    await expect(page.getByTestId('checkout-status')).toHaveText('Waiting for payment');
    status = 'paid';
    await expect(page.getByTestId('checkout-status')).toHaveText('Paid', { timeout: 5000 });
  });
});

test.describe('mobile overflow and tap targets', () => {
  test.skip(({ viewport }) => viewport?.width !== 390, '390px viewport only');

  const paths = [
    '/',
    '/pricing',
    '/pay/demo/waiting',
    '/pay/demo/confirming',
    '/pay/demo/paid',
    '/pay/demo/underpaid',
    '/pay/demo/expired',
    '/pay/demo/failed',
    '/dashboard',
    '/dashboard/invoices',
    '/dashboard/invoices/INV-1045',
    '/dashboard/payment-links',
    '/dashboard/payment-links/new',
    '/dashboard/api-keys/pending',
    '/dashboard/api-keys/approved',
    '/dashboard/api-keys/rejected',
    '/dashboard/api-keys/approved?environment=production',
    '/dashboard/webhooks',
    '/dashboard/settings',
    '/?theme=dark',
    '/pricing?theme=dark',
    '/pay/demo/waiting?theme=dark',
    '/dashboard?theme=dark',
  ];

  for (const path of paths) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(50);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBe(390);
    });
  }

  test('dashboard controls are at least 44px tall', async ({ page }) => {
    await page.goto('/dashboard/invoices');
    await expectTaps(page);
    await page.goto('/dashboard/settings');
    await expectTaps(page);
    await page.goto('/dashboard/api-keys/pending');
    await expectTaps(page);
  });
});

async function expectTaps(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.btn,.chip,.mnav a,.tab,.mtop .btn')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== 'none' && rect.width > 0 && rect.height < 44;
      })
      .map(
        (element) =>
          `${element.textContent?.trim().slice(0, 30) ?? ''} ${Math.round(element.getBoundingClientRect().height)}`,
      ),
  );
  expect(small).toEqual([]);
}

function checkoutBody(status: 'waiting' | 'paid') {
  return {
    object: 'checkout',
    livemode: false,
    public_id: 'inv_e2e',
    status,
    merchant_name: 'Northwind Studio',
    price_amount: '49.00',
    price_currency: 'usd',
    pay_amount: '0.00100000',
    pay_currency: 'btc',
    pay_address: 'tb1qsimulationairexpaye2e000000000000000',
    actually_paid: status === 'paid' ? '0.00100000' : '0',
    network: 'bitcoin',
    description: 'Simulated checkout',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    overpaid: false,
    late_payment_review: false,
  };
}
