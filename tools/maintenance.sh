#!/bin/sh
# Eden Apps maintenance mode: puts maintenance/index.html in place of the ordinary site pages.
# Read MAINTENANCE.md (repo root) first. This script changes files only; it never commits or pushes.
#
#   sh tools/maintenance.sh on      # replace the ordinary pages with the maintenance page
#   sh tools/maintenance.sh status  # show whether the home page is the maintenance page
#
# To turn maintenance OFF: git revert the commit that turned it on, then push (see MAINTENANCE.md).
set -eu
cd "$(dirname "$0")/.."

PAGE=maintenance/index.html
[ -f "$PAGE" ] || { echo "missing $PAGE"; exit 1; }

# Ordinary pages that show the maintenance page. Everything else stays as it is:
# privacy, terms, help, support, refunds, every per-app *-privacy / *-support / *-terms page,
# ext-privacy-*, extensions-privacy, 404, and the browser tools under tools/.
# (apps.html, extensions.html, mac-tools.html, mac-bundle.html, bookplate.html, clearleaf.html,
# furrow.html and pagenook.html are redirect stubs to the home page, so they land on it too.)
PAGES="index.html how-it-works.html how-it-works/index.html"

# Next.js data files for those pages. Without them, a click from a policy page to the home page
# does a full page load (and gets the maintenance page) instead of drawing the old home page.
DATA="index.txt __next.__PAGE__.txt __next._full.txt __next._tree.txt
how-it-works/index.txt how-it-works/__next._full.txt how-it-works/__next._tree.txt how-it-works/__next.how-it-works.__PAGE__.txt"

case "${1:-}" in
  on)
    for p in $PAGES; do cp "$PAGE" "$p"; echo "maintenance page -> $p"; done
    for d in $DATA; do if [ -e "$d" ]; then rm "$d"; echo "removed $d"; fi; done
    echo
    echo "Done (not committed). Next: git add -A && git commit, then push go-live-redesign:main."
    ;;
  status)
    if cmp -s "$PAGE" index.html; then echo "maintenance: ON"; else echo "maintenance: OFF"; fi
    ;;
  *)
    echo "usage: sh tools/maintenance.sh on|status"; exit 2
    ;;
esac
