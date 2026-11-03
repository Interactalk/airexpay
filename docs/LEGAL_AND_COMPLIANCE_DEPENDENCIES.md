# Legal and Compliance Dependencies

Date: 2026-11-03 (Asia/Dhaka, UTC+6). **Not legal advice.** Research notes for qualified US counsel, who must determine the actual position.

## Sources opened and verified this run

- FinCEN FIN-2019-G001 (9 May 2019), "Application of FinCEN's Regulations to Certain Business Models Involving Convertible Virtual Currencies" — https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models (PDF: https://www.fincen.gov/sites/default/files/2019-05/FinCEN%20Guidance%20CVC%20FINAL%20508.pdf)
- OFAC "Sanctions Compliance Guidance for the Virtual Currency Industry" (15 Oct 2021) — https://ofac.treasury.gov/recent-actions/20211015 ; brochure https://ofac.treasury.gov/media/913571/download?inline=

## FinCEN — what the guidance says (verified text)

- §4.6 "CVC payment processors fall within the definition of a money transmitter and are not eligible for the payment processor exemption", because the exemption requires operating "through clearance and settlement systems that admit only BSA-regulated financial institutions", which CVC processors generally cannot satisfy. The four exemption conditions: (a) facilitate purchase of goods/services, (b) BSA-regulated clearance/settlement systems, (c) formal agreement, (d) agreement with the seller who receives the funds.
- Excluded from "money transmitter": a person that only "provides the delivery, communication, or network access services used by a money transmitter" (§4.5.1(b) treats software suppliers as "engaged in trade and not money transmission").
- §4.2: the key test for wallets is whether the intermediary has "total independent control over the value"; hosted wallet providers are money transmitters; unhosted wallet software providers are not.
- Implication (for counsel): AirExpay is most defensible as pure software if it never receives, holds, controls or transmits funds and merchants contract directly with a regulated processor (Mode B or Stripe Connect-style). Mode A via NOWPayments sub-partner custodial balances, or AirExpay collecting a platform fee out of payment flows, increases MSB risk.

## OFAC — what the guidance says (verified text)

- "OFAC sanctions compliance obligations apply equally to transactions involving virtual currencies and those involving traditional fiat currencies."
- Applies to technology companies, exchangers, administrators, miners, wallet providers and users; all US persons incl. US-organised entities.
- Recommends a risk-based program (OFAC Framework: management commitment, risk assessment, internal controls, testing/auditing, training), sanctions list and geographic screening, IP geolocation controls, KYC data use, transaction monitoring; blocked property must be reported (within 10 business days, per brochure).

## Status matrix

| Area           | Confirmed                                                                                                                    | Uncertain                                                                          | Unresolved                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| FinCEN MSB     | Guidance text above; CVC processors = money transmitters                                                                     | Whether AirExpay software-only role fits the "network access / software" exclusion | Counsel opinion; registration need                                                    |
| OFAC           | Applies to AirexPay LLC as US entity                                                                                         | Screening scope for merchants vs payers                                            | Program design, list vendor                                                           |
| State MTL      | Many states license money transmission; BitPay limits service in HI/LA, Stripe excludes NY for crypto — shows state variance | Whether any state treats AirExpay as transmitter                                   | 50-state analysis (not researched this run)                                           |
| Privacy        | Will process merchant/customer PII                                                                                           | CCPA/CPRA thresholds; GDPR if EU payers                                            | Privacy policy, DPA with vendors (Supabase, Resend, PostHog, Intercom, n8n EU-hosted) |
| Tax            | Owners' / LLC tax treatment is counsel/CPA matter                                                                            | Sales tax on SaaS by state; crypto receipt reporting (e.g. 1099-DA broker rules)   | CPA engagement                                                                        |
| Provider terms | NOWPayments §15.1 excludes US                                                                                                | —                                                                                  | Written answer                                                                        |

## Questions for US counsel

1. Under FIN-2019-G001, does AirExpay as described (software, hosted checkout UI, merchants' own processor accounts) qualify as a non-transmitter? Under Mode A?
2. Does charging a platform fee deducted from payment flows change the analysis vs a separately invoiced SaaS fee?
3. Does using an offshore processor that excludes US persons expose AirexPay LLC or its owners to risk?
4. Which state MTL regimes could apply, and is NY BitLicense relevant?
5. Minimum OFAC program for a software platform: merchant screening, payer geo-blocking, wallet screening?
6. Required merchant terms, payer disclosures, refund/underpayment language?
7. Privacy obligations (CCPA, GDPR for EU payers) and data retention for payment records.
8. Tax: SaaS sales tax nexus; any crypto-reporting duty if AirExpay never holds funds.
9. Is a Stripe Connect or BitPay partner model materially lower risk?
