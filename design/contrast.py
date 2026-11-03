"""Compute WCAG 2.x contrast ratios for token pairs in tokens.css. Writes contrast-report.md."""
import re, colorsys, sys, pathlib
css = pathlib.Path(__file__).with_name("tokens.css").read_text()
def block(sel):
    m = re.search(re.escape(sel) + r"\s*\{(.*?)\n\}", css, re.S); return dict(re.findall(r"--([\w-]+):\s*([\d.]+ [\d.]+% [\d.]+%)", m.group(1)))
def rgb(h):
    H,S,L = [float(x.rstrip('%')) for x in h.split()]; r,g,b = colorsys.hls_to_rgb(H/360, L/100, S/100); return (r,g,b)
def lum(c):
    f=lambda v: v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    r,g,b=map(f,c); return 0.2126*r+0.7152*g+0.0722*b
def ratio(a,b):
    la,lb=sorted([lum(rgb(a)),lum(rgb(b))],reverse=True); return (la+0.05)/(lb+0.05)
pairs=[("foreground","background",4.5),("foreground","card",4.5),("muted-foreground","background",4.5),("muted-foreground","card",4.5),("muted-foreground","muted",4.5),
 ("primary-foreground","primary",4.5),("primary","background",4.5),("primary","card",4.5),("accent-foreground","accent",4.5),("destructive-foreground","destructive",4.5),("destructive","card",4.5),
 ("ring","background",3.0),("input","card",3.0),("input","background",3.0),("border","card",None)]
for s in ["waiting","confirming","paid","underpaid","expired","failed","refunded"]:
    pairs.append((f"status-{s}-fg",f"status-{s}",4.5)); pairs.append((f"status-{s}-fg","card",4.5))
pairs.append(("sim-fg","sim",4.5))
out=["| Mode | Foreground | Background | Ratio | Required | Result |","|---|---|---|---|---|---|"]; fails=0
for mode,sel in [("light",":root"),("dark",".dark")]:
    t=block(sel)
    for fg,bg,req in pairs:
        r=ratio(t[fg],t[bg]); ok="decorative (non-text)" if req is None else ("PASS" if r>=req else "FAIL")
        fails+= ok=="FAIL"
        out.append(f"| {mode} | `--{fg}` | `--{bg}` | {r:.2f}:1 | {'—' if req is None else f'{req}:1'} | {ok} |")
pathlib.Path(__file__).with_name("contrast-report.md").write_text("\n".join(out)+"\n")
print("\n".join(out)); print("FAILS:",fails); sys.exit(1 if fails else 0)
