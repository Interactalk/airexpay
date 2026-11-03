"""Render mockups to PNG with Playwright + system Chrome. Run: /tmp/venv/bin/python src/shoot.py"""
import pathlib
from playwright.sync_api import sync_playwright
D = pathlib.Path(__file__).resolve().parent.parent
M, S = D/"mockups", D/"screenshots"
# (page, width, full_page, output suffix)
jobs = []
for v in ["landing","landing-dark","pricing","pricing-dark"]:
    jobs += [(v,1440,True),(v,390,True)]
for s in ["waiting","confirming","paid","underpaid","expired","failed"]:
    jobs += [(f"checkout-{s}",390,True),(f"checkout-{s}-dark",390,True)]
jobs += [("checkout-waiting",1440,False),("checkout-paid",1440,False),("checkout-waiting-dark",1440,False)]
for n in ["overview","overview-dark","invoices","webhooks","settings","payment-links","api-keys-pending","api-keys-approved","api-keys-rejected","api-keys-approved-production"]:
    jobs.append((f"dashboard-{n}",1440,True))
for n in ["invoice-detail","payment-links-create"]:
    jobs.append((f"dashboard-{n}",1440,False))
for n in ["overview","invoices","api-keys-pending","api-keys-approved","api-keys-approved-production","settings"]:
    jobs.append((f"dashboard-{n}",390,True))
for n in ["invoice-detail"]:
    jobs.append((f"dashboard-{n}",390,False))
checks=[]
DASH=["overview","invoices","invoice-detail","payment-links","payment-links-create","api-keys-pending","api-keys-approved","api-keys-rejected","api-keys-approved-production","webhooks","settings"]
jobs=[j for j in jobs if j[1]>500]
for v in ["landing","landing-dark","pricing","pricing-dark"]: jobs.append((v,390,True))
for s_ in ["waiting","confirming","paid","underpaid","expired","failed"]: jobs += [(f"checkout-{s_}",390,True),(f"checkout-{s_}-dark",390,True)]
for n in DASH:
    ov = n in ("invoice-detail","payment-links-create")
    jobs += [(f"dashboard-{n}",390,not ov),(f"dashboard-{n}-dark",390,not ov)]
taps=[]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    for name,w,full in jobs:
        pg = b.new_page(viewport={"width":w,"height":900 if w>500 else 844}, device_scale_factor=2 if w<500 else 1)
        pg.goto((M/f"{name}.html").as_uri()); pg.wait_for_timeout(200)
        out = S/f"{name}-{'desktop' if w>500 else 'mobile'}-{w}.png"
        if w<500:
            sw,vw=pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
            checks.append((out.name,sw,vw))
            if name.startswith("dashboard"):
                small=pg.evaluate("""[...document.querySelectorAll('.btn,.chip,.mnav a,.tab,.mtop .btn')].filter(e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return cs.display!='none'&&r.width>0&&r.height<44}).map(e=>e.textContent.trim().slice(0,30)+' '+Math.round(e.getBoundingClientRect().height))""")
                taps.append((out.name,small))
        pg.screenshot(path=str(out), full_page=full); pg.close(); print(out.name)
    b.close()

bad=[c for c in checks if c[1]>c[2]]
rep="\n".join(f"| {n} | {sw} | {vw} | {'FAIL' if sw>vw else 'PASS'} |" for n,sw,vw in checks)
(D/"overflow-report.md").write_text("# Horizontal overflow check (390 shots)\n\ndocument.documentElement.scrollWidth must be <= viewport width.\n\n| Screenshot | scrollWidth | viewport | Result |\n|---|---|---|---|\n"+rep+f"\n\n{len(checks)-len(bad)}/{len(checks)} pass.\n")
print("OVERFLOW", len(checks), "checked,", len(bad), "fail", bad)

tb=[t for t in taps if t[1]]
(D/"tap-target-report.md").write_text("# Tap targets (dashboard 390 shots, min 44px)\n\nChecked: .btn, .chip, .mnav a, .tab\n\n"+"\n".join(f"- {n}: {'PASS' if not sm else 'FAIL '+repr(sm)}" for n,sm in taps)+f"\n\n{len(taps)-len(tb)}/{len(taps)} pass.\n")
print("TAPS", len(taps), "checked,", len(tb), "fail", tb[:3])
