#!/usr/bin/env python3
"""Build sitemap.xml for edenapps.app from the files in this folder.

What goes in, in this order:
  - the pages built by ../eden-apps-site at their clean addresses
    (/, /help/, /how-it-works/, /privacy/, /terms/, /refunds/)
  - the Chrome extension privacy pages at the .html addresses registered on the
    Chrome Web Store (extensions-privacy.html, ext-privacy-*.html), which is also
    the canonical each of those pages declares
  - every per-app page: *-privacy.html, *-support.html, *-terms.html
  - the four browser tools under tools/

What stays out: redirect stubs (they carry <meta name="robots" content="noindex">),
404.html, and build files.

lastmod is the file's last commit date in this repo. A file with uncommitted
changes, or one that has never been committed, uses its modified time instead.

Usage:  python3 tools/build_sitemap.py           # rewrites sitemap.xml
        python3 tools/build_sitemap.py --check   # prints the XML, writes nothing

Run it after adding, changing or removing a page, before committing.
"""
import datetime as dt
import glob
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://edenapps.app"

NEXT_PAGES = [
    ("", "index.html"),
    ("help/", "help/index.html"),
    ("how-it-works/", "how-it-works/index.html"),
    ("privacy/", "privacy/index.html"),
    ("terms/", "terms/index.html"),
    ("refunds/", "refunds/index.html"),
]
TOOLS = ["furrow", "pagenook", "clearleaf", "bookplate"]


def names(pattern: str):
    """File names in the repo root matching a glob pattern."""
    return sorted(glob.glob(pattern, root_dir=ROOT))


def git(*args: str) -> str:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return ""


def lastmod(rel: str) -> str:
    committed = git("log", "-1", "--format=%cs", "--", rel)
    dirty = git("status", "--porcelain", "--", rel)
    if committed and not dirty:
        return committed
    ts = os.path.getmtime(os.path.join(ROOT, rel))
    return dt.date.fromtimestamp(ts).isoformat()


def is_noindex(rel: str) -> bool:
    with open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace") as fh:
        head = fh.read(4000)
    return 'name="robots" content="noindex"' in head


def entries():
    seen = set()
    for url, rel in NEXT_PAGES:
        if os.path.exists(os.path.join(ROOT, rel)):
            seen.add(rel)
            yield url, rel
    for name in ["extensions-privacy.html"] + names("ext-privacy-*.html"):
        if os.path.exists(os.path.join(ROOT, name)) and name not in seen:
            seen.add(name)
            yield name, name
    apps = sorted(set(names("*-privacy.html")) | set(names("*-support.html")) | set(names("*-terms.html")))
    for name in apps:
        if name in seen or name.startswith("ext-") or is_noindex(name):
            continue
        seen.add(name)
        yield name, name
    for tool in TOOLS:
        rel = f"tools/{tool}/index.html"
        if os.path.exists(os.path.join(ROOT, rel)):
            yield f"tools/{tool}/", rel


def build() -> str:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, rel in entries():
        lines.append(f"  <url><loc>{SITE}/{url}</loc><lastmod>{lastmod(rel)}</lastmod></url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main(argv):
    xml = build()
    if "--check" in argv:
        sys.stdout.write(xml)
        return 0
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write(xml)
    print(f"sitemap.xml written with {xml.count('<url>')} addresses")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
