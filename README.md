# AirExpay

Simple crypto payments. Global business. — a product of AirexPay LLC.

**Status:** Phase 1.5 simulation. The configured provider cost is 1.5%, and the merchant fee is that cost times 1.5. Live payments are not authorized. See `docs/PROJECT_STATUS.md` and `docs/PRICING.md`.

## Key finding

NOWPayments' current Terms (FD Transfers LLC, updated 19 Oct 2026, §15.1) exclude residents/citizens of the US, UK, EU, UAE and Russia. AirexPay LLC (US) appears ineligible without written confirmation. US-eligible alternatives are listed in `docs/NOWPAYMENTS_PROVIDER_APPROVAL.md` §Alternatives. The provider adapter keeps the product provider-independent.

## This repository

Phase 1.2 is a pnpm monorepo that runs against a mock provider. Unit tests still default to an in-memory database. `STORAGE_BACKEND=durable_object` uses the `INVOICE_STORE` Durable Object binding (configured for the dev and staging Workers). `STORAGE_BACKEND=postgres` does not connect to a hosted database. The Phase 1 migration is already on the dev project; later migrations are new files and are not applied by this app. `pnpm --filter @airexpay/api deploy` exits without contacting Cloudflare.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev:web        # http://localhost:5173
pnpm dev:api:local  # simulation API on http://127.0.0.1:8787 (no Cloudflare deploy)
pnpm dev:api        # local Worker only, wrangler dev --local
```

Requires Node.js 22 or newer. Copy `.env.example` if you want local placeholders. Those values are not credentials.

## Docs

| File                                                                                                                                          | Purpose                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| docs/INITIAL_ENVIRONMENT_AUDIT.md                                                                                                             | Tools, connectors, existing code                         |
| docs/NOWPAYMENTS_PROVIDER_APPROVAL.md                                                                                                         | Approval status, ToS evidence, draft email, alternatives |
| docs/LEGAL_AND_COMPLIANCE_DEPENDENCIES.md                                                                                                     | FinCEN, OFAC, state MTL, privacy, tax (not legal advice) |
| docs/PRODUCT_REQUIREMENTS.md, USER_PERSONAS.md, USER_JOURNEYS.md, MVP_SCOPE.md, PRODUCT_ROADMAP.md                                            | Product                                                  |
| docs/SYSTEM_ARCHITECTURE.md, INFRASTRUCTURE.md, DATABASE_ARCHITECTURE.md, API_ARCHITECTURE.md, SECURITY_ARCHITECTURE.md, PAYMENT_LIFECYCLE.md | Architecture                                             |
| docs/PRICING.md                                                                                                                               | Fee rule, rounding, collection mode                      |
| docs/DECISIONS.md, PROJECT_STATUS.md, CHANGELOG.md, docs/KNOWN_LIMITATIONS.md                                                                 | Governance                                               |
| SECURITY.md                                                                                                                                   | How to report a security issue                           |
