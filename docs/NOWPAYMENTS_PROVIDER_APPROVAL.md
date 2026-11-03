# NOWPayments Provider Approval
Date: 2026-11-03 (Asia/Dhaka, UTC+6). Source terms: FD Transfers LLC Terms of Service, last updated 19 Oct 2026 — https://nowpayments.io/doc/fd-tos.pdf (note: the brief cited a 15 Dec 2025 version; the current one supersedes it).

**Overall: LIVE PAYMENTS BLOCKED.**

## Status / evidence
| Requirement | Status | Evidence |
|---|---|---|
| Business verification | Pending verification | Owner statement only; no document seen |
| US LLC eligibility | Pending written answer — **appears prohibited** | ToS §15.1: services "not rendered to residents or citizens of the European Union, the United Kingdom, the United States of America, the United Arab Emirates, the Russian Federation…"; §15.5 must comply even if blocking can be bypassed |
| Beneficial-owner eligibility | Pending written answer | §15.1 covers "citizens", so owners' nationality matters |
| Platform authorization (Mode A) | Pending written answer — conflicts with terms as written | §12.4 no sharing account access or API key; §13.4 no account sharing / buying / selling; §1.7.2 funds must belong to you |
| Third-party merchant processing | Pending written answer | Same as above; §14.1.10 bars using Services to create "a product or service competitive with the Services" |
| Sub-accounts | API exists, use unauthorised | Sub-partner API `POST /v1/sub-partner/balance` (custodial, JWT); §12.8 master fully responsible for sub-accounts |
| Merchant connection model (Mode B) | Pending written answer | §13.3 each merchant registers own wallet + API key; merchant-held keys in AirExpay need confirmation vs §12.4 |
| API access | Pending verification | Endpoints verified publicly (below); no keys provided |
| White-label permission | Pending written answer | Not documented |
| Platform fees | Pending written answer | Not documented; §11 fees per https://nowpayments.io/pricing (headline 1%), changeable any time (§11.5) |
| Partially paid handling | Documented | §12.9 merchant bears risk on "Partially Paid"; §4.4 manual completion may yield Partially Paid |
| Refunds | Documented partially | §7.3.2 refunds may incur fees/requirements |
| KYC/KYB | Documented partially | §10.8 third-party KYB at their discretion; §13.5 ongoing due diligence |
| Prohibited categories | Documented | §14.1.5 |
| Suspension | Documented | §1.8, §14.2 suspend/terminate without notice or reasons; §11.3.1 third party may refuse/delay |

## Verified API facts
- Base `https://api.nowpayments.io/v1`, sandbox `https://api-sandbox.nowpayments.io/v1` (sandbox `case`: success, common, failed, partially_paid).
- `GET /currencies`, `/currencies?fixed_rate=true`, `/full-currencies`, `/merchant/coins`, `/min-amount`, `/estimate` (7 RPS); `POST /invoice` (returns `id`, `invoice_url`); `POST /payment` (3 RPS; returns `payment_id`, `pay_address`); `GET /payment/{id}` (same API key that created it); `GET /payment/` list needs JWT from `POST /auth` (5-min token).
- Statuses: waiting, confirming, confirmed, sending, partially_paid, finished, failed, refunded, expired.
- IPN: header `x-nowpayments-sig`; HMAC-SHA512(IPN secret, JSON.stringify(recursively key-sorted body)); respond ≤3000 ms; IPs 51.89.194.21, 51.75.77.69, 138.201.172.58, 65.21.158.36; recurrent notifications configurable.
Sources: https://nowpayments.zendesk.com/hc/en-us/articles/21345824322717 · https://nowpayments.zendesk.com/hc/en-us/articles/21395546303389 · https://www.postman.com/lively-eclipse-136689/test/documentation/muz690z/nowpayments-api-sandbox

## Draft email (NOT SENT — requires owner approval)
To: partners@nowpayments.io · Cc: support@nowpayments.io
Subject: AirexPay LLC: eligibility and platform-model approval request

> Hello NOWPayments Compliance and Partnerships team,
>
> AirexPay LLC, a limited liability company registered in [STATE], United States, holds a verified NOWPayments Business account [ACCOUNT EMAIL/ID]. We are designing AirExpay, payment software for online merchants, and need written answers before any live use, with reference to your Terms of Service updated 19 October 2026:
> 1. Given §15.1, is AirexPay LLC (US-registered, beneficial owners citizens of [COUNTRY]) eligible? If not, is any approved structure available?
> 2. May the account process payments for independent third-party merchants, given §§1.7.2, 12.4 and 13.4?
> 3. Is there a platform, partner or sub-partner programme authorising onboarding of independent merchants, and what agreement governs it?
> 4. Can each merchant complete its own KYB with you and receive proceeds directly to its own wallet?
> 5. Alternatively, may merchants connect their own NOWPayments accounts to our software with their own API keys and IPN secrets?
> 6. Is a white-label checkout permitted, and does §14.1.10 apply to software built on your API?
> 7. May AirexPay charge a separate software/platform fee, and by which approved mechanism?
> 8. What transaction limits, asset and business-category restrictions apply?
> 9. What fee schedule would apply to us and to merchants under each model?
> 10. What happens to funds, notifications and our merchants if you suspend a merchant or payment?
>
> We will use only your sandbox until we receive written confirmation.
> Regards, [NAME], [TITLE], AirexPay LLC, [EMAIL]

## Alternatives to evaluate (US-eligible per public terms)
| Provider | US eligibility (public) | Platform / multi-merchant | Notes | Source |
|---|---|---|---|---|
| **Stripe — Stablecoins & Crypto payment method** | Available to US businesses in all states except New York; Stripe reviews access | **Connect supported** ("Connect platforms can accept crypto payments for all charge types"; `crypto_payments` capability per connected account) — an official platform model | USDC (Ethereum, Solana, Polygon, Base, Tempo), USDP, USDG; settles in USD to Stripe balance; $10,000 per-transaction limit; no disputes; refunds in stablecoin | https://docs.stripe.com/payments/accept-stablecoin-payments · https://docs.stripe.com/payments/stablecoin-payments |
| **BitPay** | BitPay, Inc. (Delaware) is FinCEN-registered MSB and licensed money transmitter where required; merchant acceptance everywhere in US except Hawaii and Louisiana | Partner/platform program not verified this run | Prohibited-industry list; KYB incl. UBO, bank account | https://www.bitpay.com/legal/terms-of-use · https://support.bitpay.com/hc/en-us/articles/34441041886861 |
| **Coinbase Business** (Coinbase Commerce closed 31 Mar 2026) | Available to US and Singapore C-corps and LLCs; KYB + KYC of ≥25% owners, EIN, W-9, business bank account | Multi-merchant/platform terms not verified this run | Replaces Commerce API | https://help.coinbase.com/en/coinbase/other-topics/business/business-overview · https://help.coinbase.com/en/transitioning-from-coinbase-commerce-to-coinbase-business |

Recommendation: evaluate Stripe Connect + stablecoins first for a US LLC platform model (regulated provider holds funds and runs KYC), BitPay second. Fees for Stripe (a Stripe blog cites 1.5%) and BitPay must be confirmed on their pricing pages.
