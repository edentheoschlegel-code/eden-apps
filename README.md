# ⚠️ Read this before editing anything in this folder

**Confirmed live on 8 October 2026 by opening real URLs, not by reading file
trees — do the same before trusting anything below if time has passed.**

edenapps.app is served by **two layers that both really are live**, and they
visually disagree with each other:

1. **The top-level pages** — the homepage, `/privacy/`, `/terms/`, `/apps/`,
   `/help/` — are the new, rebranded Next.js app in **`../eden-apps-site`**
   (the four-color square mark, serif "EDEN APPS" wordmark, "MENU" nav, clean
   URLs with no `.html`). Editing this folder does **not** touch those pages.
2. **Every per-app page** — `eden-fonts-privacy.html`,
   `local-home-inventory-privacy.html`, and the rest — **is served from
   somewhere real**, old design or new, file by file (see the brand check
   below for which is which right now). Confirmed live, word for word,
   against `local-home-inventory-privacy.html` (an already-shipped app) and
   matched this folder's own copy of that file. **How these specific files
   actually reach that URL — GitHub Pages, a Vercel rewrite, something else —
   is not confirmed.** What's confirmed is that the content, and whichever
   design a given file carries, both really do appear at the real URL.

So: a page here is very likely live and real — not retired, not a dead copy.
Some still carry the **old, pre-rebrand visual design** (two-tone "Eden Apps"
wordmark, indigo links); as of 8 October 2026 that's most of them, a real,
confirmed, portfolio-wide gap (it affects already-shipped apps like Local
Home Inventory right now), bigger than any one session fixes at once.

**Before you believe a page here is live, dead, current, or stale: open the
real URL and look, the way this note was confirmed. A CNAME file, a git log
date, or a lack of a sync script are all weak evidence next to that.**

Several apps' own tooling (for example Eden Desk's `Tools/build_web_legal.py`)
writes its generated legal pages into this folder; that tooling's target is
apparently still correct, not stale — treat that as confirmed only as far as
the check above goes, not further.

## The brand check — so the old design can't ship again by accident

`tools/check_brand.sh` checks every `*-privacy.html`, `*-terms.html` and
`*-support.html` file for the current brand's tokens and fails if one is
missing, or if an old-design marker (the `li-tx` indigo link color, or an old
custom font name) is still present. It is installed as this repo's
`pre-commit` hook, so committing a page still in the old design is refused —
but **`.git/hooks` is never tracked by git, so a fresh clone has none of
this until someone runs the installer once:**

```sh
tools/install_hooks.sh      # once per clone
tools/check_brand.sh --all  # audit every page right now, hook or no hook
```

A real exception can still bypass it with `git commit --no-verify`, same as
any hook — a visible escape hatch, not a silent one. If a page you know is
current gets flagged, that's the check being wrong, not the page: fix the
check (it's short), don't just bypass it and move on.

---

# edenapps.app (historical — see warning above)

The site served at **edenapps.app**: the hub for the Eden Apps family of privacy-first apps, Mac tools and browser extensions.

## License

Copyright (c) 2026 Eden Apps. All rights reserved.

This is not open-source software. Please do not copy, modify or redistribute it without written permission from Eden Apps. See `LICENSE`.
