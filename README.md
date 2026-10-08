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
   `local-home-inventory-privacy.html`, and the rest — **is still served from
   somewhere carrying this exact old design** (the two-tone "Eden Apps"
   wordmark, indigo links, the `<style>` block every page here repeats).
   Confirmed live, word for word, against `local-home-inventory-privacy.html`
   (an already-shipped app, untouched by tonight's work) and matches this
   folder's own copy of that file. **How these specific files actually reach
   that URL — GitHub Pages, a Vercel rewrite, something else — is not
   confirmed.** What's confirmed is that the content and the old design both
   really do appear at the real URL.

So: a page here is very likely live and real, in the **old, pre-rebrand
visual design** — not retired, not a dead copy, but also not yet reskinned to
match the October rebrand. That mismatch is a real, confirmed, portfolio-wide
gap (it affects already-shipped apps like Local Home Inventory right now),
separate from and bigger than anything either of us touched tonight.

**Before you believe a page here is live, dead, current, or stale: open the
real URL and look, the way this note was confirmed. A CNAME file, a git log
date, or a lack of a sync script are all weak evidence next to that.**

Several apps' own tooling (for example Eden Desk's `Tools/build_web_legal.py`)
writes its generated legal pages into this folder; that tooling's target is
apparently still correct, not stale — treat that as confirmed only as far as
the check above goes, not further.

---

# edenapps.app (historical — see warning above)

The site served at **edenapps.app**: the hub for the Eden Apps family of privacy-first apps, Mac tools and browser extensions.

## License

Copyright (c) 2026 Eden Apps. All rights reserved.

This is not open-source software. Please do not copy, modify or redistribute it without written permission from Eden Apps. See `LICENSE`.
