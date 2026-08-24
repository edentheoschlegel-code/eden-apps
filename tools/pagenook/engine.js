// Pagenook web engine — a browser port of leaflet/src-tauri/src/lib.rs.
//
// Everything runs in the browser. No network calls. PDFs are read with the File
// API, rearranged with pdf-lib, rendered to thumbnails with pdf.js, and written
// back as downloads. Behaviour mirrors the Rust engine: rotate composes onto the
// page's current rotation, delete refuses to remove every page, reorder demands a
// full permutation, split makes one file per page, merge concatenates in order.

/* global PDFLib */

// pdf.js is heavy (renderer + worker). Load it lazily, only when we actually
// draw thumbnails — the structural ops (rotate/split/merge/…) never need it.
let _pdfjs = null;
async function pdfjs() {
  if (_pdfjs) return _pdfjs;
  const mod = await import("../vendor/pdf.min.mjs");
  mod.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.mjs", import.meta.url).href;
  _pdfjs = mod;
  return mod;
}

export function baseName(path) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
export function stem(name) {
  const base = baseName(name);
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(0, i) : base;
}

// Load a File's bytes once and cache them per open document.
export class PagenookEngine {
  constructor() {
    this.files = new Map(); // name -> File
    this.bytes = new Map(); // name -> Uint8Array
  }
  register(file) {
    this.files.set(file.name, file);
    this.bytes.delete(file.name);
  }
  has(name) {
    return this.files.has(name);
  }
  forget(name) {
    this.files.delete(name);
    this.bytes.delete(name);
  }
  async _bytes(path) {
    if (this.bytes.has(path)) return this.bytes.get(path);
    const f = this.files.get(path);
    if (!f) throw new Error("That file is no longer open.");
    const b = new Uint8Array(await f.arrayBuffer());
    this.bytes.set(path, b);
    return b;
  }
  async _load(path) {
    const bytes = await this._bytes(path);
    let doc;
    try {
      doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (e) {
      const msg = String(e?.message || e);
      if (/encrypt/i.test(msg)) throw new Error("password-protected");
      throw new Error("couldn't read this PDF");
    }
    if (doc.isEncrypted) throw new Error("password-protected");
    return doc;
  }

  async analyze(path) {
    const doc = await this._load(path);
    return { path, pages: doc.getPageCount() };
  }

  // Render page thumbnails with pdf.js. maxPx bounds the longest side.
  async pageThumbnails(path, maxPx = 200) {
    const pdfjsLib = await pdfjs();
    const bytes = await this._bytes(path);
    // pdf.js consumes the buffer; give it a copy so pdf-lib's stays intact.
    const task = pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false });
    let pdf;
    try {
      pdf = await task.promise;
    } catch (e) {
      const msg = String(e?.message || e);
      if (/password/i.test(msg)) throw new Error("password-protected");
      throw new Error("Couldn't draw the pages for this PDF. You can still use the operations below.");
    }
    const thumbs = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = maxPx / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      thumbs.push({ page: n, image: canvas.toDataURL("image/png"), wide: viewport.width > viewport.height });
      page.cleanup();
    }
    await pdf.destroy();
    return thumbs;
  }

  async _blobFrom(doc, name) {
    const out = await doc.save();
    return { name, blob: new Blob([out], { type: "application/pdf" }) };
  }

  // rotate every page by a delta, composing onto its current rotation.
  async rotate(path, degrees) {
    const doc = await this._load(path);
    const pages = doc.getPages();
    for (const p of pages) {
      const cur = p.getRotation().angle || 0;
      const next = (((cur + degrees) % 360) + 360) % 360;
      p.setRotation(PDFLib.degrees(next));
    }
    const file = await this._blobFrom(doc, `${stem(path)} (rotated).pdf`);
    return { files: [file], output: file.name, pages: pages.length };
  }

  // remove the given 1-based pages; refuse duplicates/out-of-range inflation
  // and refuse removing every page. Mirrors delete() in lib.rs.
  async remove(path, pageList) {
    const src = await this._load(path);
    const total = src.getPageCount();
    let wanted = [...new Set(pageList.filter((p) => p >= 1 && p <= total))].sort((a, b) => a - b);
    if (!wanted.length) throw new Error("Choose at least one page to remove.");
    if (wanted.length >= total) throw new Error("That would remove every page.");
    const keep = [];
    for (let i = 1; i <= total; i++) if (!wanted.includes(i)) keep.push(i - 1);
    const out = await PDFLib.PDFDocument.create();
    const copied = await out.copyPages(src, keep);
    copied.forEach((p) => out.addPage(p));
    const file = await this._blobFrom(out, `${stem(path)} (edited).pdf`);
    return { files: [file], output: file.name, pages: keep.length, removed: total - keep.length };
  }

  // order is 1-based original page numbers, a full permutation of 1..N.
  async reorder(path, order) {
    const src = await this._load(path);
    const total = src.getPageCount();
    if (order.length !== total) {
      throw new Error(
        `That order lists ${order.length} of ${total} pages. Every page has to appear exactly once.`,
      );
    }
    const seen = [...new Set(order)].sort((a, b) => a - b);
    if (seen.length !== total || seen[0] !== 1 || seen[seen.length - 1] !== total) {
      throw new Error("Every page has to appear exactly once in the new order.");
    }
    const out = await PDFLib.PDFDocument.create();
    const copied = await out.copyPages(src, order.map((n) => n - 1));
    copied.forEach((p) => out.addPage(p));
    const file = await this._blobFrom(out, `${stem(path)} (reordered).pdf`);
    return { files: [file], output: file.name, pages: total };
  }

  // one single-page PDF per page.
  async split(path) {
    const src = await this._load(path);
    const total = src.getPageCount();
    const files = [];
    for (let p = 1; p <= total; p++) {
      const out = await PDFLib.PDFDocument.create();
      const [pg] = await out.copyPages(src, [p - 1]);
      out.addPage(pg);
      files.push(await this._blobFrom(out, `${stem(path)} (page ${p}).pdf`));
    }
    return { files, pages: total };
  }

  // concatenate every page of every file, in order.
  async merge(paths) {
    if (paths.length < 2) throw new Error("Pick at least two PDFs to merge.");
    const out = await PDFLib.PDFDocument.create();
    let pageCount = 0;
    for (const path of paths) {
      const src = await this._load(path);
      const idx = src.getPageIndices();
      const copied = await out.copyPages(src, idx);
      copied.forEach((p) => out.addPage(p));
      pageCount += idx.length;
    }
    const file = await this._blobFrom(out, "Merged.pdf");
    return { files: [file], output: file.name, pages: pageCount };
  }
}
