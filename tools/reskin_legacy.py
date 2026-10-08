#!/usr/bin/env python3
"""Reskin an old-design *-privacy.html / *-terms.html / *-support.html page
to the October 2026 rebrand, preserving its content exactly.

Extracts, from the OLD file: the meta description, the canonical URL, the
"Last updated" line, and the body content (everything between the opening
`<p class="updated">...</p>` line and the closing `</div></main>`) — tables,
lists, code spans and all, untouched. Drops the old `.kick` device-type line
(dropped on every page reskinned by hand tonight too, for consistency).
Rebuilds the chrome from the same tokens as eden-desk-privacy.html etc.

Usage:
    python3 tools/reskin_legacy.py FILE [FILE ...]   # rewrites in place
    python3 tools/reskin_legacy.py --check FILE ...  # prints what it would do, writes nothing
"""
from __future__ import annotations

import re
import sys

ACCENTS = {"privacy": ("var(--mauve)", "Privacy"), "terms": ("var(--olive)", "Terms"), "support": ("var(--sage)", "Support")}

ICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='296 147.5 661 656'%3E"
    "%3Crect x='296' y='147.5' width='320' height='320' rx='116' fill='%23DCC4B2'/%3E"
    "%3Crect x='637' y='147.5' width='320' height='320' rx='116' fill='%239DA69F'/%3E"
    "%3Crect x='296' y='483.5' width='320' height='320' rx='116' fill='%238D9177'/%3E"
    "%3Crect x='637' y='483.5' width='320' height='320' rx='116' fill='%23B799A0'/%3E"
    "%3Cpath d='M626.5,422.0 Q633.36,467.15 675.5,474.5 Q633.36,481.85 626.5,527.0 "
    "Q619.64,481.85 577.5,474.5 Q619.64,467.15 626.5,422.0Z' fill='%233A2A18'/%3E%3C/svg%3E"
)

HEADER_SVG = (
    '<svg viewBox="296 147.5 661 656" aria-hidden="true">'
    '<rect x="296" y="147.5" width="320" height="320" rx="116" fill="#DCC4B2"/>'
    '<rect x="637" y="147.5" width="320" height="320" rx="116" fill="#9DA69F"/>'
    '<rect x="296" y="483.5" width="320" height="320" rx="116" fill="#8D9177"/>'
    '<rect x="637" y="483.5" width="320" height="320" rx="116" fill="#B799A0"/>'
    '<path d="M626.5,422.0 Q633.36,467.15 675.5,474.5 Q633.36,481.85 626.5,527.0 '
    'Q619.64,481.85 577.5,474.5 Q619.64,467.15 626.5,422.0Z" fill="#3A2A18"/></svg>'
)

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<link rel="icon" type="image/svg+xml" href="{icon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root{{
    --paper:#f7f2eb;--paper-deep:#efe7dc;--ink:#2f2110;--ink-soft:#5e5143;--ink-faint:#8a7d6f;--line:#e4d9cb;--star:#3a2a18;
    --sand:#dcc4b2;--sage:#9da69f;--olive:#8d9177;--mauve:#b799a0;
    --font-display:'Cormorant Garamond',ui-serif,Georgia,serif;
    --font-ui:'Jost',ui-sans-serif,system-ui,sans-serif;
  }}
  :root[data-theme="dark"]{{--paper:#221b15;--paper-deep:#2b231c;--ink:#f3eadf;--ink-soft:#d2c6b8;--ink-faint:#a69a8c;--line:#3d3329;--star:#f3eadf;color-scheme:dark}}
  @media(prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--paper:#221b15;--paper-deep:#2b231c;--ink:#f3eadf;--ink-soft:#d2c6b8;--ink-faint:#a69a8c;--line:#3d3329;--star:#f3eadf;color-scheme:dark}}}}
  *{{box-sizing:border-box}}
  html{{background:var(--paper);color:var(--ink);-webkit-font-smoothing:antialiased}}
  body{{margin:0;font-family:var(--font-ui);font-weight:350;line-height:1.65}}
  a{{color:inherit}}
  ::selection{{background:var(--sand);color:#2f2110}}
  .eyebrow{{font-family:var(--font-ui);font-size:.7rem;font-weight:450;letter-spacing:.34em;text-transform:uppercase;color:var(--ink-faint)}}
  .display{{font-family:var(--font-display);font-weight:300;letter-spacing:-.01em;line-height:1.04}}
  .wrap{{max-width:1240px;margin:0 auto;padding:0 20px}}
  @media(min-width:640px){{.wrap{{padding:0 32px}}}}
  header{{position:sticky;top:0;z-index:40;border-bottom:1px solid transparent;background:transparent;transition:background-color .3s,border-color .3s}}
  header.scrolled{{border-bottom-color:var(--line);background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:blur(6px)}}
  header .row{{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0}}
  .brand{{display:inline-flex;align-items:center;gap:12px;text-decoration:none;color:var(--ink)}}
  .brand svg{{width:28px;height:28px;display:block}}
  nav.primary{{display:none;align-items:center;gap:28px}}
  @media(min-width:768px){{nav.primary{{display:flex}}}}
  nav.primary a{{font-size:.82rem;letter-spacing:.02em;color:var(--ink-soft);text-decoration:none;transition:color .2s}}
  nav.primary a:hover{{color:var(--ink)}}
  .headerRight{{display:flex;align-items:center;gap:8px}}
  @media(min-width:768px){{.headerRight{{gap:28px}}}}
  .themebtn{{display:inline-grid;place-items:center;width:40px;height:40px;border:none;background:none;color:var(--ink-soft);cursor:pointer;border-radius:999px;padding:0}}
  .themebtn:hover{{color:var(--ink)}}
  .themebtn svg{{width:18px;height:18px}}
  .intro{{padding:48px 0 44px}}
  @media(min-width:1024px){{.intro{{padding:64px 0 56px}}}}
  .introTop{{display:flex;align-items:center;gap:16px}}
  .petal{{display:inline-block;width:48px;height:48px;border-radius:36%;flex:none;background:{accent}}}
  h1.display{{margin:32px 0 0;max-width:20ch;font-size:2.4rem}}
  @media(min-width:640px){{h1.display{{font-size:3.4rem}}}}
  .updated{{margin-top:24px;display:block}}
  article{{max-width:68ch;border-top:1px solid var(--line);padding-top:32px;padding-bottom:60px}}
  article h2{{font-family:var(--font-display);font-weight:300;letter-spacing:-.01em;line-height:1.1;margin:44px 0 16px;font-size:1.6rem}}
  @media(min-width:640px){{article h2{{font-size:1.9rem}}}}
  article h2:first-of-type{{margin-top:0}}
  article h2::before{{content:"";display:inline-block;width:.4em;height:.4em;border-radius:.15em;margin-right:12px;transform:translateY(-2px);vertical-align:middle;background:{accent}}}
  article h3{{font-family:var(--font-ui);font-weight:500;font-size:1.02rem;margin:28px 0 8px;color:var(--ink)}}
  article p{{margin:0 0 18px;line-height:1.7;color:var(--ink-soft)}}
  article p.lead{{color:var(--ink);font-size:1.12rem;margin-bottom:22px}}
  article strong{{color:var(--ink);font-weight:500}}
  article a{{color:var(--ink);text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:4px}}
  article a:hover{{text-decoration-color:var(--ink)}}
  article code{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:var(--paper-deep);border:1px solid var(--line);border-radius:5px;padding:1px 5px;color:var(--ink)}}
  article ul{{margin:0 0 18px;padding:0;list-style:none}}
  article li{{display:flex;gap:14px;margin-bottom:10px;line-height:1.7;color:var(--ink-soft)}}
  article li::before{{content:"";margin-top:.7em;width:6px;height:6px;flex:none;border-radius:30%;background:var(--ink-faint)}}
  article table{{width:100%;border-collapse:collapse;margin:0 0 20px;display:block;overflow-x:auto;font-family:var(--font-ui)}}
  article th,article td{{text-align:left;padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:top;font-size:.92rem}}
  article th{{color:var(--ink);font-weight:500}}
  article td{{color:var(--ink-soft)}}
  article tbody th{{min-width:9.5em;font-weight:500}}
  .sib{{display:flex;gap:18px;flex-wrap:wrap;margin:36px 0 0;padding-top:20px;border-top:1px solid var(--line);font-size:.85rem}}
  footer{{border-top:1px solid var(--line)}}
  footer .row{{display:flex;flex-direction:column;gap:14px;padding:36px 0;align-items:flex-start}}
  @media(min-width:640px){{footer .row{{flex-direction:row;align-items:center;justify-content:space-between}}}}
  footer nav{{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:.82rem;color:var(--ink-soft)}}
  footer nav a{{text-decoration:none;color:inherit}}
  footer nav a:hover{{color:var(--ink)}}
</style>
<script>(function(){{try{{var t=localStorage.getItem('ea-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}}catch(e){{}}}})();</script>
</head>
<body>
<header id="siteHeader">
  <div class="wrap row">
    <a class="brand" href="https://edenapps.app/" aria-label="Eden Apps home">
      {header_svg}
      <span class="eyebrow" style="font-size:.66rem;letter-spacing:.42em;color:var(--ink)">Eden Apps</span>
    </a>
    <div class="headerRight">
      <nav class="primary" aria-label="Primary">
        <a href="https://edenapps.app/#apps">Apps</a>
        <a href="https://edenapps.app/#mac">Mac</a>
        <a href="https://edenapps.app/#extensions">Extensions</a>
        <a href="https://edenapps.app/how-it-works/">How it works</a>
        <a href="https://edenapps.app/help/">Help</a>
      </nav>
      <button class="themebtn" id="themeToggle" type="button" aria-label="Toggle dark mode" title="Toggle light / dark">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>
</header>
<main>
  <div class="wrap intro">
    <div class="introTop">
      <span class="petal" aria-hidden="true"></span>
      <span class="eyebrow">{eyebrow}</span>
    </div>
    <h1 class="display">{h1}</h1>
    {updated_html}
  </div>
  <div class="wrap">
    <article>
{body}
    </article>
  </div>
</main>
<footer>
  <div class="wrap row">
    <p class="eyebrow">© 2026 Eden Apps · Different tools. A brighter tomorrow.</p>
    <nav aria-label="Footer">
      <a href="https://edenapps.app/how-it-works/">How it works</a>
      <a href="https://edenapps.app/privacy/">Privacy</a>
      <a href="https://edenapps.app/terms/">Terms</a>
      <a href="https://edenapps.app/refunds/">Refunds</a>
      <a href="https://edenapps.app/help/">Help</a>
      <a href="mailto:support@edenapps.app">support@edenapps.app</a>
    </nav>
  </div>
</footer>
<script>
(function(){{
  var header=document.getElementById('siteHeader');
  function onScroll(){{ if(window.scrollY>24){{header.classList.add('scrolled');}} else {{header.classList.remove('scrolled');}} }}
  onScroll(); window.addEventListener('scroll', onScroll, {{passive:true}});

  var btn=document.getElementById('themeToggle');
  function current(){{var t=document.documentElement.getAttribute('data-theme'); if(t==='dark'||t==='light') return t; return (window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches)?'dark':'light';}}
  var sun='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  var moon='<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><line x1="12" y1="2.6" x2="12" y2="4.6"/><line x1="12" y1="2.6" x2="12" y2="4.6" transform="rotate(45 12 12)"/><line x1="12" y1="2.6" x2="12" y2="4.6" transform="rotate(90 12 12)"/><line x1="12" y1="2.6" x2="12" y2="4.6" transform="rotate(135 12 12)"/><line x1="12" y1="2.6" x2="12" y2="4.6" transform="rotate(180 12 12)"/><line x1="12" y1="2.6" x2="12" y2="4.6" transform="rotate(225 12 12)"/><line x1="12" y1="2.6" x2="12" y2="4.6" transform="rotate(270 12 12)"/><line x1="12" y1="2.6" x2="12" y2="4.6" transform="rotate(315 12 12)"/></g></svg>';
  function paint(){{ btn.innerHTML = current()==='dark' ? moon : sun; }}
  paint();
  btn.addEventListener('click', function(){{
    var next = current()==='dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try{{ localStorage.setItem('ea-theme', next); }}catch(e){{}}
    paint();
  }});
}})();
</script>
</body>
</html>
"""


def extract(src: str, path: str) -> dict:
    def find(pattern, flags=0):
        m = re.search(pattern, src, flags)
        if not m:
            raise ValueError(f"{path}: could not find pattern {pattern!r}")
        return m.group(1)

    title = find(r"<title>(.*?)</title>")
    description = find(r'<meta name="description" content="(.*?)">')
    canonical = find(r'<link rel="canonical" href="(.*?)">')
    h1 = find(r"<h1>(.*?)</h1>")

    # A couple of pages (e.g. eden-coloring-support.html) have no "Last
    # updated" line at all; the body there starts right after </h1>.
    updated_match = re.search(r'<p class="updated">(.*?)</p>', src)
    updated = updated_match.group(1) if updated_match else ""
    body_start = updated_match.end() if updated_match else src.index(f"<h1>{h1}</h1>") + len(f"<h1>{h1}</h1>")

    body_match = re.search(r"\n(.*?)\n</div></main>", src[body_start:], re.DOTALL)
    if not body_match:
        raise ValueError(f"{path}: could not find body before </div></main>")
    body = body_match.group(1)

    if path.endswith("-privacy.html"):
        page_type = "privacy"
    elif path.endswith("-terms.html"):
        page_type = "terms"
    elif path.endswith("-support.html"):
        page_type = "support"
    else:
        raise ValueError(f"{path}: filename doesn't end in -privacy/-terms/-support")

    accent, eyebrow = ACCENTS[page_type]
    updated_html = f'<p class="eyebrow updated">{updated}</p>' if updated else ""
    return {
        "title": title,
        "description": description,
        "canonical": canonical,
        "h1": h1,
        "updated_html": updated_html,
        "body": body,
        "accent": accent,
        "eyebrow": eyebrow,
    }


def reskin(path: str, check_only: bool) -> None:
    with open(path, encoding="utf-8") as f:
        src = f.read()
    data = extract(src, path)
    rendered = TEMPLATE.format(icon=ICON, header_svg=HEADER_SVG, **data)
    if check_only:
        print(f"  would write {path} ({len(rendered):,} bytes)")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(rendered)
    print(f"  wrote {path} ({len(rendered):,} bytes)")


def main() -> int:
    args = sys.argv[1:]
    check_only = False
    if args and args[0] == "--check":
        check_only = True
        args = args[1:]
    if not args:
        print(__doc__)
        return 1
    failed = 0
    for path in args:
        try:
            reskin(path, check_only)
        except Exception as e:  # noqa: BLE001 - this is a one-shot script, not a library
            print(f"  ERROR: {e}", file=sys.stderr)
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
