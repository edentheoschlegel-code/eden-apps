# Maintenance mode

edenapps.app is a static site on GitHub Pages (`edentheoschlegel-code/eden-apps`, branch `main`),
pushed from this folder's `go-live-redesign` branch. GitHub Pages has no redirect or rewrite rules,
so maintenance mode swaps files: the ordinary pages are replaced by the maintenance page in one
commit, and turning it off is reverting that commit.

## What it does

- `maintenance/index.html` is the maintenance page (fonts copied next to it, so it needs nothing else).
- `sh tools/maintenance.sh on` copies it over `index.html`, `how-it-works.html` and
  `how-it-works/index.html`, and removes those pages' Next.js data files (`index.txt`,
  `__next.*.txt` at the root and in `how-it-works/`), so a click from a policy page to the home
  page does a full page load and shows the maintenance page.
- The redirect stubs (`apps.html`, `extensions.html`, `mac-tools.html`, `mac-bundle.html`,
  `bookplate.html`, `clearleaf.html`, `furrow.html`, `pagenook.html`) send people to the home page,
  so they land on the maintenance page too.

## What stays live, unchanged

Everything the apps, extensions and store listings link to:

- `/privacy/`, `/terms/`, `/help/`, `/refunds/` and their `.html` twins, `/support.html`
- `/extensions-privacy.html` and every `/ext-privacy-*.html` (Chrome extension privacy policies)
- every per-app `*-privacy.html`, `*-support.html`, `*-terms.html`
- the browser tools under `/tools/`, `404.html`, `sitemap.xml`, `robots.txt`, `/brand/`, `/world/`

The maintenance page links to Privacy, Terms and Help.

## Turn it on

```sh
cd "/Users/eden/Digital Products/EdenApps/eden-apps-hub-golive"
sh tools/maintenance.sh on
git add -A && git commit -m "Maintenance mode on"
git push origin go-live-redesign:main
```

## Turn it off

```sh
cd "/Users/eden/Digital Products/EdenApps/eden-apps-hub-golive"
git log --oneline --grep "Maintenance mode on" -1     # note the commit id
git revert <that commit id>
git push origin go-live-redesign:main
```

GitHub Pages redeploys in a minute or two; browsers may show the cached page for up to 10 minutes.
`sh tools/maintenance.sh status` says whether the home page is currently the maintenance page.

## If you run GO-LIVE.sh while maintenance is on

`GO-LIVE.sh` (in `eden-apps-site-golive`) copies a fresh build over `index.html` and
`how-it-works/`, which would bring the full site back. Run `sh tools/maintenance.sh on` again
before committing if the site should stay in maintenance.
