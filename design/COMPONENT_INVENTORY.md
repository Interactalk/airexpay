# Component inventory → shadcn/ui

| Component | Where | shadcn/ui primitive(s) | Notes |
|---|---|---|---|
| Button (primary / outline / ghost / destructive-ghost; sm, default, lg) | everywhere | `Button` | variants map 1:1 (`default`, `outline`, `ghost`); destructive text-only for Revoke |
| StatusBadge | tables, drawer, checkout | `Badge` (custom variants) | **Custom wrapper**: `status` prop → token classes + dot + label; customer vs merchant label map |
| ExampleTag | KPIs, tables, landing | `Badge` variant `outline` dashed | **Custom** small-caps dashed tag |
| SimulationBanner | dashboard top | `Alert` | **Custom** full-width sticky, `role=status`, uses `--sim*` tokens |
| AppSidebar / OrgSwitcher | dashboard | `Sidebar` (shadcn sidebar block), `DropdownMenu`, `Avatar` | |
| PageHeader | dashboard | — | **Custom** layout: title, description, actions |
| KpiCard | overview | `Card` | **Custom** content; always shows ExampleTag until real data |
| BarChart | overview | `Chart` (Recharts) | single accent colour, last bar emphasised |
| SetupChecklist | overview | `Card`, `Checkbox`-style indicator | **Custom** |
| DataTable (invoices, links, keys, deliveries, members) | dashboard | `Table` + TanStack Table, `Pagination` | right-aligned tabular amounts |
| FilterTabs | invoices, API keys, settings | `Tabs` | |
| SearchInput | invoices | `Input` | leading icon |
| FacetFilter chips (Status, Asset, Network, date) | invoices, webhooks | `Popover` + `Command` + `Badge` (shadcn data-table faceted filter) | date uses `Calendar` in `Popover` |
| InvoiceDetailDrawer | invoices | `Sheet` (side=right, 520px) | Amount summary, `Separator`, key-value list |
| KeyValueList | drawer, checkout | — | **Custom** `<dl>` grid |
| EventTimeline | drawer | — | **Custom** list with status dots |
| CopyField (address, key, URL) | checkout, API keys, drawer | `Input` readOnly + `Button` + `Tooltip`/`Toast` ("Copied") | **Custom** composite, mono text |
| NewPaymentLinkDialog | payment links | `Dialog`, `Form`, `Input`, `Select`, `Label` | asset multi-select = `Popover`+`Command` |
| AssetChip | dialog | `Badge` + close `Button` | |
| NewKeyReveal callout | API keys | `Alert` | shown once after creation |
| RowActions | tables | `DropdownMenu` | |
| WebhookEndpointCard | webhooks | `Card`, `Badge` | |
| RoleSelect | team | `Select` | |
| Toggle | settings | `Switch` | |
| CheckoutPanel | checkout | `Card` | **Custom** layout per state (waiting, confirming, paid, underpaid, expired, failed) |
| QrCode | checkout | — | **Custom**, render client-side (e.g. `qrcode` lib) on white tile, alt text |
| Countdown | checkout | — | **Custom**, `aria-live="polite"` at minute granularity, tabular nums |
| ConfirmationProgress | checkout | `Progress` | label "7 of 12" |
| CheckoutStepper | checkout | — | **Custom** 3-segment |
| OrderSummary | checkout desktop | `Card`/`Separator` | |
| Marketing: Header, Hero, WaitlistForm, FeatureCard, Steps, CodeBlock, CTA band, Footer | landing | `Button`, `Input`, `Card` | CodeBlock custom (dark surface, mono) |
| Toast | global | `Sonner` | copy confirmations, save results |
| UnderpaidGuidance | invoice drawer | `Alert` (neutral) | static text, no action (V1 has no override) |
| LiveModePill | sidebar org card, mobile top bar | `Badge` (paid tokens) | production only; replaces the simulation banner |
| GoLiveReviewCard | API keys | `Card`, `Badge`, `Button` | **Custom**; states pending / approved / rejected with checklist |
| LiveKeysPanel (locked / issued) | API keys | `Card`, `Table`, empty state | never shows a "create live key" action |
| MobileTopBar + MobileSectionNav | dashboard ≤760px | `Sheet` (menu), `ScrollArea`, `Tabs`-style links | **Custom** |
| PricingPlaceholder | marketing | `Card`, `Button` | no prices |
| ThemeToggle (dark) | landing, checkout, dashboard | `.dark` class on `<html>`; `DropdownMenu` if exposed | checkout follows `prefers-color-scheme` |
