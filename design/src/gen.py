"""Generates static HTML mockups into ../mockups. Run: python3 src/gen.py"""
import pathlib
OUT = pathlib.Path(__file__).resolve().parent.parent / "mockups"
ADDR = "TExampLeAddr3ssNotReaL000000"
def page(title, body, cls="", extra_css=""):
    return f"""<!doctype html><html lang="en" class="{cls}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title} · AirExpay mockup</title><link rel="stylesheet" href="app.css"><style>{extra_css}</style></head><body>{body}</body></html>"""
def badge(s, label=None):
    labels = dict(waiting="Waiting for payment", confirming="Confirming", paid="Paid", underpaid="Underpaid", expired="Expired", failed="Failed", refunded="Refunded")
    return f'<span class="badge s-{s}">{label or labels[s]}</span>'
I = dict(  # minimal line icons (lucide-style paths)
 home='<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/>',
 inv='<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/>',
 link='<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
 key='<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
 hook='<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>',
 gear='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 team='<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
 doc='<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/>',
 copy='<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
 search='<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 plus='<path d="M12 5v14M5 12h14"/>', check='<path d="M20 6 9 17l-5-5"/>', x='<path d="M18 6 6 18M6 6l12 12"/>',
 clock='<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', alert='<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
 dl='<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>', lock='<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 ext='<path d="M14 3h7v7M10 14 21 3M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>', dots='<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
)
TX_1045="9f2c4e1a7b3d5f6081c2e4a6b8d0f1327a5c9e0b4d6f8a1c3e5b7d9f0a2c4e6b"
TX_1046="3c7e0a9b1d5f2e4c6a8b0d1f3e5c7a9b2d4f6e8a0c1b3d5f7e9a2c4b6d8f0e1a"
TX_ETH="0x5b1e8d2c4a6f9e0b3d7c1a5e8f2b4d6c9a0e3f7b1d5c8a2e6f4b9d0c3a7e1f5b"
def txh(h): return f'<dd class="mono" style="word-break:break-all;font-size:12px;line-height:1.45">{h} <span style="vertical-align:-2px">{ic("ext",13)}</span></dd>'
def ic(n, s=16, extra=""): return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {extra}>{I[n]}</svg>'

SIM = '<div class="sim" role="status">' + ic("alert",15) + '<span><b>Simulation mode.</b> No real payments are processed. Invoices, payments and webhooks on this screen are simulated example data.</span><a class="sim-more" href="#" style="text-decoration:underline">Learn about going live</a></div>'
NAV = [("Overview","home","dashboard-overview"),("Invoices","inv","dashboard-invoices"),("Payment links","link","dashboard-payment-links")]
DEV = [("API keys","key","dashboard-api-keys"),("Webhooks","hook","dashboard-webhooks")]
def shell(active, content, overlay="", cls="", mode="staging"):
    items = "".join(f'<a class="nav {"on" if f==active else ""}" href="{f}.html">{ic(i)}{n}</a>' for n,i,f in NAV)
    dev = "".join(f'<a class="nav {"on" if f==active else ""}" href="{f}.html">{ic(i)}{n}</a>' for n,i,f in DEV)
    LIVEP = ' <span class="livepill"><span class="livedot"></span>Live mode</span>' if mode=="production" else ""
    side = f'''<aside class="side"><div class="brand">Airex<span>pay</span></div>
<div class="org"><div class="av">N</div><div style="flex:1"><div style="font-weight:600">Northwind Studio{LIVEP}</div><div class="muted" style="font-size:12px">Example merchant · {"Live" if mode=="production" else "Sandbox"}</div></div></div>
{items}<div class="navh">Developers</div>{dev}<div class="navh">Account</div>
<a class="nav {"on" if active=="dashboard-settings" else ""}" href="dashboard-settings.html">{ic("gear")}Settings &amp; team</a>
<div style="flex:1"></div><a class="nav" href="#">{ic("doc")}Documentation</a>
<div class="row" style="padding:10px;border-top:1px solid hsl(var(--border));margin-top:8px"><div class="av" style="background:hsl(var(--muted));color:hsl(var(--foreground))">AK</div><div style="font-size:13px"><div style="font-weight:500">Alex Kim</div><div class="muted" style="font-size:12px">Owner</div></div></div></aside>'''
    mlinks=[("Overview","dashboard-overview"),("Invoices","dashboard-invoices"),("Links","dashboard-payment-links"),("API keys","dashboard-api-keys"),("Webhooks","dashboard-webhooks"),("Settings","dashboard-settings")]
    mtop = f'<div class="mtop"><div class="row"><span class="btn btn-ghost btn-sm" aria-label="Open menu" style="padding:0 6px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></span><span class="brand" style="padding:0">Airex<span>pay</span></span></div><div class="row"><span class="muted" style="font-size:12.5px">Northwind Studio</span>{LIVEP}<div class="av">N</div></div></div>'
    mnav = '<nav class="mnav" aria-label="Sections">' + "".join(f'<a class="{"on" if f==active or (active.startswith(f)) else ""}" href="{f}.html">{n}</a>' for n,f in mlinks) + '</nav>'
    return ("" if mode=="production" else SIM) + mtop + mnav + f'<div class="app">{side}<main class="main">{content}</main></div>' + overlay

INVOICES = [  # (id, customer, amount, asset, network, status, created)
 ("INV-1048","Example customer A","1,250.00","USDC","Ethereum","paid","Nov 3, 14:02"),
 ("INV-1047","Example customer B","89.90","USDT","Tron","confirming","Nov 3, 13:48"),
 ("INV-1046","Example customer C","420.00","USDT","Tron","waiting","Nov 3, 13:15"),
 ("INV-1045","Example customer D","300.00","USDT","Tron","underpaid","Nov 3, 11:40"),
 ("INV-1044","Example customer E","0.0150","BTC","Bitcoin","paid","Nov 2, 19:22"),
 ("INV-1043","Example customer F","75.00","USDC","Polygon","expired","Nov 2, 16:05"),
 ("INV-1042","Example customer G","2,000.00","USDT","Ethereum","failed","Nov 2, 10:31"),
 ("INV-1041","Example customer H","149.00","USDC","Base","refunded","Nov 1, 18:12"),
 ("INV-1040","Example customer I","64.50","USDT","Tron","paid","Nov 1, 09:57"),
]
def inv_rows(rows, compact=False, override=None):
    out=""
    for i,c,a,asset,net,s,t in rows:
        b = (override or {}).get(i) or badge(s)
        out+=f'<tr><td><div style="font-weight:500" class="num">{i}</div><div class="muted" style="font-size:12.5px">{c}</div></td><td>{b}</td><td class="r num" style="font-weight:500">{a} <span class="muted">{asset}</span></td>'
        if not compact: out+=f'<td class="muted hm">{net}</td>'
        out+=f'<td class="muted num hm">{t}</td></tr>'
    return out

def overview():
    bars = [4,6,5,8,7,9,6,10,8,11,9,12,10,13]
    svg = "".join(f'<rect x="{i*40+8}" y="{150-b*10}" width="24" height="{b*10}" rx="3" fill="hsl(var(--primary))" opacity="{0.35 if i<13 else 1}"/>' for i,b in enumerate(bars))
    kpis = [("Paid invoices","38","Last 14 days"),("Paid invoice volume (USD equivalent, not a balance)","12,480.40 USD","Sum of paid invoices, valued at time of payment"),("Awaiting payment","5","Open invoices"),("Webhook success rate","99.2%","Last 7 days, 2xx responses")]
    k = "".join(f'<div class="card kpi"><div class="row between"><span class="muted" style="font-weight:500;padding-right:8px">{a}</span><span class="example" style="flex:none">Example</span></div><div class="v num">{b}</div><div class="muted" style="font-size:12.5px;margin-top:2px">{c}</div></div>' for a,b,c in kpis)
    steps = [("Add a settlement wallet address","Payments go straight to wallets you control.",True),("Create your first invoice","Try it in simulation mode.",True),("Create an API key","Use a test key while in simulation.",False),("Add a webhook endpoint","Receive signed payment events.",False),("Request go-live review","We review your account before live payments.",False)]
    st = "".join(f'<li class="row" style="padding:10px 0;border-bottom:1px solid hsl(var(--border));align-items:flex-start"><span style="width:20px;height:20px;border-radius:50%;flex:none;display:grid;place-items:center;{"background:hsl(var(--status-paid));color:hsl(var(--status-paid-fg))" if d else "border:1.5px solid hsl(var(--input))"}">{ic("check",12) if d else ""}</span><div><div style="font-weight:500;{"text-decoration:line-through;color:hsl(var(--muted-foreground))" if d else ""}">{a}</div><div class="muted" style="font-size:12.5px">{b}</div></div></li>' for a,b,d in steps)
    c = f'''<div class="ph"><div><h1>Overview</h1><p>Good afternoon, Alex. Here is what is happening with your payments.</p></div>
<div class="row"><span class="chip hm">{ic("clock",14)} Last 14 days</span><a class="btn btn-outline hm" href="#">{ic("link")}New payment link</a><a class="btn btn-primary" href="#">{ic("plus")}New invoice</a></div></div>
<div class="grid g4" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">{k}</div>
<div class="grid g2" style="grid-template-columns:1.6fr 1fr;margin-bottom:16px">
<div class="card" style="padding:18px 20px"><div class="row between"><div><h3>Paid invoices per day</h3><div class="muted" style="font-size:12.5px">Count of invoices reaching Paid</div></div><span class="example">Example data</span></div>
<svg viewBox="0 0 560 170" width="100%" height="190" role="img" aria-label="Bar chart of example paid invoices per day" style="margin-top:12px"><line x1="0" y1="150.5" x2="560" y2="150.5" stroke="hsl(var(--border))"/>{svg}</svg>
<div class="row between muted num" style="font-size:12px"><span>Oct 21</span><span>Oct 28</span><span>Nov 3</span></div></div>
<div class="card" style="padding:18px 20px"><div class="row between"><h3>Get ready to go live</h3><span class="muted num" style="font-size:12.5px">2 of 5</span></div><ul style="list-style:none;padding:0;margin:8px 0 0">{st}</ul></div></div>
<div class="card"><div class="sec row between"><h3>Recent invoices</h3><div class="row"><span class="example">Example data</span><a class="btn btn-ghost btn-sm" href="dashboard-invoices.html">View all</a></div></div>
<table><thead><tr><th>Invoice</th><th>Status</th><th class="r">Amount</th><th class="hm">Network</th><th class="hm">Created</th></tr></thead><tbody>{inv_rows(INVOICES[:5])}</tbody></table></div>'''
    return shell("dashboard-overview", c)

def invoices_content(override=None):
    tabs = "".join(f'<span class="tab {"on" if i==0 else ""}">{t} <span class="muted num">{n}</span></span>' for i,(t,n) in enumerate([("All","9"),("Open","2"),("Paid","3"),("Needs attention","2"),("Expired","1")]))
    return f'''<div class="ph"><div><h1>Invoices</h1><p>Create invoices and follow each payment from creation to confirmation.</p></div>
<div class="row"><a class="btn btn-outline hm" href="#">{ic("dl")}Export CSV</a><a class="btn btn-primary" href="#">{ic("plus")}New invoice</a></div></div>
<div class="tabs">{tabs}</div>
<div class="toolbar"><div class="input" style="width:340px;white-space:nowrap">{ic("search",15,'style="color:hsl(var(--muted-foreground))"')}<span class="muted">Search by invoice, customer or tx hash</span></div>
<span class="chip">{ic("plus",13)} Status</span><span class="chip">{ic("plus",13)} Asset</span><span class="chip hm">{ic("plus",13)} Network</span><span class="chip hm">{ic("clock",13)} Last 30 days</span><div style="flex:1"></div><span class="example">Example data</span></div>
<div class="card"><table><thead><tr><th>Invoice</th><th>Status</th><th class="r">Amount</th><th class="hm">Network</th><th class="hm">Created</th></tr></thead><tbody>{inv_rows(INVOICES, override=override)}</tbody></table>
<div class="row between" style="padding:10px 16px;border-top:1px solid hsl(var(--border))"><span class="muted num" style="font-size:13px">Showing 1–9 of 9</span><div class="row"><span class="btn btn-outline btn-sm" style="opacity:.5">Previous</span><span class="btn btn-outline btn-sm" style="opacity:.5">Next</span></div></div></div>'''

def drawer():
    tl = [("ok","Invoice created","Nov 3, 11:40:02"),("info","Payment detected · 250.00 USDT","Nov 3, 11:52:17"),("info","Confirmed on-chain (19/19)","Nov 3, 11:53:05"),("warn","Marked underpaid · 50.00 USDT outstanding","Nov 3, 11:53:06"),("","Webhook invoice.underpaid → 200 OK","Nov 3, 11:53:07")]
    tlh = "".join(f'<li><span class="dot {"ok" if k=="ok" else "info" if k=="info" else ""}" style="{"background:hsl(var(--status-underpaid-fg))" if k=="warn" else ""}"></span><span>{a}</span><span class="muted num" style="font-size:12.5px">{b}</span></li>' for k,a,b in tl)
    GUIDANCE = '<div class="callout" style="margin-top:12px;font-size:13px">The customer can contact you to arrange the remaining amount. This invoice stays Underpaid.</div>'
    OUTST = '<div class="callout" style="background:hsl(var(--status-underpaid));border-color:hsl(var(--status-underpaid-border));color:hsl(var(--status-underpaid-fg))"><div style="font-size:12px">Outstanding</div>'
    badge_s = badge("underpaid")
    s = f'''<div class="overlay"></div><aside class="sheet" role="dialog" aria-label="Invoice INV-1045">
<div class="sec row between" style="padding:16px 20px"><div class="row"><span style="font-weight:600;font-size:16px" class="num">INV-1045</span>{badge_s}</div><div class="row"><span class="example">Example data</span><span class="btn btn-ghost btn-sm" aria-label="Close">{ic("x")}</span></div></div>
<div style="overflow:auto;flex:1">
<div class="sec"><div class="muted" style="font-size:12.5px">Amount due</div><div class="num" style="font-size:28px;font-weight:600;letter-spacing:-.02em">300.00 <span class="muted" style="font-size:18px;font-weight:500">USDT</span></div>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><div class="callout"><div class="muted" style="font-size:12px">Received</div><div class="num" style="font-weight:600">250.00 USDT</div></div>{OUTST}<div class="num" style="font-weight:600">50.00 USDT</div></div></div>
{GUIDANCE}</div>
<div class="sec"><h3 style="margin-bottom:12px">Details</h3><dl class="kv" style="margin:0">
<dt>Customer</dt><dd>Example customer D · d@example.com</dd><dt>Asset / network</dt><dd>USDT · Tron (TRC-20)</dd>
<dt>Pay-to address</dt><dd class="mono" style="word-break:break-all">{ADDR}</dd><dt>Transaction</dt>{txh(TX_1045)}
<dt>Created</dt><dd class="num">Nov 3, 2026, 11:40 (UTC+6)</dd><dt>Expires</dt><dd class="num">Nov 3, 2026, 12:10 (UTC+6)</dd><dt>Reference</dt><dd class="mono">order_8812</dd><dt>Hosted page</dt><dd class="row" style="color:hsl(var(--primary));font-weight:500">pay.airexpay.com/i/ex-1045 {ic("copy",13)}</dd></dl></div>
<div class="sec" style="border:0"><h3 style="margin-bottom:6px">Timeline</h3><ul class="timeline">{tlh}</ul></div></div></aside>'''
    return shell("dashboard-invoices", invoices_content(), s)

def links(dialog=False):
    L=[("Design consultation","150.00 USD","USDC, USDT","Active","23"),("Monthly retainer — example","1,200.00 USD","USDC","Active","4"),("Workshop seat","Customer chooses","USDC, USDT, BTC","Active","11"),("Spring promo (ended)","49.00 USD","USDT","Archived","62")]
    rows="".join(f'<tr><td><div style="font-weight:500">{a}</div><div class="muted mono" style="font-size:12px">pay.airexpay.com/l/ex-{i+1:03d}</div></td><td class="r num" style="font-weight:500">{b}</td><td class="muted">{c}</td><td><span class="badge {"s-paid" if d=="Active" else "neutral"}">{d}</span></td><td class="r num">{e}</td><td class="r"><span class="btn btn-outline btn-sm">{ic("copy",13)}Copy link</span></td></tr>' for i,(a,b,c,d,e) in enumerate(L))
    dlg=f'''<div class="overlay"></div><div class="dialog" role="dialog" aria-label="New payment link"><div class="row between"><h3 style="font-size:17px;margin:0">New payment link</h3>{ic("x")}</div><p class="muted" style="margin:4px 0 18px">A reusable link that creates a fresh invoice for each customer.</p>
<label class="label">Name</label><div class="input" style="margin-bottom:14px">Design consultation</div>
<div class="grid" style="grid-template-columns:1fr 120px;gap:10px;margin-bottom:14px"><div><label class="label">Price</label><div class="input num">150.00</div></div><div><label class="label">Currency</label><div class="input">USD ▾</div></div></div>
<label class="label">Accepted assets</label><div class="row" style="margin-bottom:14px;flex-wrap:wrap"><span class="badge plain s-confirming">USDC · Base ✕</span><span class="badge plain s-confirming">USDT · Tron ✕</span><span class="chip" style="height:22px">+ Add</span></div>
<div class="callout" style="margin-bottom:18px">Network fees are paid by the customer’s wallet. AirExpay fees will be published on the <a href="pricing.html" style="text-decoration:underline">pricing page</a> (pricing coming soon).</div>
<div class="row" style="justify-content:flex-end"><span class="btn btn-outline">Cancel</span><span class="btn btn-primary">Create link</span></div></div>'''
    c=f'''<div class="ph"><div><h1>Payment links</h1><p>Shareable links for fixed or customer-chosen amounts.</p></div><a class="btn btn-primary" href="#">{ic("plus")}New payment link</a></div>
<div class="card"><div class="sec row between"><span class="muted">4 links</span><span class="example">Example data</span></div><table><thead><tr><th>Link</th><th class="r">Price</th><th>Accepted</th><th>Status</th><th class="r">Paid invoices</th><th></th></tr></thead><tbody>{rows}</tbody></table></div>'''
    return shell("dashboard-payment-links", c, dlg if dialog else "")

def keys(state="pending", mode="staging"):
    K=[("Server key — staging","sk_test_ex…4f2a","Full access","Nov 1, 2026","2 min ago"),("Read-only reporting","rk_test_ex…91bc","Read only","Oct 22, 2026","Yesterday"),("Old integration","sk_test_ex…77d0","Full access","Sep 30, 2026","Never")]
    rows="".join(f'<tr><td style="font-weight:500">{a}<div class="mono muted" style="font-size:12px">{b}</div></td><td class="hm"><span class="badge plain neutral">{c}</span></td><td class="muted num hm">{d}</td><td class="muted hm">{e}</td><td class="r"><span class="btn btn-ghost btn-sm" style="color:hsl(var(--destructive))">Revoke</span></td></tr>' for a,b,c,d,e in K)
    steps = lambda done: "".join(f'<li class="row" style="gap:8px;padding:3px 0;font-size:13px"><span style="width:16px;height:16px;border-radius:50%;flex:none;display:grid;place-items:center;{"background:hsl(var(--status-paid));color:hsl(var(--status-paid-fg))" if d else "border:1.5px solid hsl(var(--input))"}">{ic("check",10) if d else ""}</span>{t}</li>' for t,d in zip(["Business details","Settlement addresses verified","Integration tested in simulation","AirExpay review"],done))
    if state=="pending":
        gl=f'''<div class="row between" style="align-items:flex-start;gap:16px;flex-wrap:wrap"><div style="max-width:560px"><div class="row" style="margin-bottom:6px"><h3>Go-live review</h3>{badge("confirming","Review pending")}</div><p class="muted" style="margin:0;font-size:13.5px">Submitted Oct 30, 2026. Our team is reviewing your account; we’ll email the account owner with the outcome. Live keys cannot be created from the dashboard — they are issued by AirExpay after approval.</p></div><ul style="list-style:none;margin:0;padding:0">{steps([1,1,1,0])}</ul></div>'''
        live=f'<div style="padding:28px;text-align:center" class="muted">{ic("lock",20)}<div style="font-weight:600;color:hsl(var(--foreground));margin-top:6px">Live keys are locked</div><div style="font-size:13px">Available after your go-live review is approved.</div></div>'
    elif state=="approved":
        gl=f'''<div class="row between" style="align-items:flex-start;gap:16px;flex-wrap:wrap"><div style="max-width:560px"><div class="row" style="margin-bottom:6px"><h3>Go-live review</h3>{badge("paid","Approved")}</div><p class="muted" style="margin:0;font-size:13.5px">Approved Nov 2, 2026. Your live key was issued by AirExpay and sent to the account owner. Additional live keys are requested from AirExpay — they are not self-serve.</p></div><ul style="list-style:none;margin:0;padding:0">{steps([1,1,1,1])}</ul></div>'''
        live=f'<table><thead><tr><th>Name</th><th class="hm">Issued</th><th class="hm">Last used</th><th></th></tr></thead><tbody><tr><td style="font-weight:500">Live server key<div class="mono muted" style="font-size:12px">sk_live_ex…a7c1</div></td><td class="muted num hm">Nov 2, 2026 by AirExpay</td><td class="muted hm">Never</td><td class="r"><span class="btn btn-outline btn-sm">Request another key</span></td></tr></tbody></table>'
    else:
        gl=f'''<div class="row between" style="align-items:flex-start;gap:16px;flex-wrap:wrap"><div style="max-width:560px"><div class="row" style="margin-bottom:6px"><h3>Go-live review</h3>{badge("failed","Rejected")}</div><p class="muted" style="margin:0 0 8px;font-size:13.5px">Reviewed Nov 1, 2026. We couldn’t approve live access yet:</p><ul style="margin:0 0 10px;padding-left:18px;font-size:13.5px"><li>Settlement address ownership could not be verified (example reason).</li><li>Business website is unreachable (example reason).</li></ul><span class="btn btn-primary btn-sm">Fix and resubmit</span></div><ul style="list-style:none;margin:0;padding:0">{steps([1,0,1,0])}</ul></div>'''
        live=f'<div style="padding:28px;text-align:center" class="muted">{ic("lock",20)}<div style="font-weight:600;color:hsl(var(--foreground));margin-top:6px">Live keys are locked</div><div style="font-size:13px">Resolve the review items above and resubmit.</div></div>'
    lab={"pending":badge("confirming","Pending"),"approved":badge("paid","Approved"),"rejected":badge("failed","Rejected")}[state]
    c=f'''<div class="ph"><div><h1>API keys</h1><p>Authenticate server-to-server requests to the AirExpay REST API.</p></div><div class="row"><a class="btn btn-outline hm" href="#">{ic("doc")}API reference</a><a class="btn btn-primary" href="#">{ic("plus")}Create test key</a></div></div>
<div class="card" style="padding:18px 20px;margin-bottom:16px">{gl}</div>
<div class="card" style="margin-bottom:16px"><div class="sec row between"><div class="row"><h3>Live keys</h3>{lab}</div><span class="muted hm" style="font-size:12.5px">{ic("lock",12)} Issued by AirExpay only</span></div>{live}</div>
<div class="card"><div class="sec row between"><div class="row"><h3>Test keys</h3><span class="muted" style="font-size:12.5px">Simulation only</span></div><span class="example">Example data</span></div><table><thead><tr><th>Name / key</th><th class="hm">Permissions</th><th class="hm">Created</th><th class="hm">Last used</th><th></th></tr></thead><tbody>{rows}</tbody></table></div>
<p class="muted" style="font-size:13px;margin-top:14px">Keys are shown masked. Keep secret keys on your server; never embed them in a browser or mobile app.</p>'''
    return shell("dashboard-api-keys", c, mode=mode)

def webhooks():
    D=[("invoice.paid","INV-1048","200","142 ms","Nov 3, 14:02:11","s-paid","Delivered"),("invoice.confirming","INV-1047","200","98 ms","Nov 3, 13:49:30","s-paid","Delivered"),("invoice.underpaid","INV-1045","200","120 ms","Nov 3, 11:53:07","s-paid","Delivered"),("invoice.failed","INV-1042","500","2,004 ms","Nov 2, 10:33:40","s-failed","Failed · retry 3 of 8"),("invoice.expired","INV-1043","—","Timeout","Nov 2, 16:35:12","s-underpaid","Retrying in 4 min"),("invoice.paid","INV-1044","200","131 ms","Nov 2, 19:24:02","s-paid","Delivered")]
    rows="".join(f'<tr><td class="mono">{a}</td><td class="num">{b}</td><td><span class="badge {cl}">{st}</span></td><td class="mono">{c}</td><td class="r num muted">{d}</td><td class="muted num">{e}</td><td class="r"><span class="btn btn-ghost btn-sm">Resend</span></td></tr>' for a,b,c,d,e,cl,st in D)
    c=f'''<div class="ph"><div><h1>Webhooks</h1><p>Signed HTTPS callbacks for invoice and payment events.</p></div><div class="row"><a class="btn btn-outline" href="#">Send test event</a><a class="btn btn-primary" href="#">{ic("plus")}Add endpoint</a></div></div>
<div class="grid g2" style="grid-template-columns:repeat(2,1fr);margin-bottom:18px">
<div class="card" style="padding:16px 18px"><div class="row between"><div class="mono" style="font-size:13.5px;font-weight:500;word-break:break-all">https://example.com/webhooks/airexpay</div><span class="badge s-paid">Enabled</span></div><div class="muted" style="font-size:13px;margin-top:6px">invoice.* · 5 events · API version 2026-10-01</div><div class="row between" style="margin-top:12px;font-size:13px"><span class="muted">Signing secret <span class="mono">whsec_ex••••••••</span></span><a style="color:hsl(var(--primary));font-weight:500" href="#">Reveal</a></div></div>
<div class="card" style="padding:16px 18px"><div class="row between"><div class="mono" style="font-size:13.5px;font-weight:500;word-break:break-all">https://staging.example.com/hooks</div><span class="badge s-expired">Disabled</span></div><div class="muted" style="font-size:13px;margin-top:6px">invoice.paid · 1 event · API version 2026-10-01</div><div class="row between" style="margin-top:12px;font-size:13px"><span class="muted">Disabled by a team member on Oct 30</span><a style="color:hsl(var(--primary));font-weight:500" href="#">Enable</a></div></div></div>
<div class="card"><div class="sec row between"><div><h3>Delivery log</h3><div class="muted" style="font-size:12.5px">Failed deliveries retry with exponential backoff, up to 8 attempts.</div></div><div class="row"><span class="chip">{ic("plus",13)} Event</span><span class="chip">{ic("plus",13)} Result</span><span class="example">Example data</span></div></div>
<table><thead><tr><th>Event</th><th>Invoice</th><th>Result</th><th>HTTP</th><th class="r">Duration</th><th>Sent</th><th></th></tr></thead><tbody>{rows}</tbody></table></div>'''
    return shell("dashboard-webhooks", c)

def settings():
    T=[("Alex Kim","alex@example.com","Owner","Active"),("Sam Rivera","sam@example.com","Admin","Active"),("Jordan Lee","jordan@example.com","Developer","Active"),("priya@example.com","—","Viewer","Invited")]
    rows="".join(f'<tr><td><div class="row"><div class="av" style="background:hsl(var(--muted));color:hsl(var(--foreground))">{a[0].upper()}</div><div><div style="font-weight:500">{a}</div><div class="muted" style="font-size:12.5px">{b}</div></div></div></td><td><div class="input" style="height:30px;width:130px;justify-content:space-between">{c}<span class="muted">▾</span></div></td><td class="hm"><span class="badge {"s-paid" if d=="Active" else "s-waiting"}">{d}</span></td><td class="r"><span class="btn btn-ghost btn-sm">{ic("dots")}</span></td></tr>' for a,b,c,d in T)
    c=f'''<div class="ph"><div><h1>Settings &amp; team</h1><p>Business profile, settlement addresses and who can access this account.</p></div></div>
<div class="tabs"><span class="tab">Business</span><span class="tab">Settlement addresses</span><span class="tab on">Team</span><span class="tab">Security</span><span class="tab">Notifications</span></div>
<div class="grid g2" style="grid-template-columns:1fr 320px;align-items:start">
<div class="card"><div class="sec row between"><div><h3>Members</h3><div class="muted" style="font-size:12.5px">4 of 10 seats used</div></div><div class="row"><span class="example">Example data</span><span class="btn btn-primary btn-sm">{ic("plus",13)}Invite member</span></div></div>
<table><thead><tr><th>Member</th><th>Role</th><th class="hm">Status</th><th></th></tr></thead><tbody>{rows}</tbody></table></div>
<div class="grid"><div class="card" style="padding:16px 18px"><h3>Roles</h3><dl class="kv" style="grid-template-columns:90px 1fr;margin:10px 0 0;font-size:13px"><dt>Owner</dt><dd>Everything, incl. billing and deleting the account</dd><dt>Admin</dt><dd>Manage team, settings, addresses</dd><dt>Developer</dt><dd>API keys, webhooks, logs</dd><dt>Viewer</dt><dd>Read-only access</dd></dl></div>
<div class="card" style="padding:16px 18px"><div class="row between"><h3>Require 2FA</h3><span class="switch" role="switch" aria-checked="true" aria-label="Require 2FA"></span></div><p class="muted" style="font-size:13px;margin:6px 0 0">Members must set up two-factor authentication before they can sign in.</p></div>
<div class="card" style="padding:16px 18px"><div class="row between"><h3>Changes to settlement addresses</h3><span class="switch" role="switch" aria-checked="true" aria-label="Approval required"></span></div><p class="muted" style="font-size:13px;margin:6px 0 0">Require a second Owner or Admin to approve address changes.</p></div></div></div>'''
    return shell("dashboard-settings", c)

# ---------- checkout ----------
CK_CSS = """
body{background:hsl(var(--muted))}
.ck{max-width:420px;margin:0 auto;padding:16px 16px 28px}
.ckhead{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 14px}
.merchant{display:flex;align-items:center;gap:10px;font-weight:600}
.panel{background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:var(--radius-xl);box-shadow:var(--shadow-sm);overflow:hidden}
.pad{padding:20px}.hr{border-top:1px solid hsl(var(--border))}
.amt{font-size:32px;font-weight:600;letter-spacing:-.02em}
.qr{width:184px;height:184px;padding:12px;background:#fff;border:1px solid hsl(var(--border));border-radius:12px;margin:0 auto;display:block}
.addr{display:flex;align-items:center;gap:8px;border:1px solid hsl(var(--input));border-radius:var(--radius);padding:10px 10px 10px 12px;background:hsl(var(--background))}
.addr .mono{flex:1;word-break:break-all;font-size:12px;line-height:1.4}
.icon-hero{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;margin:4px auto 12px}
.foot{text-align:center;font-size:12px;color:hsl(var(--muted-foreground));margin-top:14px;display:flex;justify-content:center;gap:6px;align-items:center}
.exnote{font-size:12px;text-align:center;margin-bottom:10px}
.progress{height:6px;background:hsl(var(--muted));border-radius:99px;overflow:hidden}.progress>i{display:block;height:100%;background:hsl(var(--status-confirming-fg));border-radius:99px}
.stepper{display:flex;gap:6px;font-size:12px}.stepper span{flex:1;padding-top:6px;border-top:3px solid hsl(var(--border));color:hsl(var(--muted-foreground))}.stepper span.on{border-color:hsl(var(--primary));color:hsl(var(--foreground));font-weight:500}
.summary{display:none}
@media (min-width:900px){
 body{background:hsl(var(--background))}
 .wrap{display:grid;grid-template-columns:1fr 1fr;min-height:100vh}
 .summary{display:block;background:hsl(var(--muted));padding:72px 64px 40px;border-right:1px solid hsl(var(--border))}
 .summary>div{max-width:440px;margin-left:auto}
 .ck{padding:72px 64px;margin:0;max-width:none}.ck>*{max-width:440px}
 .ck .ckhead{display:none}
}
"""
def ck(state, dark=False):
    head = '<div class="ckhead"><div class="merchant"><div class="av" style="width:30px;height:30px;font-size:13px;border-radius:7px">N</div>Northwind Studio</div><span class="muted num" style="font-size:12.5px">INV-1046</span></div>'
    amount = '<div class="muted" style="font-size:13px">Amount to send</div><div class="amt num">420.00 <span class="muted" style="font-size:20px;font-weight:500">USDT</span></div><div class="muted num" style="font-size:13px">≈ 420.00 USD · Network: Tron (TRC-20)</div>'
    stepper = lambda n: '<div class="stepper" aria-label="Progress">' + "".join(f'<span class="{"on" if i<=n else ""}">{t}</span>' for i,t in enumerate(["Send payment","Confirming","Done"])) + '</div>'
    if state=="waiting":
        body=f'''<div class="pad"><div class="row between" style="margin-bottom:14px">{badge("waiting")}<span class="row num" style="font-weight:600;font-size:14px" aria-label="Time left 14 minutes 32 seconds">{ic("clock",15)} 14:32</span></div>{amount}
<div class="callout" style="margin-top:12px;font-size:12.5px">Send <b>exactly 420.00 USDT on Tron</b>. Network fees are paid by your wallet and are not included in this amount.</div></div>
<div class="hr pad" style="padding-top:18px"><img class="qr" src="../assets/qr-example.png" alt="QR code containing the example payment address">
<label class="label" style="margin-top:16px">Payment address (Tron · TRC-20)</label><div class="addr"><span class="mono">{ADDR}</span><span class="btn btn-outline btn-sm">{ic("copy",13)}Copy</span></div>
<div class="row" style="margin-top:8px;gap:8px"><span class="btn btn-outline btn-sm" style="flex:1">{ic("copy",13)}Copy amount</span><span class="btn btn-outline btn-sm" style="flex:1">Open in wallet</span></div></div>
<div class="hr pad" style="padding:14px 20px">{stepper(0)}</div>'''
    elif state=="confirming":
        body=f'''<div class="pad" style="text-align:center"><div class="icon-hero" style="background:hsl(var(--status-confirming));color:hsl(var(--status-confirming-fg))">{ic("clock",24)}</div>{badge("confirming","Confirming on Tron")}
<h2 style="font-size:20px;margin:12px 0 4px">Payment detected</h2><p class="muted" style="margin:0">We found your transaction and are waiting for network confirmations. You can keep this page open or close it — the merchant will be notified.</p></div>
<div class="hr pad"><div class="row between" style="font-size:13px;margin-bottom:8px"><span style="font-weight:500">Network confirmations</span><span class="num">7 of 12</span></div><div class="progress" role="progressbar" aria-valuenow="7" aria-valuemax="12" aria-label="Confirmations"><i style="width:58%"></i></div>
<dl class="kv" style="margin:16px 0 0;grid-template-columns:110px 1fr"><dt>Received</dt><dd class="num" style="font-weight:500">420.00 USDT</dd><dt>Transaction</dt>{txh(TX_1046)}<dt>Typical time</dt><dd>A few minutes; varies with network load</dd></dl></div>
<div class="hr pad" style="padding:14px 20px">{stepper(1)}</div>'''
    elif state=="paid":
        body=f'''<div class="pad" style="text-align:center"><div class="icon-hero" style="background:hsl(var(--status-paid));color:hsl(var(--status-paid-fg))">{ic("check",26)}</div>{badge("paid")}
<h2 style="font-size:20px;margin:12px 0 4px">Payment complete</h2><p class="muted" style="margin:0">Thank you. Northwind Studio has been notified and will follow up by email.</p></div>
<div class="hr pad"><dl class="kv" style="margin:0;grid-template-columns:110px 1fr"><dt>Amount paid</dt><dd class="num" style="font-weight:600">420.00 USDT</dd><dt>Network</dt><dd>Tron</dd><dt>Invoice</dt><dd class="num">INV-1046</dd><dt>Paid at</dt><dd class="num">Nov 3, 2026, 13:21 (UTC+6)</dd><dt>Transaction</dt>{txh(TX_1046)}</dl>
<div style="margin-top:16px;display:grid;gap:8px"><span class="btn btn-primary btn-lg">Return to merchant</span><span class="btn btn-outline">{ic("dl",14)}Download receipt</span></div></div>
<div class="hr pad" style="padding:14px 20px">{stepper(2)}</div>'''
    elif state=="underpaid":
        body=f'''<div class="pad"><div class="row between" style="margin-bottom:14px">{badge("underpaid","Partially paid")}<span class="row num" style="font-weight:600;font-size:14px">{ic("clock",15)} 09:48</span></div>
<h2 style="font-size:20px;margin:0 0 4px">We received less than the invoice amount</h2><p class="muted" style="margin:0">Send the remaining amount to the same address to complete this payment.</p>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:14px"><div class="callout"><div class="muted" style="font-size:12px">Invoice</div><div class="num" style="font-weight:600">420.00 USDT</div></div><div class="callout"><div class="muted" style="font-size:12px">Received</div><div class="num" style="font-weight:600">380.00 USDT</div></div></div>
<div class="callout" style="margin-top:8px;background:hsl(var(--status-underpaid));border-color:hsl(var(--status-underpaid-border));color:hsl(var(--status-underpaid-fg))"><div class="row between"><span style="font-weight:500">Remaining to send</span><span class="num" style="font-weight:700;font-size:18px">40.00 USDT</span></div></div></div>
<div class="hr pad"><label class="label">Same payment address (Tron · TRC-20)</label><div class="addr"><span class="mono">{ADDR}</span><span class="btn btn-outline btn-sm">{ic("copy",13)}Copy</span></div>
<div class="row" style="margin-top:10px"><span class="btn btn-primary" style="flex:1">Show QR for 40.00 USDT</span></div>
<p class="muted" style="font-size:12.5px;margin:12px 0 0">Can’t send more? <a href="#" style="text-decoration:underline;color:hsl(var(--foreground))">Contact Northwind Studio</a> about a refund or adjustment. AirExpay does not hold funds and cannot refund on the merchant’s behalf.</p></div>'''
    elif state=="expired":
        body=f'''<div class="pad" style="text-align:center"><div class="icon-hero" style="background:hsl(var(--status-expired));color:hsl(var(--status-expired-fg))">{ic("clock",24)}</div>{badge("expired")}
<h2 style="font-size:20px;margin:12px 0 4px">This payment window has closed</h2><p class="muted" style="margin:0">The quote for this invoice expired at 13:45 (UTC+6). <b style="color:hsl(var(--foreground))">Do not send funds to the previous address.</b></p></div>
<div class="hr pad"><div class="callout" style="margin-bottom:14px">Already sent a payment in the last few minutes? It may still be detected. Check again or contact the merchant with your transaction hash.</div>
<span class="btn btn-primary btn-block btn-lg">Start a new payment</span><span class="btn btn-ghost btn-block" style="margin-top:6px">I already paid — check again</span></div>'''
    elif state=="failed":
        body=f'''<div class="pad" style="text-align:center"><div class="icon-hero" style="background:hsl(var(--status-failed));color:hsl(var(--status-failed-fg))">{ic("alert",24)}</div>{badge("failed")}
<h2 style="font-size:20px;margin:12px 0 4px">We couldn’t complete this payment</h2><p class="muted" style="margin:0">The transaction was sent on a network this invoice does not accept, so it can’t be matched automatically.</p></div>
<div class="hr pad"><dl class="kv" style="margin:0 0 14px;grid-template-columns:110px 1fr"><dt>Expected</dt><dd>420.00 USDT on Tron</dd><dt>Detected</dt><dd>USDT on Ethereum</dd><dt>Transaction</dt>{txh(TX_ETH)}<dt>Reference</dt><dd class="mono">ERR-NETWORK-MISMATCH</dd></dl>
<span class="btn btn-primary btn-block btn-lg">Contact Northwind Studio</span><span class="btn btn-outline btn-block" style="margin-top:8px">{ic("copy",14)}Copy support details</span>
<p class="muted" style="font-size:12.5px;margin:12px 0 0">Funds sent go directly to the merchant’s wallet; only the merchant can help resolve it.</p></div>'''
    summary = '''<aside class="summary"><div><div class="merchant" style="margin-bottom:40px"><div class="av" style="width:30px;height:30px;font-size:13px;border-radius:7px">N</div>Northwind Studio</div>
<div class="muted">Invoice INV-1046</div><div class="num" style="font-size:40px;font-weight:600;letter-spacing:-.02em;margin:6px 0 28px">420.00 USD</div>
<div style="border-top:1px solid hsl(var(--border))"><div class="row between" style="padding:14px 0;border-bottom:1px solid hsl(var(--border))"><span>Brand identity package — example</span><span class="num">380.00</span></div><div class="row between" style="padding:14px 0;border-bottom:1px solid hsl(var(--border))"><span>Rush delivery — example</span><span class="num">40.00</span></div><div class="row between" style="padding:14px 0;font-weight:600"><span>Total</span><span class="num">420.00 USD</span></div></div>
<p class="muted" style="font-size:13px;margin-top:28px">Payments go directly to a wallet controlled by Northwind Studio. AirExpay provides the payment software and does not hold funds.</p></div></aside>'''
    b=f'''<div class="wrap">{summary}<main class="ck">{head}<div class="exnote"><span class="example">Example — do not send funds</span></div><div class="panel">{body}</div>
<div class="foot">{ic("lock",13)} Non-custodial checkout by <b style="color:hsl(var(--foreground))">AirExpay</b> · <a href="#" style="text-decoration:underline">Help</a></div></main></div>'''
    return page(f"Checkout — {state}", b, cls="dark" if dark else "", extra_css=CK_CSS)

# ---------- landing ----------
LP_CSS = """
body{background:hsl(var(--background));font-size:16px}
.w{max-width:1120px;margin:0 auto;padding:0 32px}
header{border-bottom:1px solid hsl(var(--border));background:hsl(var(--card)/.8)}
header .w{display:flex;align-items:center;justify-content:space-between;height:68px}
.links{display:flex;gap:28px;color:hsl(var(--muted-foreground));font-weight:500;font-size:14.5px}
.hero{padding-top:96px;padding-bottom:88px;display:grid;grid-template-columns:1.05fr 1fr;gap:56px;align-items:center}
h1{font-family:var(--font-serif);font-weight:500;font-size:56px;line-height:1.06;letter-spacing:-.025em;margin:18px 0 20px}
.lead{font-size:19px;line-height:1.6;color:hsl(var(--muted-foreground));margin:0 0 30px;max-width:540px}
.form{display:flex;gap:10px;max-width:500px}.form .input{height:46px;flex:1;font-size:15px}
.pill{display:inline-flex;gap:8px;align-items:center;font-size:13px;font-weight:500;border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:99px;padding:4px 12px 4px 6px}
.pill b{white-space:nowrap;background:hsl(var(--accent));color:hsl(var(--accent-foreground));border-radius:99px;padding:1px 8px;font-weight:600}
.preview{position:relative}
.pv{background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:var(--radius-xl);box-shadow:var(--shadow-lg);overflow:hidden}
section{padding:72px 0}.eyebrow{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:hsl(var(--primary))}
h2{font-family:var(--font-serif);font-weight:500;font-size:38px;letter-spacing:-.02em;line-height:1.15;margin:10px 0 14px}
.f3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:36px}
.f3 .card{padding:26px;box-shadow:none}.f3 h3{font-size:17px;margin:14px 0 8px}.f3 p{margin:0;color:hsl(var(--muted-foreground));font-size:15px;line-height:1.6}
.ico{width:38px;height:38px;border-radius:10px;background:hsl(var(--accent));color:hsl(var(--accent-foreground));display:grid;place-items:center}
.steps{counter-reset:s;display:grid;grid-template-columns:repeat(3,1fr);gap:32px;margin-top:36px}
.steps div{border-top:2px solid hsl(var(--foreground));padding-top:18px}.steps div::before{counter-increment:s;content:"0" counter(s);font-size:13px;font-weight:600;color:hsl(var(--muted-foreground))}
.steps h3{font-size:17px;margin:8px 0 6px}.steps p{margin:0;color:hsl(var(--muted-foreground));font-size:15px}
.dev{display:grid;grid-template-columns:1fr 1.1fr;gap:56px;align-items:center}
pre{margin:0;background:hsl(222 30% 10%);color:hsl(210 20% 90%);border-radius:var(--radius-xl);padding:24px;font:13px/1.7 var(--font-mono);overflow:hidden}
pre .c{color:hsl(215 12% 62%)}pre .k{color:hsl(212 75% 76%)}pre .s{color:hsl(150 40% 72%)}
.ul{list-style:none;padding:0;margin:20px 0 0}.ul li{display:flex;gap:10px;padding:8px 0;color:hsl(var(--foreground))}.ul svg{color:hsl(var(--primary));flex:none;margin-top:4px}
.cta{background:hsl(var(--primary));color:hsl(var(--primary-foreground));border-radius:var(--radius-xl);padding:56px;display:flex;justify-content:space-between;align-items:center;gap:40px}
.dark .cta{background:hsl(var(--card));color:hsl(var(--foreground));border:1px solid hsl(var(--border))}.dark .cta .btn{background:hsl(var(--primary)) !important;color:hsl(var(--primary-foreground)) !important}.dark pre{border:1px solid hsl(var(--border))}
.cta h2{margin:0 0 8px}.cta p{margin:0;opacity:.85}
footer{border-top:1px solid hsl(var(--border));padding:36px 0;font-size:14px;color:hsl(var(--muted-foreground))}
@media (max-width:760px){
 .w{padding:0 20px}.links,.hide-m{display:none}
 .hero{grid-template-columns:1fr;padding-top:48px;padding-bottom:32px;gap:36px}
 h1{font-size:38px}.lead{font-size:17px}.form{flex-direction:column}.form .btn{height:46px}
 section{padding:48px 0}h2{font-size:30px}.f3,.steps,.dev{grid-template-columns:1fr}.steps{gap:24px}
 .cta{flex-direction:column;align-items:flex-start;padding:32px}
 .dev>*{min-width:0}pre{font-size:11px;padding:40px 18px 18px;overflow-x:auto;white-space:pre}.form .input{flex:none;height:46px}h2 br{display:none}
}
"""
def landing(dark=False):
    rows = "".join(f'<div class="row between" style="padding:11px 18px;border-top:1px solid hsl(var(--border));font-size:13.5px"><div><div style="font-weight:500" class="num">{i}</div><div class="muted" style="font-size:12px">{a} {asset} · {net}</div></div>{badge(s, s.capitalize() if s!="waiting" else "Waiting")}</div>' for i,c,a,asset,net,s,t in INVOICES[:4])
    pv = f'''<div class="preview"><div class="pv"><div class="row between" style="padding:14px 18px"><span style="font-weight:600">Invoices</span><span class="example">Example</span></div>{rows}<div class="muted" style="padding:10px 18px;border-top:1px solid hsl(var(--border));font-size:12px">Example data only.</div></div>
<div class="pv hide-m" style="position:absolute;right:-24px;bottom:-72px;width:250px;padding:16px" aria-hidden="true"><div class="row between"><span class="muted" style="font-size:12px">INV-1046</span>{badge("waiting","Waiting")}</div><div class="num" style="font-size:22px;font-weight:600;margin:6px 0 10px">420.00 <span class="muted" style="font-size:14px">USDT</span></div><div class="addr" style="display:flex;gap:8px;align-items:center;border:1px solid hsl(var(--input));border-radius:8px;padding:6px 8px"><span class="mono" style="font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{ADDR}</span>{ic("copy",13)}</div></div></div>'''
    feats=[("lock","Non-custodial by design","Customer payments go to wallets you control, not to an AirExpay balance. We never hold your funds."),("inv","Invoices and payment links","Create an invoice or a shareable link, send it to a customer and follow its status from one dashboard."),("hook","Developer-friendly","A documented REST API and signed webhooks, with a sandbox for testing integrations before going live.")]
    f3="".join(f'<div class="card"><div class="ico">{ic(i,19)}</div><h3>{a}</h3><p>{b}</p></div>' for i,a,b in feats)
    b=f'''<header><div class="w"><div class="brand" style="padding:0">Airex<span>pay</span></div><nav class="links"><a href="#product">Product</a><a href="#how">How it works</a><a href="#dev">Developers</a><a href="pricing.html">Pricing</a></nav><div class="row"><span class="tag pill hide-m" style="padding:4px 12px">In development</span><a class="btn btn-primary" href="#join">Join the waitlist</a></div></div></header>
<main><div class="w hero"><div><span class="pill"><b>Early access</b>Onboarding a small group of merchants</span>
<h1>Accept digital-asset payments without handing over custody.</h1>
<p class="lead">AirExpay is non-custodial payment software for online businesses: invoices, payment links and hosted checkout, with funds settling to wallets you control.</p>
<form class="form" id="join" onsubmit="return false"><label for="em" class="sr" style="position:absolute;left:-9999px">Work email</label><input id="em" class="input" placeholder="you@company.com" aria-label="Work email"><button class="btn btn-primary btn-lg">Join the waitlist</button></form>
<p class="muted" style="font-size:13px;margin-top:12px">We’ll only email you about early access. No payments are processed on this site.</p></div>{pv}</div>
<section id="product" class="after-hero" style="border-top:1px solid hsl(var(--border));margin-top:40px"><div class="w"><div class="eyebrow">Product</div><h2>The payment tools you need, <br>none of the custody you don’t.</h2><div class="f3">{f3}</div></div></section>
<section id="how" style="background:hsl(var(--card));border-top:1px solid hsl(var(--border));border-bottom:1px solid hsl(var(--border))"><div class="w"><div class="eyebrow">How it works</div><h2>From invoice to confirmation</h2>
<div class="steps"><div><h3>Create an invoice or link</h3><p>Set the amount, accepted assets and networks. Share the hosted checkout link or embed it.</p></div><div><h3>Your customer pays</h3><p>Checkout shows the exact amount, a QR code and a time-limited quote. Funds go to your wallet.</p></div><div><h3>Track and reconcile</h3><p>Follow each payment through confirming to paid, and receive a signed webhook at every step.</p></div></div></div></section>
<section id="dev"><div class="w dev"><div><div class="eyebrow">Developers</div><h2>Built to integrate cleanly</h2><p class="muted" style="font-size:17px;margin:0">A REST API with idempotent requests, signed webhooks you can verify, and a sandbox that simulates every payment state.</p>
<ul class="ul"><li>{ic("check")}Every payment state, including underpaid and expired, testable in sandbox</li><li>{ic("check")}HMAC-signed webhooks with automatic retries</li><li>{ic("check")}Scoped API keys and team roles</li></ul></div>
<div style="position:relative"><span class="example" style="position:absolute;top:14px;right:14px;color:hsl(210 20% 85%);border-color:hsl(215 12% 50%)">Example</span><pre><span class="c"># Example request (sandbox)</span>
curl https://api.airexpay.com/v1/invoices \\
  -H <span class="s">"Authorization: Bearer sk_test_…"</span> \\
  -H <span class="s">"Idempotency-Key: order_8812"</span> \\
  -d amount=<span class="s">"420.00"</span> -d currency=<span class="s">"USD"</span> \\
  -d accept=<span class="s">"USDC:base,USDT:tron"</span>

<span class="c"># Response</span>
{{ <span class="k">"id"</span>: <span class="s">"inv_ex_1046"</span>, <span class="k">"status"</span>: <span class="s">"waiting"</span>,
  <span class="k">"hosted_url"</span>: <span class="s">"https://pay.airexpay.com/i/…"</span> }}</pre></div></div></section>
<section style="padding-top:0"><div class="w"><div class="cta"><div><h2 style="font-size:32px">Be one of our first merchants</h2><p>AirExpay is in development. Join the waitlist and we’ll reach out as we onboard early merchants.</p></div><a class="btn btn-lg" style="background:hsl(var(--primary-foreground));color:hsl(var(--primary))" href="#join">Join the waitlist</a></div></div></section></main>
<footer><div class="w row between" style="flex-wrap:wrap;gap:12px"><span>© 2026 AirexPay LLC. AirExpay is not yet available; no payments are processed on this site.</span><span><a href="#">Privacy policy (draft)</a> · <a href="#">Terms (draft)</a></span></div></footer>'''
    return page("AirExpay — Non-custodial payment software", b, cls="dark" if dark else "", extra_css=LP_CSS)

def pricing(dark=False):
    hdr = '<header><div class="w"><a class="brand" style="padding:0" href="landing.html">Airex<span>pay</span></a><nav class="links"><a href="landing.html#product">Product</a><a href="landing.html#how">How it works</a><a href="landing.html#dev">Developers</a><a href="pricing.html" style="color:hsl(var(--foreground))">Pricing</a></nav><a class="btn btn-primary" href="landing.html#join">Join the waitlist</a></div></header>'
    b = hdr + f'''<main class="w" style="padding-top:96px;padding-bottom:120px;max-width:760px"><div class="eyebrow">Pricing</div><h1 style="font-size:48px">Pricing coming soon</h1>
<p class="lead">We’re finalising AirExpay pricing with our early merchants. Every fee will be published here before any live payment is processed, and shown in your dashboard before you go live.</p>
<div class="card" style="padding:24px;box-shadow:none"><h3 style="margin:0 0 10px;font-size:17px">What we can say today</h3><ul class="ul" style="margin:0"><li>{ic("check")}AirExpay is non-custodial: payments go to wallets you control, not to an AirExpay balance.</li><li>{ic("check")}Network fees are paid by the customer’s wallet and are separate from any AirExpay fee.</li><li>{ic("check")}Simulation mode is available for testing before going live.</li></ul></div>
<div class="row" style="margin-top:28px;gap:12px;flex-wrap:wrap"><a class="btn btn-primary btn-lg" href="landing.html#join">Join the waitlist</a><a class="btn btn-outline btn-lg" href="landing.html">Back to home</a></div></main>
<footer><div class="w row between" style="flex-wrap:wrap;gap:12px"><span>© 2026 AirexPay LLC. AirExpay is not yet available; no payments are processed on this site.</span><span><a href="#">Privacy policy (draft)</a> · <a href="#">Terms (draft)</a></span></div></footer>'''
    return page("Pricing", b, cls="dark" if dark else "", extra_css=LP_CSS)

pages = {"landing": landing(), "dashboard-overview": overview(), "dashboard-invoices": shell("dashboard-invoices", invoices_content()),
 "dashboard-invoice-detail": drawer(), "dashboard-payment-links": links(), "dashboard-api-keys": keys(), "dashboard-webhooks": webhooks(), "dashboard-settings": settings()}
for s in ["waiting","confirming","paid","underpaid","expired","failed"]: pages[f"checkout-{s}"] = ck(s)
pages["dashboard-overview-dark"] = overview()
pages["dashboard-api-keys"] = keys("pending")
for st in ["pending","approved","rejected"]: pages[f"dashboard-api-keys-{st}"] = keys(st)
pages["dashboard-api-keys-approved-production"] = keys("approved","production")
pages["pricing"] = pricing(); pages["pricing-dark"] = pricing(True); pages["landing-dark"] = landing(True)
for st in ["waiting","confirming","paid","underpaid","expired","failed"]: pages[f"checkout-{st}-dark"] = ck(st, True)
pages["dashboard-payment-links-create"] = links(True)
def cardify(h):
    def tab(m):
        t=m.group(0); ths=[re.sub(r"<[^>]+>","",x).strip() for x in re.findall(r"<th[^>]*>(.*?)</th>",t,flags=re.S)]
        def row(r):
            k=[0]
            def td(x):
                i=k[0]; k[0]+=1; lab=ths[i] if i<len(ths) else ""
                return f'<td data-label="{lab}"'+(x.group(1) or "")+">"
            return re.sub(r"<td(\s[^>]*)?>",lambda x: td(x) if True else "",r.group(0))
        t=re.sub(r"<tr>.*?</tr>",lambda r: row(r) if "<td" in r.group(0) else r.group(0),t,flags=re.S)
        return t.replace("<table>",'<table class="cl">',1)
    return re.sub(r"<table>.*?</table>",tab,h,flags=re.S)
import re
for n in [k for k in list(pages) if k.startswith("dashboard") and k!="dashboard-overview-dark"]:
    pages[n+"-dark"]=pages[n]
for n,h in pages.items():
    if n.startswith("dashboard"):
        h = page(n, cardify(h).replace("<td data-label=\"\"","<td data-label=\"\""), cls="dark" if n.endswith("-dark") else "")
    (OUT/f"{n}.html").write_text(h)
print(len(pages), "pages")
