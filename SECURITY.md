# Security

AirExpay Phase 1 is simulation software. It does not process live payments, hold wallets, or connect to a hosted database.

## Reporting

This repository is public. Do not open a public issue that includes a secret, a customer payload, or a working exploit. Contact the AirexPay LLC owner through the channel they already use with you. No security mailbox has been designated yet.

## What not to commit

- NOWPayments, Supabase, Cloudflare, Resend, or any other credential
- `.env`, `.dev.vars`, or Wrangler secret values
- Ciphertext keys (`CREDENTIALS_KEK`)

`.env.example` contains only public placeholders (`ak_test_simulation_alpha`, `simulation-ipn-secret`). They authenticate the in-memory demo and nothing else.

## Payment rules that must stay true

- Only provider status `finished` marks an invoice paid.
- `partially_paid` becomes `underpaid` and is not fulfilled.
- IPN signatures are HMAC-SHA512 over the recursively key-sorted JSON body. Number tokens keep the spelling from the raw body. Comparison is constant-time.
- Mode A cannot be enabled with an environment variable while `MODE_A_FEATURE_FLAG` is false.
