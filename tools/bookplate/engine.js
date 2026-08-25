// Bookplate web engine — a browser-only reading library.
//
// This is the browser-only variant (Eden's decision, 2026-08-14): unlike the Mac
// app, it does NOT fetch webpages — a browser can't fetch arbitrary sites
// cross-origin, and fetching through a server would break the "nothing leaves
// your device" promise the other tools keep. Instead you ADD articles by
// importing a saved .html page (cleaned with Mozilla Readability, the same
// extraction the Mac reader uses), importing a .txt file, or pasting text. The
// library lives in IndexedDB on this device. Reading, read-aloud and the trash
// all work offline.
//
// Data model mirrors trove/src-tauri/src/lib.rs: { id, url, title, byline,
// excerpt, content_html, saved_at, deleted }.

/* global Readability */

const DB_NAME = "bookplate";
const STORE = "articles";
const MAX_CONTENT_BYTES = 5_000_000;

export function nowSecs() {
  return Math.floor(Date.now() / 1000);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("saved_at", "saved_at");
        store.createIndex("deleted", "deleted");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}
function reqP(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class BookplateLibrary {
  constructor() {
    this._db = null;
  }
  async db() {
    if (!this._db) this._db = await openDb();
    return this._db;
  }

  // Save a new article (or replace by id). Returns the stored record.
  async save({ url = "", title, byline = null, excerpt = null, content_html }) {
    if (!content_html || !content_html.trim()) {
      throw new Error("Couldn't find anything readable here, so nothing was saved.");
    }
    if (content_html.length > MAX_CONTENT_BYTES) {
      throw new Error("That article is too large to save.");
    }
    const rec = {
      url,
      title: (title && title.trim()) || "Untitled",
      byline,
      excerpt: excerpt || makeExcerpt(content_html),
      content_html,
      saved_at: nowSecs(),
      deleted: 0,
    };
    const db = await this.db();
    const id = await reqP(tx(db, "readwrite").add(rec));
    return { ...rec, id };
  }

  async list({ deleted = 0 } = {}) {
    const db = await this.db();
    const all = await reqP(tx(db, "readonly").getAll());
    return all
      .filter((a) => (a.deleted ? 1 : 0) === deleted)
      .sort((a, b) => b.saved_at - a.saved_at)
      .map(summary);
  }

  async get(id) {
    const db = await this.db();
    const a = await reqP(tx(db, "readonly").get(id));
    if (!a) throw new Error("That article isn't in your library.");
    return a;
  }

  async setDeleted(id, deleted) {
    const db = await this.db();
    const store = tx(db, "readwrite");
    const a = await reqP(store.get(id));
    if (!a) return;
    a.deleted = deleted ? 1 : 0;
    await reqP(store.put(a));
  }
  delete(id) {
    return this.setDeleted(id, 1);
  }
  restore(id) {
    return this.setDeleted(id, 0);
  }
  async purge(id) {
    const db = await this.db();
    await reqP(tx(db, "readwrite").delete(id));
  }

  // Everything in the library, including the trash, as one plain object. This is
  // the only way out: the web version keeps articles in the browser's storage,
  // so clearing site data would otherwise delete them with no copy anywhere.
  // Getting your own writing back is never gated.
  async exportAll() {
    const db = await this.db();
    const all = await reqP(tx(db, "readonly").getAll());
    return {
      format: "bookplate-library",
      version: 1,
      saved_at: nowSecs(),
      articles: all.map((a) => ({
        url: a.url || "",
        title: a.title,
        byline: a.byline ?? null,
        excerpt: a.excerpt ?? null,
        content_html: a.content_html,
        saved_at: a.saved_at,
        deleted: a.deleted ? 1 : 0,
      })),
    };
  }

  // Restore from the object above. Adds to whatever is already here rather than
  // replacing it, so a restore can never quietly wipe a library someone has
  // added to since. Returns how many came back.
  async importBackup(obj) {
    if (!obj || obj.format !== "bookplate-library" || !Array.isArray(obj.articles)) {
      throw new Error("That isn't a Bookplate library file.");
    }
    const db = await this.db();
    let added = 0;
    for (const a of obj.articles) {
      if (!a || !a.content_html) continue;
      await reqP(
        tx(db, "readwrite").add({
          url: a.url || "",
          title: (a.title && String(a.title).trim()) || "Untitled",
          byline: a.byline ?? null,
          excerpt: a.excerpt || makeExcerpt(a.content_html),
          content_html: a.content_html,
          saved_at: Number(a.saved_at) || nowSecs(),
          deleted: a.deleted ? 1 : 0,
        }),
      );
      added++;
    }
    return added;
  }

  async count() {
    const db = await this.db();
    const all = await reqP(tx(db, "readonly").getAll());
    return {
      library: all.filter((a) => !a.deleted).length,
      trash: all.filter((a) => a.deleted).length,
    };
  }
}

function summary(a) {
  return { id: a.id, url: a.url, title: a.title, byline: a.byline, excerpt: a.excerpt, saved_at: a.saved_at };
}

function makeExcerpt(html) {
  const text = htmlToText(html).replace(/\s+/g, " ").trim();
  return text.length > 200 ? text.slice(0, 199) + "…" : text;
}

export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body ? doc.body.textContent || "" : "";
}

// ---------------------------------------------------------------------------
// Import: turn a source (HTML file, text file, or pasted text) into an article.
// ---------------------------------------------------------------------------

// Extract a clean article from a full HTML page with Mozilla Readability.
export function extractFromHtml(htmlString, sourceUrl = "") {
  const doc = new DOMParser().parseFromString(htmlString, "text/html");
  // Give Readability a base URL if we have one, so relative links resolve.
  if (sourceUrl) {
    const base = doc.createElement("base");
    base.href = sourceUrl;
    doc.head?.appendChild(base);
  }
  let parsed = null;
  try {
    parsed = new Readability(doc.cloneNode(true)).parse();
  } catch {
    parsed = null;
  }
  if (parsed && parsed.content && htmlToText(parsed.content).trim()) {
    return {
      url: sourceUrl,
      title: parsed.title || doc.title || "Untitled",
      byline: parsed.byline || null,
      excerpt: parsed.excerpt || null,
      content_html: sanitize(parsed.content),
    };
  }
  // Fallback: take the body text if Readability found nothing.
  const bodyText = (doc.body?.textContent || "").trim();
  if (!bodyText) throw new Error("Couldn't find anything readable in that page.");
  return {
    url: sourceUrl,
    title: doc.title || "Untitled",
    byline: null,
    excerpt: null,
    content_html: paragraphsFromText(bodyText),
  };
}

export function articleFromText(text, title) {
  const clean = (text || "").trim();
  if (!clean) throw new Error("Nothing to save. The text was empty.");
  return {
    url: "",
    title: (title && title.trim()) || firstLineTitle(clean),
    byline: null,
    excerpt: null,
    content_html: paragraphsFromText(clean),
  };
}

function firstLineTitle(text) {
  const line = text.split("\n").find((l) => l.trim()) || "Untitled";
  return line.trim().slice(0, 90);
}
function paragraphsFromText(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Strip scripts/handlers/styles from extracted content before we store & render.
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((n) => n.remove());
  for (const el of doc.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }
  return doc.body ? doc.body.innerHTML : html;
}

// Build the sandboxed reader document.
export function readerDoc(a) {
  const title = escapeHtml(a.title || "Untitled");
  const byline = a.byline ? `<p class="byline">${escapeHtml(a.byline)}</p>` : "";
  const src = a.url ? `<p class="src"><a href="${escapeHtml(a.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(a.url)}</a></p>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root{color-scheme:light dark}
    body{font:17px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Georgia,serif;max-width:44rem;margin:0 auto;padding:32px 24px 64px;color:#1a1a1f;background:#fff}
    @media(prefers-color-scheme:dark){body{color:#e8e8ee;background:#14151b}}
    h1{font-size:28px;line-height:1.25;margin:0 0 4px}
    .byline{color:#888;margin:0 0 2px}
    .src{font-size:12px}.src a{color:#6b6df0}
    img{max-width:100%;height:auto}
    a{color:#4338ca}@media(prefers-color-scheme:dark){a{color:#8b83f0}}
    pre{overflow:auto;background:rgba(127,127,127,.12);padding:12px;border-radius:8px}
    hr{border:0;border-top:1px solid rgba(127,127,127,.25);margin:24px 0}
  </style></head><body><h1>${title}</h1>${byline}${src}<hr>${a.content_html}</body></html>`;
}

// Plain speakable text for read-aloud.
export function speakableText(html) {
  return htmlToText(html).replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

export const SAMPLE = {
  url: "",
  title: "On keeping a reading pile",
  byline: "The Bookplate sample",
  excerpt: "A short note about saving things to read when there's time, and why a calm pile beats an anxious feed.",
  content_html: `
    <p>There is a particular kind of calm in a reading pile that asks nothing of you. It does not notify. It does not reorder itself overnight to show you what is new. It simply waits.</p>
    <p>Bookplate is that pile, kept on your own device. You add something worth reading, and it stays: offline, unchanged, yours to open when there is time.</p>
    <h2>Read it later, actually later</h2>
    <p>The promise of "read it later" only works if later is a real place. Here it is: a quiet list, a clean reader, and nothing between you and the words.</p>
    <p>Have it read aloud while you cook. Come back to it on a train with no signal. Move it to the trash when you are done, and take it back out if you were not.</p>
    <p>Nothing here leaves your device. That is the whole idea.</p>`,
};
