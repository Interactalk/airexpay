# Changelog

## v0.5 — 2026-11-03 (round 5: mobile, owner request)
- Every page now has a 390 light mockup and PNG.
- Dashboard pages also have dark 390 versions:
  - overview, invoices, invoice detail, payment links and the create dialog;
  - API keys (pending, approved, rejected, production);
  - webhooks and settings.
- New pages:
  - `dashboard-payment-links-create`: the list page without the dialog is now `dashboard-payment-links`.
  - `dashboard-*-dark`: a dark version of every dashboard page.
- Mobile patterns:
  - Tables become card lists: invoices, links, keys, webhook delivery log and members. The row action is pinned top-right.
  - The invoice drawer and the dialogs open as bottom sheets with a grabber, and dialog buttons stack.
  - Tap targets are at least 44px: buttons, chips, section nav and tabs.
  - Safe-area padding (`viewport-fit=cover`, `env(safe-area-inset-*)`) on the top bar, main area, sheets, checkout and landing.
- Webhook endpoint cards stack, and long URLs wrap.
- Fixes found while reviewing the PNGs:
  - The row actions sat on their own line; they are now pinned top-right.
  - The delivery-log header was cramped; it now wraps.
  - The tab labels had lost their spacing ("All9").
- Checks:
  - overflow: 38/38 shots at 390 pass;
  - tap targets: 22/22 dashboard shots at 390 pass;
  - contrast: 0 failures.

## v0.4 — 2026-11-03 (round 4)
- **Decision: V1 has no manual override for underpaid invoices.** Reported by AirExPay and attributed to the owner. INV-1045 stays Underpaid in both the list and the drawer. The drawer shows only neutral guidance ("The customer can contact you to arrange the remaining amount.") and has no action.
  - Removed: the override button, its dialog, the "manually accepted" paid state, the related back-end note and its components.
  - Deleted pages and PNGs: `dashboard-invoice-accept-dialog` and `dashboard-invoice-accepted`.
  - The entries for v0.2 and v0.3 below are kept as history only.
- Production Live mode: the label is now a small pill next to the org name (sidebar org card on desktop, top bar on mobile). The thin strip is used for the simulation banner only.
- Checks: 23/23 shots at 390 pass the overflow check; contrast has 0 failures.

## v0.3 — 2026-11-03 (round 3)
- Banner rule: staging always shows the simulation banner. Added the `dashboard-api-keys-approved-production` page (desktop and mobile), which swaps the banner for a quiet "Live mode" label. The rule is documented in DESIGN_SYSTEM.md.
- Transaction hashes:
  - Tron hashes are 64 lowercase hex characters with no `0x` (invoice drawer, checkout confirming and paid).
  - The Ethereum hash on the failed checkout is `0x` plus 64 hex characters.
  - All hashes are shown in full.
- Accepted variant: the INV-1045 list row and the drawer badge now read "Paid (manually accepted)".
- Accept as paid back-end note (PENDING owner confirmation): emits `invoice.paid` with `resolution: "manual_acceptance"`, cannot be undone, and is logged in `audit_events`. The dialog copy is updated to match.
- Mobile:
  - The section nav and tabs are horizontal scrollers with an edge fade.
  - Cards scroll wide tables internally.
  - The settings grid stacks, and the members Status column is hidden.
  - Added mobile shots: api-keys-approved, api-keys-approved-production, settings, invoice-accepted.
- New overflow check in `src/shoot.py` writes `overflow-report.md`. It found settings mobile at 854px; that is fixed and all 25 shots at 390 now pass.

## v0.2 — 2026-11-03 (round 2)
### Decisions applied
- Fonts: Inter for all UI and Newsreader for marketing headlines only. Both are bundled locally.
- Accent kept at #1e3a5f; `--primary` and `--accent-foreground` were updated to match exactly.
- Labels: "Underpaid" in the dashboard and "Partially paid" in checkout.
- Accept as paid: a manual, audited action limited to Owner and Admin. It has a confirm dialog with a required reason, a checkbox and an audit note, and an accepted state with an audit callout and timeline entry. It is marked **PENDING owner confirmation**. "Request remaining" has been removed.
- API keys:
  - The Go-live review card has pending, approved and rejected states.
  - Live keys are issued by AirExpay only and are never self-serve.
  - The button now reads "Create test key".
- Added a pricing placeholder page ("Pricing coming soon", no numbers) in light and dark. The payment-link dialog and the landing nav link to it.
- The overview metric is renamed "Paid invoice volume (USD equivalent, not a balance)".
- The landing preview and code sample are tagged "Example".
- Dark mode added for landing, pricing and all six checkout states (mobile, plus desktop waiting).
- Added mobile (390) dashboard views: overview, invoices list, invoice detail, accept dialog and API keys.

### Fixes
- The landing floating card said USDC on a USDT invoice. It now says USDT.
- The landing preview footer was hidden behind the floating card. Fixed.
- On landing mobile:
  - the page scrolled horizontally (442px wide);
  - the email input had collapsed;
  - the hero had no side padding;
  - the code sample's Example tag overlapped the code;
  - the headline lost a space where a line break is hidden ("need,none");
  - the Early access pill wrapped.
  All fixed.
- The dark CTA band was too loud. It now uses a card surface with a border.
- The paid-state checkout buttons overflowed the card. They are now stacked.
- Mobile dashboard:
  - the top bar covered the invoice sheet (fixed with z-index layering);
  - the KPI Example tags were cramped;
  - the Live keys header wrapped;
  - the overview table overflowed.
  All fixed.
- Accepted invoice: the "Outstanding" box was left over. It now reads "Shortfall accepted", and a cut-off timeline line was fixed.
- Input borders now meet 3:1 contrast in both themes (round 1 carry-over, re-verified).

## v0.1 — round 1
- Initial tokens, Tailwind preset, contrast script, landing, 6 checkout states and the dashboard MVP with a simulation banner.
