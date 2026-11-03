# AirExpay Design System (v0.4, proposal)

Calm, premium, professional fintech. Neutral cool-slate base, **one accent: ink-blue #1e3a5f** (`--primary: 214 52% 25%`). **Inter** for all interface text; **Newsreader** for marketing headlines only (landing, pricing) — never inside the dashboard or checkout. No gradients, no crypto imagery. Non-custodial: the UI never shows wallets, balances or payouts. All numbers in mockups are labelled example data.

Files: `tokens.css` (source of truth, shadcn-style HSL channels, `:root` + `.dark`), `tailwind.theme.ts` (preset), `contrast.py` → `contrast-report.md`.

## Colour

| Token | Light (HSL) | Dark (HSL) | Use |
|---|---|---|---|
| `--background` | 220 20% 98% | 222 24% 8% | App/page background |
| `--foreground` | 222 32% 11% | 210 20% 94% | Body text |
| `--card` / `--popover` | 0 0% 100% | 222 22% 11% | Surfaces |
| `--muted` | 220 16% 95% | 222 18% 15% | Subtle fills, table header |
| `--muted-foreground` | 220 10% 38% | 215 12% 68% | Secondary text |
| `--border` | 220 14% 88% | 222 15% 21% | Dividers (decorative) |
| `--input` | 220 10% 56% | 222 10% 46% | Form-field borders (≥3:1, WCAG 1.4.11) |
| `--primary` (accent, #1e3a5f) | 214 52% 25% | 212 75% 74% | Primary buttons, links, active tab, focus |
| `--accent` / `-foreground` | 213 45% 95% / 214 52% 25% | 213 35% 18% / 212 75% 80% | Selected nav, icon tiles |
| `--ring` | 213 60% 42% | 212 75% 70% | Focus ring (2px + 2px offset) |
| `--destructive` | 0 66% 42% | 0 70% 66% | Revoke / delete only |

The accent is the only saturated colour outside status. Do not introduce a second brand colour.

### Payment status (always colour **+ text label**, plus a dot glyph)

| Status | Label (dashboard) | Label (checkout, customer-facing) | Token set |
|---|---|---|---|
| waiting | Waiting for payment | Waiting for payment | `--status-waiting*` (slate) |
| confirming | Confirming | Confirming on {network} | `--status-confirming*` (blue) |
| paid | Paid | Paid | `--status-paid*` (green) |
| underpaid | Underpaid | Partially paid | `--status-underpaid*` (amber) |
| expired | Expired | Expired | `--status-expired*` (grey) |
| failed | Failed | Failed | `--status-failed*` (red) |
| refunded | Refunded | Refunded | `--status-refunded*` (violet) |

Each status has `--status-x` (bg), `--status-x-fg` (text) and `--status-x-border`. The `--sim*` set (amber) is reserved for the simulation-mode banner.

### Contrast (WCAG 2.x, computed by `python3 contrast.py`)

All text pairs ≥ 4.5:1; focus ring and input borders ≥ 3:1. `--border` is decorative only (cards also carry shadow/fill separation). Full table:

| Mode | Foreground | Background | Ratio | Required | Result |
|---|---|---|---|---|---|
| light | `--foreground` | `--background` | 16.85:1 | 4.5:1 | PASS |
| light | `--foreground` | `--card` | 17.66:1 | 4.5:1 | PASS |
| light | `--muted-foreground` | `--background` | 6.25:1 | 4.5:1 | PASS |
| light | `--muted-foreground` | `--card` | 6.55:1 | 4.5:1 | PASS |
| light | `--muted-foreground` | `--muted` | 5.82:1 | 4.5:1 | PASS |
| light | `--primary-foreground` | `--primary` | 11.28:1 | 4.5:1 | PASS |
| light | `--primary` | `--background` | 10.76:1 | 4.5:1 | PASS |
| light | `--primary` | `--card` | 11.28:1 | 4.5:1 | PASS |
| light | `--accent-foreground` | `--accent` | 9.99:1 | 4.5:1 | PASS |
| light | `--destructive-foreground` | `--destructive` | 6.62:1 | 4.5:1 | PASS |
| light | `--destructive` | `--card` | 6.62:1 | 4.5:1 | PASS |
| light | `--ring` | `--background` | 5.66:1 | 3.0:1 | PASS |
| light | `--input` | `--card` | 3.42:1 | 3.0:1 | PASS |
| light | `--input` | `--background` | 3.26:1 | 3.0:1 | PASS |
| light | `--border` | `--card` | 1.34:1 | — | decorative (non-text) |
| light | `--status-waiting-fg` | `--status-waiting` | 7.98:1 | 4.5:1 | PASS |
| light | `--status-waiting-fg` | `--card` | 9.20:1 | 4.5:1 | PASS |
| light | `--status-confirming-fg` | `--status-confirming` | 7.57:1 | 4.5:1 | PASS |
| light | `--status-confirming-fg` | `--card` | 8.60:1 | 4.5:1 | PASS |
| light | `--status-paid-fg` | `--status-paid` | 6.90:1 | 4.5:1 | PASS |
| light | `--status-paid-fg` | `--card` | 7.78:1 | 4.5:1 | PASS |
| light | `--status-underpaid-fg` | `--status-underpaid` | 6.86:1 | 4.5:1 | PASS |
| light | `--status-underpaid-fg` | `--card` | 7.61:1 | 4.5:1 | PASS |
| light | `--status-expired-fg` | `--status-expired` | 6.58:1 | 4.5:1 | PASS |
| light | `--status-expired-fg` | `--card` | 7.56:1 | 4.5:1 | PASS |
| light | `--status-failed-fg` | `--status-failed` | 7.25:1 | 4.5:1 | PASS |
| light | `--status-failed-fg` | `--card` | 8.22:1 | 4.5:1 | PASS |
| light | `--status-refunded-fg` | `--status-refunded` | 7.68:1 | 4.5:1 | PASS |
| light | `--status-refunded-fg` | `--card` | 8.89:1 | 4.5:1 | PASS |
| light | `--sim-fg` | `--sim` | 7.57:1 | 4.5:1 | PASS |
| dark | `--foreground` | `--background` | 16.28:1 | 4.5:1 | PASS |
| dark | `--foreground` | `--card` | 15.24:1 | 4.5:1 | PASS |
| dark | `--muted-foreground` | `--background` | 8.12:1 | 4.5:1 | PASS |
| dark | `--muted-foreground` | `--card` | 7.61:1 | 4.5:1 | PASS |
| dark | `--muted-foreground` | `--muted` | 6.80:1 | 4.5:1 | PASS |
| dark | `--primary-foreground` | `--primary` | 8.86:1 | 4.5:1 | PASS |
| dark | `--primary` | `--background` | 9.16:1 | 4.5:1 | PASS |
| dark | `--primary` | `--card` | 8.58:1 | 4.5:1 | PASS |
| dark | `--accent-foreground` | `--accent` | 8.26:1 | 4.5:1 | PASS |
| dark | `--destructive-foreground` | `--destructive` | 5.74:1 | 4.5:1 | PASS |
| dark | `--destructive` | `--card` | 5.56:1 | 4.5:1 | PASS |
| dark | `--ring` | `--background` | 8.12:1 | 3.0:1 | PASS |
| dark | `--input` | `--card` | 3.55:1 | 3.0:1 | PASS |
| dark | `--input` | `--background` | 3.80:1 | 3.0:1 | PASS |
| dark | `--border` | `--card` | 1.37:1 | — | decorative (non-text) |
| dark | `--status-waiting-fg` | `--status-waiting` | 8.52:1 | 4.5:1 | PASS |
| dark | `--status-waiting-fg` | `--card` | 10.55:1 | 4.5:1 | PASS |
| dark | `--status-confirming-fg` | `--status-confirming` | 8.17:1 | 4.5:1 | PASS |
| dark | `--status-confirming-fg` | `--card` | 10.06:1 | 4.5:1 | PASS |
| dark | `--status-paid-fg` | `--status-paid` | 8.43:1 | 4.5:1 | PASS |
| dark | `--status-paid-fg` | `--card` | 10.91:1 | 4.5:1 | PASS |
| dark | `--status-underpaid-fg` | `--status-underpaid` | 9.21:1 | 4.5:1 | PASS |
| dark | `--status-underpaid-fg` | `--card` | 11.46:1 | 4.5:1 | PASS |
| dark | `--status-expired-fg` | `--status-expired` | 7.06:1 | 4.5:1 | PASS |
| dark | `--status-expired-fg` | `--card` | 8.57:1 | 4.5:1 | PASS |
| dark | `--status-failed-fg` | `--status-failed` | 7.76:1 | 4.5:1 | PASS |
| dark | `--status-failed-fg` | `--card` | 8.79:1 | 4.5:1 | PASS |
| dark | `--status-refunded-fg` | `--status-refunded` | 8.69:1 | 4.5:1 | PASS |
| dark | `--status-refunded-fg` | `--card` | 9.93:1 | 4.5:1 | PASS |
| dark | `--sim-fg` | `--sim` | 9.49:1 | 4.5:1 | PASS |

## Typography
- Sans: **Inter** for all UI (dashboard, checkout, marketing body). Serif: **Newsreader 500** for marketing headlines only. Fonts are bundled in `assets/fonts/` (from @fontsource, OFL) via `mockups/fonts.css`; Mono: JetBrains Mono for addresses, keys, hashes, event names.
- Scale (size / line-height): xs 12/16 · sm 14/20 (dashboard body) · base 16/24 (marketing body, checkout) · lg 18/28 · xl 20/28 · 2xl 24/32 (page titles) · 3xl 30/36 · 4xl 40/46 · 5xl 56/62 (landing H1). Weights 400/500/600.
- **Amounts:** always `font-variant-numeric: tabular-nums` (`.tabular`/`.amount`, Tailwind `tabular-nums`), right-aligned in tables, asset code in muted colour after the number (`420.00 USDT`). Never round crypto amounts below the asset's display precision; show network explicitly.

## Spacing, radius, shadow
- 4px base (Tailwind default scale). Page padding 28/36px; card padding 16–20px; section gap 16px; marketing sections 72px (48px mobile).
- Radius: sm 6px (badges), md 8px (buttons, inputs), lg 10px (cards), xl 16px (sheets, dialogs, checkout panel).
- Shadows: xs (cards), sm (checkout panel), md (popovers), lg (sheet/dialog). Low-alpha, never coloured.

## Layout
- Dashboard: 240px sidebar + fluid content (max 1200px); simulation banner pinned above everything while in sandbox.
- Checkout: mobile-first single column (max 420px). ≥900px: two-column with order summary left.
- Marketing: 1120px container.

## Accessibility
- Status never relies on colour alone (label + dot). Countdown has `aria-label` with full words; progress uses `role=progressbar`.
- Visible focus ring `--ring` 2px offset on every interactive element; keyboard-reachable copy buttons; drawers/dialogs trap focus (shadcn Sheet/Dialog do this).
- Hit targets ≥ 36px dashboard, ≥ 44px checkout primary actions.

## Decisions (round 2)
- **Status labels:** dashboard says **Underpaid**; customer-facing checkout says **Partially paid**. Same tokens.
- **Underpaid invoices (V1 product decision, owner):** no override. An underpaid invoice stays **Underpaid** in the list and drawer. The drawer shows the received and outstanding amounts plus neutral guidance ("The customer can contact you to arrange the remaining amount. This invoice stays Underpaid.") with no action button and no promises.
- **Live API keys** are never self-serve. They sit behind a **Go-live review** with three states — **pending** (blue "Review pending", live keys locked), **approved** (green, key issued by AirExpay; extra keys are requested, not created), **rejected** (red, reasons + "Fix and resubmit", keys locked). Test keys remain self-serve.
- **Pricing:** `pricing.html` is a placeholder ("Pricing coming soon", no numbers). The payment-link dialog links to it.
- **Overview metric:** "Paid invoice volume (USD equivalent, not a balance)".
- **Example labelling on landing:** preview card carries an "Example" tag and "Example data only." footer; the code sample has an "Example" tag.

## Environment banner rule (v0.3)
- **Staging/sandbox: always show the simulation banner**, whatever state the go-live review or keys are in (pending, approved or rejected). It cannot be dismissed.
- **Production with approved live keys:** no banner. A small green **"Live mode"** pill (11px, dot plus text) sits next to the org name: in the sidebar org card on desktop and in the top bar on mobile. The thin strip above the app is used **only** for the simulation banner. The org card reads "Example merchant · Live". See `dashboard-api-keys-approved-production`.
- Production without approval does not exist. Merchants can't reach production until the review is approved.

## Transaction hashes
- Tron: 64 lowercase hex characters, no `0x`.
- EVM chains: `0x` followed by 64 lowercase hex characters.
- Shown in full in mono 12px with `word-break: break-all`, plus an explorer link icon.

## Mobile dashboard (390)
Sidebar is replaced by a top bar (menu, brand, org) and a section nav. **The section nav and tabs are horizontal scrollers with a 32px right edge fade (mask-image), hidden scrollbars, and trailing space so the last item can scroll clear of the fade. The page itself never scrolls sideways.** Wide tables scroll inside their card, and `body` uses `overflow-x: clip` as a safety net. `src/shoot.py` checks `document.documentElement.scrollWidth <= innerWidth` on every 390 shot and writes the result to `overflow-report.md`. Page actions become full-width; KPIs go 2-up with the Example tag above the label; tables drop secondary columns (network, created, permissions) via `.hm`; the invoice drawer becomes a full-screen sheet; dialogs are inset 14px.

## Content rules
No claims of zero fees, instant settlement, guarantees or licences. Disclose that network fees are paid by the customer's wallet. Example data is always labelled ("Example", "Example data", "Illustrative example", "Example — do not send funds").
