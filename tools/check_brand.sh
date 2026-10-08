#!/bin/sh
# Fails if a *-privacy.html, *-terms.html or *-support.html file being
# committed still carries the pre-October-2026 design instead of the
# current rebrand.
#
# Why this exists: on 8 October 2026 three pages (Eden Desk x3, Eden Fonts
# x2) were found live on edenapps.app in the OLD design weeks after the
# rebrand shipped, because nothing checked. This is the check.
#
# What it looks for, per staged file matching the pattern above:
#   - must contain the new brand's `--font-display` custom property
#   - must NOT contain `li-tx` (the old template's indigo link color var)
#   - must NOT contain the old custom font names (EdenColumn, EdenSprinkle,
#     EdenWide, EdenBold, EdenRound)
#
# Run directly to audit the whole repo:   Tools/check_brand.sh --all
# Run as a pre-commit hook (installed by Tools/install_hooks.sh): checks
# only the files in the commit, so an unrelated commit to another file is
# never blocked by this.
#
# A real emergency can still bypass it with `git commit --no-verify`, same
# as any other hook. That is a deliberate escape hatch, not a hole: it
# leaves a visible trace (the raw git flag) rather than a silent one.

set -eu

mode="${1:-staged}"
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ "$mode" = "--all" ]; then
  files="$(ls -- *-privacy.html *-terms.html *-support.html 2>/dev/null || true)"
else
  files="$(git diff --cached --name-only --diff-filter=ACM -- '*-privacy.html' '*-terms.html' '*-support.html' 2>/dev/null || true)"
fi

if [ -z "$files" ]; then
  exit 0
fi

problems=""
for f in $files; do
  [ -f "$f" ] || continue

  # A real static export from eden-apps-site (e.g. extensions-privacy.html)
  # carries the rebrand through Tailwind's generated class names and
  # /_next/static asset paths, not the literal --font-display custom
  # property the hand-authored pages declare. It is current by construction;
  # check it only for the old markers, never for the new one's literal name.
  if grep -q -- '/_next/static/' "$f" 2>/dev/null; then
    bad=""
    grep -q -- 'li-tx' "$f" && bad="${bad}still has li-tx (old indigo link color); "
    grep -qE "EdenColumn|EdenSprinkle|EdenWide|EdenBold|EdenRound" "$f" && bad="${bad}still has an old custom font name; "
    [ -n "$bad" ] && problems="${problems}  ${f}: ${bad}\n"
    continue
  fi

  bad=""
  grep -q -- '--font-display' "$f" || bad="${bad}missing --font-display (new brand token); "
  grep -q -- 'li-tx' "$f" && bad="${bad}still has li-tx (old indigo link color); "
  grep -qE "EdenColumn|EdenSprinkle|EdenWide|EdenBold|EdenRound" "$f" && bad="${bad}still has an old custom font name; "
  if [ -n "$bad" ]; then
    problems="${problems}  ${f}: ${bad}\n"
  fi
done

if [ -n "$problems" ]; then
  printf 'check_brand.sh: these pages still carry the OLD design:\n\n'
  printf "%b" "$problems"
  printf '\nFix them to match the rebrand (see any of eden-desk-privacy.html,\neden-fonts-privacy.html, or local-subscriptions-privacy.html for the\ncurrent template) before committing, or `git commit --no-verify` if this\nis a deliberate exception.\n'
  exit 1
fi

exit 0
