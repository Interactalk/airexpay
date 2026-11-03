# User Journeys

## J1 Merchant onboarding
Visit → Signup → Verify email → Create organization → Business profile → Connect provider (Mode B) or await platform approval (Mode A) → Simulation mode badge until approved → First invoice.
Metric: signup→first invoice median < 15 min.

## J2 Invoice payment
Merchant creates invoice (API or dashboard) → shares checkout URL → Payer selects currency/network → sees address, QR, amount, timer → pays → statuses waiting→confirming→confirmed→sending→finished → receipt email → merchant webhook `payment.finished`.
Branches: partially_paid → "underpaid" screen, merchant alerted, no fulfillment; expired → expired screen; failed → failed screen.

## J3 Payment link
Merchant creates link (fixed or open amount) → each open creates a new invoice → same as J2.

## J4 Developer integration
Create API key (shown once) → POST /v1/invoices with Idempotency-Key → register webhook endpoint → verify signature → test with mock provider scenarios.

## J5 Finance reconciliation
Filter payments by date/status → open detail → event timeline + provider IDs → export CSV → flagged mismatches from reconciliation job.

## J6 Support
Merchant opens Intercom → agent sees org id, plan, last payment statuses (no secrets) → escalates to engineering if webhook failures.
