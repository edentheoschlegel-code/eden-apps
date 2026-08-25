// Service worker for the Eden browser tools.
//
// The tools genuinely do all their work on your device, so once the files are
// on the machine there is no reason to need a connection again. This makes that
// true: open a tool once and it will open again with the network off. Bookplate
// depends on it most, since a reading pile you cannot reach offline is not much
// of a reading pile.
//
// Strategy is stale-while-revalidate for same-origin GETs under /tools/: answer
// instantly from the cache, fetch a fresh copy in the background, and keep it
// for next time. Chosen deliberately over cache-first with a version number,
// because that would mean remembering to bump a constant on every deploy and
// stranding people on a stale build when someone forgets. Here a new deploy is
// picked up on the load after the first, with no ceremony.
//
// Nothing here talks to a server of ours. It only re-serves files already
// fetched from this origin.

// Bumped once, deliberately. The first version of this worker never passed its
// background revalidation to waitUntil, so any device that cached under it kept
// those files with no way to refresh them. Changing the name makes activate()
// delete the old cache outright, which is the only way to recover those devices.
// Routine updates do NOT need this: waitUntil handles them now.
const CACHE = "eden-tools-v2";

// The shared pieces every tool needs. Individual app files, engines and vendored
// libraries are picked up by use, which keeps the first visit light: precaching
// every tool's libraries would be several megabytes for one tool's visitor.
const CORE = [
  "./_license/gate.js",
  "./_license/verify.mjs",
  // The two sample files, so "try it with a sample" still works on a machine
  // that has been offline since before anyone pressed it. Five kilobytes between
  // them, which is worth it for the one button a first-time visitor reaches for.
  "./clearleaf/sample.docx",
  "./pagenook/sample.pdf",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .catch(() => {}) // a failed precache must never block installation
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  // Same origin only, and only the tools. The rest of the site is left alone.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.includes("/tools/")) return;

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const fresh = fetch(req)
          .then((res) => {
            // Only keep real successes. An error page cached in place of an app
            // file would be worse than no cache at all.
            if (res && res.ok && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);

        // Keep the worker alive until the refresh finishes. Without this the
        // browser is free to shut it down the moment the cached response is
        // returned, cancelling the fetch that updates the cache, and everyone
        // stays on the old build forever.
        e.waitUntil(fresh);

        // Cached copy wins on speed; the network copy refreshes it for next time.
        if (hit) return hit;
        return fresh.then((res) => res || new Response("Offline and not cached yet.", { status: 504, statusText: "Offline" }));
      }),
    ),
  );
});
