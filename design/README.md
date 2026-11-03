# AirExpay design (v0.5, proposal — example data only)

Calm, non-custodial fintech UI for AirExpay. Nothing here touches the repo, Supabase, Cloudflare, or any secret. All amounts, names, addresses and hashes are fake.

## Files
- `tokens.css`: CSS variables in light and dark (`:root`, `.dark`). Accent #1e3a5f; Inter for UI, Newsreader for marketing headlines.
- `tailwind.theme.ts`: Tailwind preset that maps to the tokens.
- `DESIGN_SYSTEM.md`: principles, tokens, contrast table, product decisions (no underpaid override in V1, Go-live review, banner rule, pricing, labels) and the mobile layout.
- `COMPONENT_INVENTORY.md`: components mapped to shadcn/ui.
- `overflow-report.md`: horizontal-overflow check on every 390 shot (written by `src/shoot.py`).
- `tap-target-report.md`: 44px tap-target check on every dashboard 390 shot (written by `src/shoot.py`).
- `CHANGELOG.md`: what changed between versions.
- `contrast.py` → `contrast-report.md`: WCAG check. Run `python3 contrast.py`; 0 failures.
- `assets/fonts/*.woff2` (Inter 400–700, Newsreader 500, OFL) and `assets/qr-example.png` (QR that encodes a non-address).
- `src/gen.py`: builds `mockups/*.html`. `src/shoot.py` renders the PNGs with Playwright and Chrome.
- `mockups/`: 40 static HTML pages:
  - landing and pricing, each in light and dark;
  - checkout in 6 states × light/dark;
  - dashboard: overview (also dark), invoices, invoice detail (underpaid), payment links, payment-link create dialog (`dashboard-payment-links-create`), webhooks, settings, and API keys in three staging states (pending, approved, rejected) plus `approved-production` (Live mode pill next to the org name, no banner).

Every dashboard page also has a `-dark` twin (`dashboard-*-dark.html`).

## Mobile (390) patterns
- **Tables become card lists:** each row is a card; the header labels are injected as `data-label` attributes by `cardify()` in `src/gen.py`.
- **Bottom sheets:** the invoice drawer and the dialogs open as bottom sheets with a grabber, and dialog buttons stack full width.
- **Tap targets and safe areas:** controls are at least 44px tall, with `env(safe-area-inset-*)` padding and `viewport-fit=cover`.

## Regenerate
```
python3 src/gen.py && /tmp/venv/bin/python src/shoot.py
```
(The venv needs `playwright`; it uses the system `google-chrome`.)

## Screenshots (57; desktop 1440 or mobile 390 at 2x)
Every page has a light 390 mobile PNG. Dashboard pages also have dark 390 PNGs.

- `screenshots/checkout-confirming-dark-mobile-390.png`
- `screenshots/checkout-confirming-mobile-390.png`
- `screenshots/checkout-expired-dark-mobile-390.png`
- `screenshots/checkout-expired-mobile-390.png`
- `screenshots/checkout-failed-dark-mobile-390.png`
- `screenshots/checkout-failed-mobile-390.png`
- `screenshots/checkout-paid-dark-mobile-390.png`
- `screenshots/checkout-paid-desktop-1440.png`
- `screenshots/checkout-paid-mobile-390.png`
- `screenshots/checkout-underpaid-dark-mobile-390.png`
- `screenshots/checkout-underpaid-mobile-390.png`
- `screenshots/checkout-waiting-dark-desktop-1440.png`
- `screenshots/checkout-waiting-dark-mobile-390.png`
- `screenshots/checkout-waiting-desktop-1440.png`
- `screenshots/checkout-waiting-mobile-390.png`
- `screenshots/dashboard-api-keys-approved-dark-mobile-390.png`
- `screenshots/dashboard-api-keys-approved-desktop-1440.png`
- `screenshots/dashboard-api-keys-approved-mobile-390.png`
- `screenshots/dashboard-api-keys-approved-production-dark-mobile-390.png`
- `screenshots/dashboard-api-keys-approved-production-desktop-1440.png`
- `screenshots/dashboard-api-keys-approved-production-mobile-390.png`
- `screenshots/dashboard-api-keys-pending-dark-mobile-390.png`
- `screenshots/dashboard-api-keys-pending-desktop-1440.png`
- `screenshots/dashboard-api-keys-pending-mobile-390.png`
- `screenshots/dashboard-api-keys-rejected-dark-mobile-390.png`
- `screenshots/dashboard-api-keys-rejected-desktop-1440.png`
- `screenshots/dashboard-api-keys-rejected-mobile-390.png`
- `screenshots/dashboard-invoice-detail-dark-mobile-390.png`
- `screenshots/dashboard-invoice-detail-desktop-1440.png`
- `screenshots/dashboard-invoice-detail-mobile-390.png`
- `screenshots/dashboard-invoices-dark-mobile-390.png`
- `screenshots/dashboard-invoices-desktop-1440.png`
- `screenshots/dashboard-invoices-mobile-390.png`
- `screenshots/dashboard-overview-dark-desktop-1440.png`
- `screenshots/dashboard-overview-dark-mobile-390.png`
- `screenshots/dashboard-overview-desktop-1440.png`
- `screenshots/dashboard-overview-mobile-390.png`
- `screenshots/dashboard-payment-links-create-dark-mobile-390.png`
- `screenshots/dashboard-payment-links-create-desktop-1440.png`
- `screenshots/dashboard-payment-links-create-mobile-390.png`
- `screenshots/dashboard-payment-links-dark-mobile-390.png`
- `screenshots/dashboard-payment-links-desktop-1440.png`
- `screenshots/dashboard-payment-links-mobile-390.png`
- `screenshots/dashboard-settings-dark-mobile-390.png`
- `screenshots/dashboard-settings-desktop-1440.png`
- `screenshots/dashboard-settings-mobile-390.png`
- `screenshots/dashboard-webhooks-dark-mobile-390.png`
- `screenshots/dashboard-webhooks-desktop-1440.png`
- `screenshots/dashboard-webhooks-mobile-390.png`
- `screenshots/landing-dark-desktop-1440.png`
- `screenshots/landing-dark-mobile-390.png`
- `screenshots/landing-desktop-1440.png`
- `screenshots/landing-mobile-390.png`
- `screenshots/pricing-dark-desktop-1440.png`
- `screenshots/pricing-dark-mobile-390.png`
- `screenshots/pricing-desktop-1440.png`
- `screenshots/pricing-mobile-390.png`
