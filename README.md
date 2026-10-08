# ⚠️ RETIRED — this folder is NOT edenapps.app anymore

**Read this before editing anything in this folder.**

The real, live site is **`../eden-apps-site`** (a Next.js app, confirmed against the
live edenapps.app homepage and `/privacy/` page on 8 October 2026 — matching
design: the four-color square mark, serif "EDEN APPS" wordmark, "MENU" nav,
clean `/privacy/` and `/terms/` URLs with no `.html`).

This folder (`eden-apps-hub`) is the **old, static-HTML site** this one replaced.
Its `CNAME` file still says `edenapps.app`, which is exactly the trap: that file
does not mean this folder is live, only that it once was, or was meant to be.
**Do not trust a CNAME file over an actual look at the live URL.**

Editing a page in here changes nothing a real visitor, Apple's App Review, or
an App Store Connect privacy/support URL will ever see, if that URL points at
`edenapps.app` — because those URLs are served by `eden-apps-site` now, not
this folder. Several apps' own tooling (for example Eden Desk's
`Tools/build_web_legal.py`) is still wired to write its generated legal pages
into **this dead folder** and has not been updated for the move; that is a
real, separate problem worth fixing, not a sign this folder is current.

If you're not sure whether something here is still true, open the live URL
and compare, the way this warning was confirmed. Do not assume from file
contents alone.

---

# edenapps.app (historical — see warning above)

The site served at **edenapps.app**: the hub for the Eden Apps family of privacy-first apps, Mac tools and browser extensions.

## License

Copyright (c) 2026 Eden Apps. All rights reserved.

This is not open-source software. Please do not copy, modify or redistribute it without written permission from Eden Apps. See `LICENSE`.
