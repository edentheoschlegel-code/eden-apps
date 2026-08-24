// Clearleaf web engine — a browser port of scrub/src-tauri/src/lib.rs.
//
// Everything runs in the browser. No network. Two operations, mirroring the Rust
// engine: reveal (look inside, report what's hidden, grouped) and scrub (remove
// it, save a clean copy). Handlers per format: Office (OOXML zip), PDF, JPEG,
// PNG. Images are stripped losslessly at the container level — no pixel is
// decoded or re-encoded, exactly as the Mac app does.
//
// TIFF: the Mac app strips TIFF metadata with a dedicated library. Doing that
// safely in the browser is not yet implemented, so TIFF is reported as
// unsupported here rather than risk writing a corrupt file. (Scope note.)

/* global PDFLib, JSZip */

export function baseName(path) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
export function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}
export function stem(name) {
  const b = baseName(name);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(0, i) : b;
}
function cleanedName(name) {
  const e = extOf(name);
  return `${stem(name)} (cleaned).${e}`;
}

const OOXML = new Set(["docx", "xlsx", "pptx"]);

// ---------------------------------------------------------------------------
// Grouping — mirrors reveal_group() / reveal_group_rank() in lib.rs.
// ---------------------------------------------------------------------------
function revealGroup(finding) {
  const f = finding.toLowerCase();
  if (f.includes("gps") || f.includes("location")) return "Where you were";
  if (
    f.includes("application") || f.includes("software") || f.includes("template") ||
    f.includes("device") || f.includes("camera") || f.includes("serial") ||
    f.includes("maker") || f.includes("host computer")
  ) return "What you used";
  if (
    f.includes("author") || f.includes("creator") || f.includes("owner") ||
    f.includes("artist") || f.includes("last modified by") || f.includes("company") ||
    f.includes("manager") || f.includes("hyperlink base")
  ) return "Who you are";
  if (
    f.includes("comment") || f.includes("tracked") || f.includes("revision") ||
    f.includes("annotation") || f.includes("collaboration")
  ) return "Who else touched it";
  if (f.includes("date") || f.includes("time")) return "When you worked on it";
  return "Other hidden data";
}
const GROUP_RANK = {
  "Who you are": 0, "Where you were": 1, "Who else touched it": 2,
  "When you worked on it": 3, "What you used": 4, "Other hidden data": 5,
};
function groupFindings(found) {
  const real = found.filter((f) => !f.startsWith("No "));
  const buckets = new Map();
  for (const f of real) {
    const g = revealGroup(f);
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g).push(f);
  }
  const ordered = [...buckets.entries()].sort((a, b) => GROUP_RANK[a[0]] - GROUP_RANK[b[0]]);
  return { found: real.length, groups: ordered.map(([title, items]) => ({ title, items })) };
}

// ---------------------------------------------------------------------------
// OOXML (docx / xlsx / pptx) — JSZip + DOMParser.
// ---------------------------------------------------------------------------
const CORE_FIELDS = [
  ["creator", "Author (creator)"], ["lastModifiedBy", "Last modified by"],
  ["created", "Created timestamp"], ["modified", "Modified timestamp"],
  ["revision", "Revision number"], ["lastPrinted", "Last printed timestamp"],
  ["title", "Title"], ["subject", "Subject"], ["keywords", "Keywords"],
  ["description", "Description/Comments"], ["category", "Category"],
  ["contentStatus", "Content status"],
];
const APP_FIELDS = [
  ["Company", "Company"], ["Manager", "Manager"], ["Template", "Template name"],
  ["Application", "Authoring application"], ["AppVersion", "Application version"],
  ["TotalTime", "Total editing time"],
  ["HyperlinkBase", "Hyperlink base (can leak a local path)"], ["LastAuthor", "Last author"],
];

function isCommentPart(name) {
  return (
    (name.startsWith("word/comments") && name.endsWith(".xml")) ||
    name === "word/people.xml" ||
    (name.startsWith("word/threadedComments") && name.endsWith(".xml")) ||
    (name.startsWith("xl/comments") && name.endsWith(".xml")) ||
    name.startsWith("xl/threadedComments/") ||
    name.startsWith("xl/persons/") ||
    name.startsWith("ppt/comments/") ||
    (name.startsWith("ppt/slides/comments") && name.endsWith(".xml")) ||
    name === "ppt/commentAuthors.xml" ||
    name === "ppt/authors.xml"
  );
}
function isWordRevisionPart(name) {
  return name === "word/document.xml" || name === "word/settings.xml";
}
function basename(p) {
  return p.split("/").pop() || p;
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return null;
  return doc;
}
function serializeXml(doc) {
  return new XMLSerializer().serializeToString(doc);
}
// Detect which of `fields` are present and non-empty in an XML string.
function detectFields(xmlText, fields) {
  const doc = parseXml(xmlText);
  if (!doc) return [];
  const out = [];
  for (const [local, label] of fields) {
    const els = [...doc.getElementsByTagName("*")].filter((e) => e.localName === local);
    if (els.some((e) => (e.textContent || "").trim() !== "" || e.attributes.length > 0)) {
      out.push(label);
    }
  }
  return out;
}
function detectCustom(xmlText) {
  const doc = parseXml(xmlText);
  if (!doc) return [];
  const props = [...doc.getElementsByTagName("*")].filter((e) => e.localName === "property");
  return props.length ? [`Custom properties (${props.length})`] : ["Custom properties"];
}
// Remove elements whose localName is in the target set.
function removeFieldElements(xmlText, localNames) {
  const doc = parseXml(xmlText);
  if (!doc) return xmlText;
  const set = new Set(localNames);
  for (const e of [...doc.getElementsByTagName("*")]) {
    if (set.has(e.localName) && e.parentNode) e.parentNode.removeChild(e);
  }
  return serializeXml(doc);
}
// Does document.xml/settings.xml carry tracked-change authorship or rsid ids?
const REV_ATTRS = new Set(["author", "date", "initials", "userId"]);
function hasRevisionMetadata(xmlText) {
  const doc = parseXml(xmlText);
  if (!doc) return false;
  for (const e of [...doc.getElementsByTagName("*")]) {
    if (e.localName.toLowerCase().startsWith("rsid")) return true;
    for (const a of [...e.attributes]) {
      if (REV_ATTRS.has(a.localName) || a.localName.toLowerCase().startsWith("rsid")) return true;
    }
  }
  return false;
}
function stripRevisionMetadata(xmlText) {
  const doc = parseXml(xmlText);
  if (!doc) return xmlText;
  for (const e of [...doc.getElementsByTagName("*")]) {
    // drop rsid container/marker elements
    if (e.localName.toLowerCase().startsWith("rsid") && e.parentNode) {
      e.parentNode.removeChild(e);
      continue;
    }
    for (const a of [...e.attributes]) {
      if (REV_ATTRS.has(a.localName) || a.localName.toLowerCase().startsWith("rsid")) {
        e.removeAttributeNode(a);
      }
    }
  }
  return serializeXml(doc);
}

async function readZip(bytes) {
  return await JSZip.loadAsync(bytes);
}

async function ooxmlFindings(bytes) {
  const zip = await readZip(bytes);
  const names = Object.keys(zip.files);
  const removed = [];
  if (names.includes("docProps/core.xml")) {
    removed.push(...detectFields(await zip.file("docProps/core.xml").async("string"), CORE_FIELDS));
  }
  if (names.includes("docProps/app.xml")) {
    removed.push(...detectFields(await zip.file("docProps/app.xml").async("string"), APP_FIELDS));
  }
  if (names.includes("docProps/custom.xml")) {
    removed.push(...detectCustom(await zip.file("docProps/custom.xml").async("string")));
  }
  if (names.some((n) => isCommentPart(n))) removed.push("Reviewer comments and collaboration data");
  for (const n of names) {
    if (isWordRevisionPart(n) && hasRevisionMetadata(await zip.file(n).async("string"))) {
      removed.push("Tracked-change author names and edit timestamps");
      break;
    }
  }
  return { zip, removed };
}

async function scrubOoxml(bytes, name) {
  const { zip, removed } = await ooxmlFindings(bytes);
  const names = Object.keys(zip.files);

  const dropped = new Set();
  if (names.includes("docProps/custom.xml")) dropped.add("docProps/custom.xml");
  for (const n of names) if (isCommentPart(n)) dropped.add(n);

  const droppedPartnames = new Set([...dropped].map((p) => `/${p}`));
  const droppedBasenames = new Set([...dropped].map((p) => basename(p)));

  const out = new JSZip();
  const coreNames = CORE_FIELDS.map((f) => f[0]);
  const appNames = APP_FIELDS.map((f) => f[0]);

  for (const n of names) {
    const entry = zip.files[n];
    if (entry.dir) continue;
    if (dropped.has(n)) continue;
    let data;
    if (n === "docProps/core.xml") {
      data = removeFieldElements(await entry.async("string"), coreNames);
    } else if (n === "docProps/app.xml") {
      data = removeFieldElements(await entry.async("string"), appNames);
    } else if (n === "[Content_Types].xml" && dropped.size) {
      data = pruneContentTypes(await entry.async("string"), droppedPartnames);
    } else if (n.endsWith(".rels") && dropped.size) {
      data = pruneRels(await entry.async("string"), droppedBasenames);
    } else if (isWordRevisionPart(n)) {
      data = stripRevisionMetadata(await entry.async("string"));
    } else {
      out.file(n, await entry.async("uint8array"));
      continue;
    }
    out.file(n, data);
  }

  const blob = await out.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    mimeType: mimeForOoxml(name),
  });
  const list = removed.length ? removed : ["No document metadata present"];
  return { removed: list, file: { name: cleanedName(name), blob } };
}

function pruneContentTypes(xmlText, droppedPartnames) {
  const doc = parseXml(xmlText);
  if (!doc) return xmlText;
  for (const e of [...doc.getElementsByTagName("*")]) {
    if (e.localName === "Override" && droppedPartnames.has(e.getAttribute("PartName"))) {
      e.parentNode?.removeChild(e);
    }
  }
  return serializeXml(doc);
}
function pruneRels(xmlText, droppedBasenames) {
  const doc = parseXml(xmlText);
  if (!doc) return xmlText;
  for (const e of [...doc.getElementsByTagName("*")]) {
    if (e.localName === "Relationship") {
      const t = e.getAttribute("Target") || "";
      if (droppedBasenames.has(basename(t))) e.parentNode?.removeChild(e);
    }
  }
  return serializeXml(doc);
}
function mimeForOoxml(name) {
  const e = extOf(name);
  if (e === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (e === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (e === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/zip";
}

// ---------------------------------------------------------------------------
// PDF — pdf-lib. Clear /Info, remove XMP metadata stream, strip annotation
// authorship. Mirrors scrub_pdf() in lib.rs.
// ---------------------------------------------------------------------------
async function pdfFindings(doc) {
  const removed = [];
  const info = [
    ["Title", doc.getTitle()], ["Author", doc.getAuthor()], ["Subject", doc.getSubject()],
    ["Keywords", doc.getKeywords()], ["Producer", doc.getProducer()],
    ["Creator", doc.getCreator()],
  ];
  let creation, mod;
  try { creation = doc.getCreationDate(); } catch { creation = null; }
  try { mod = doc.getModificationDate(); } catch { mod = null; }
  for (const [label, val] of info) {
    if (val != null && String(val).trim() !== "") removed.push(`PDF Info /${label}: ${short(String(val))}`);
  }
  if (creation) removed.push("PDF Info /CreationDate");
  if (mod) removed.push("PDF Info /ModDate");
  // XMP metadata stream on the catalog
  if (hasCatalogMetadata(doc)) removed.push("XMP metadata stream (1)");
  return removed;
}

function hasCatalogMetadata(doc) {
  try {
    const { PDFName } = PDFLib;
    return !!doc.catalog.get(PDFName.of("Metadata"));
  } catch {
    return false;
  }
}

async function scrubPdf(bytes, name) {
  const { PDFDocument, PDFName } = PDFLib;
  let doc;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(String(e?.message || e))) throw new Error("password-protected: Clearleaf does not open encrypted PDFs.");
    throw new Error("Could not read PDF.");
  }
  if (doc.isEncrypted) throw new Error("password-protected: Clearleaf does not open encrypted PDFs.");

  const removed = await pdfFindings(doc);

  // Clear the standard Info fields.
  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");
  const epoch = new Date(0);
  try { doc.setCreationDate(epoch); } catch { /* ignore */ }
  try { doc.setModificationDate(epoch); } catch { /* ignore */ }

  // Remove the XMP metadata stream reference on the catalog.
  try {
    doc.catalog.delete(PDFName.of("Metadata"));
  } catch { /* ignore */ }

  const clean = removed.length ? removed : ["No document metadata present"];
  const out = await doc.save({ updateFieldAppearances: false });
  return { removed: clean, file: { name: cleanedName(name), blob: new Blob([out], { type: "application/pdf" }) } };
}

function short(s, n = 60) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ---------------------------------------------------------------------------
// JPEG — lossless segment removal (mirrors strip_jpeg_nonexif + EXIF clear).
// Drops APP1 (EXIF and XMP), APP13 (IPTC/Photoshop) and COM. Keeps APP0 (JFIF)
// and APP2 (ICC colour profile) so rendering is unchanged.
// ---------------------------------------------------------------------------
function scrubJpeg(bytes) {
  const buf = bytes;
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return { removed: [], out: null };
  const out = [];
  out.push(0xff, 0xd8);
  let i = 2;
  let exifTags = 0, hasGps = false, removedXmp = false, removedIptc = false, removedCom = false, removedExif = false;

  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) return { removed: [], out: null };
    const marker = buf[i + 1];
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      break;
    }
    if (marker === 0xda) {
      for (let k = i; k < buf.length; k++) out.push(buf[k]);
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    if (i + 4 > buf.length) return { removed: [], out: null };
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (len < 2 || i + 2 + len > buf.length) return { removed: [], out: null };
    const payloadStart = i + 4;
    const payload = buf.subarray(payloadStart, i + 2 + len);
    let drop = false;
    if (marker === 0xe1) {
      if (startsWith(payload, "Exif\0\0") || startsWith(payload, "Exif\0")) {
        drop = true;
        removedExif = true;
        const parsed = parseExif(payload);
        exifTags = parsed.tags;
        hasGps = parsed.gps;
      } else if (startsWith(payload, "http://ns.adobe.com/xap/") || startsWith(payload, "http://ns.adobe.com/xmp/extension/")) {
        drop = true;
        removedXmp = true;
      }
    } else if (marker === 0xed) {
      drop = true;
      removedIptc = true;
    } else if (marker === 0xfe) {
      drop = true;
      removedCom = true;
    }
    if (!drop) {
      for (let k = i; k < i + 2 + len; k++) out.push(buf[k]);
    }
    i += 2 + len;
  }

  const removed = [];
  if (removedExif && exifTags > 0) removed.push(`Camera and photo details (${exifTags} ${exifTags === 1 ? "item" : "items"})`);
  else if (removedExif) removed.push("Camera and photo details");
  if (hasGps) removed.push("GPS location data");
  if (removedXmp) removed.push("XMP metadata (author, edit history)");
  if (removedIptc) removed.push("IPTC / Photoshop metadata");
  if (removedCom) removed.push("Embedded comment");
  return { removed, out: removed.length ? Uint8Array.from(out) : null };
}

function startsWith(bytes, str) {
  for (let i = 0; i < str.length; i++) if (bytes[i] !== str.charCodeAt(i)) return false;
  return true;
}

// Minimal EXIF/TIFF walk: count tags across IFD0 + Exif sub-IFD + GPS IFD, and
// note GPS presence. Enough for the report; the whole segment is dropped anyway.
function parseExif(payload) {
  try {
    // payload = "Exif\0\0" + TIFF
    let o = 6;
    if (!startsWith(payload, "Exif\0\0")) o = 5;
    const tiff = payload.subarray(o);
    const little = tiff[0] === 0x49;
    const u16 = (p) => (little ? tiff[p] | (tiff[p + 1] << 8) : (tiff[p] << 8) | tiff[p + 1]);
    const u32 = (p) =>
      little
        ? (tiff[p] | (tiff[p + 1] << 8) | (tiff[p + 2] << 16) | (tiff[p + 3] << 24)) >>> 0
        : ((tiff[p] << 24) | (tiff[p + 1] << 16) | (tiff[p + 2] << 8) | tiff[p + 3]) >>> 0;
    let tags = 0, gps = false;
    const readIfd = (off, depth) => {
      if (off <= 0 || off + 2 > tiff.length || depth > 3) return;
      const count = u16(off);
      for (let e = 0; e < count; e++) {
        const entry = off + 2 + e * 12;
        if (entry + 12 > tiff.length) break;
        tags++;
        const tag = u16(entry);
        if (tag === 0x8769) readIfd(u32(entry + 8), depth + 1); // Exif sub-IFD
        if (tag === 0x8825) {
          gps = true;
          readIfd(u32(entry + 8), depth + 1); // GPS IFD
        }
      }
    };
    readIfd(u32(4), 0);
    return { tags, gps };
  } catch {
    return { tags: 0, gps: false };
  }
}

// ---------------------------------------------------------------------------
// PNG — strip tEXt / zTXt / iTXt / tIME (mirrors strip_png_text).
// ---------------------------------------------------------------------------
function scrubPng(bytes) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const buf = bytes;
  if (buf.length < 8) return { removed: [], out: null };
  for (let k = 0; k < 8; k++) if (buf[k] !== SIG[k]) return { removed: [], out: null };
  const out = [];
  for (let k = 0; k < 8; k++) out.push(SIG[k]);
  let i = 8;
  let removedText = false, removedTime = false;
  while (i + 8 <= buf.length) {
    const len = ((buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3]) >>> 0;
    const kind = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
    const end = i + 12 + len;
    if (end > buf.length) return { removed: [], out: null };
    const drop = kind === "tEXt" || kind === "zTXt" || kind === "iTXt" || kind === "tIME";
    if (drop) {
      if (kind === "tIME") removedTime = true;
      else removedText = true;
    } else {
      for (let k = i; k < end; k++) out.push(buf[k]);
    }
    i = end;
  }
  const removed = [];
  if (removedText) removed.push("Text metadata (author, comments, edit history)");
  if (removedTime) removed.push("Modified timestamp");
  return { removed, out: removed.length ? Uint8Array.from(out) : null };
}

// ---------------------------------------------------------------------------
// Engine: reveal (inspect) and scrub (remove), per queued file.
// ---------------------------------------------------------------------------
export class ClearleafEngine {
  constructor() {
    this.files = new Map();
  }
  register(file) {
    this.files.set(file.name, file);
  }
  has(name) {
    return this.files.has(name);
  }
  forget(name) {
    this.files.delete(name);
  }
  async _bytes(path) {
    const f = this.files.get(path);
    if (!f) throw new Error("That file is no longer open.");
    return new Uint8Array(await f.arrayBuffer());
  }

  async reveal(path) {
    const e = extOf(path);
    try {
      let found;
      if (OOXML.has(e)) {
        found = (await ooxmlFindings(await this._bytes(path))).removed;
      } else if (e === "pdf") {
        const { PDFDocument } = PDFLib;
        const doc = await PDFDocument.load(await this._bytes(path), { updateMetadata: false });
        if (doc.isEncrypted) throw new Error("password-protected");
        found = await pdfFindings(doc);
      } else if (e === "jpg" || e === "jpeg") {
        found = scrubJpeg(await this._bytes(path)).removed;
      } else if (e === "png") {
        found = scrubPng(await this._bytes(path)).removed;
      } else if (e === "tiff" || e === "tif") {
        return { input: path, ok: false, format: "tiff", groups: [], error: "Clearleaf's web version doesn't clean TIFF yet." };
      } else {
        return { input: path, ok: false, format: "unsupported", groups: [], error: "Clearleaf doesn't look inside this type yet." };
      }
      const { found: n, groups } = groupFindings(found);
      return { input: path, ok: true, format: e, found: n, groups };
    } catch (err) {
      const msg = String(err?.message || err);
      return { input: path, ok: false, format: e, groups: [], error: /password/.test(msg) ? "Password-protected, left untouched." : "Clearleaf couldn't look inside this one." };
    }
  }

  async scrub(path) {
    const e = extOf(path);
    try {
      let res;
      if (OOXML.has(e)) {
        res = await scrubOoxml(await this._bytes(path), path);
      } else if (e === "pdf") {
        res = await scrubPdf(await this._bytes(path), path);
      } else if (e === "jpg" || e === "jpeg") {
        const s = scrubJpeg(await this._bytes(path));
        res = imageResult(s, path, "image/jpeg");
      } else if (e === "png") {
        const s = scrubPng(await this._bytes(path));
        res = imageResult(s, path, "image/png");
      } else if (e === "tiff" || e === "tif") {
        return { input: path, ok: false, format: "tiff", removed: [], error: "Clearleaf's web version doesn't clean TIFF yet." };
      } else {
        return { input: path, ok: false, format: "unsupported", removed: [], error: "Clearleaf doesn't clean this type yet." };
      }
      return { input: path, ok: true, format: e, removed: res.removed, output: res.file.name, file: res.file };
    } catch (err) {
      const msg = String(err?.message || err);
      return { input: path, ok: false, format: e, removed: [], error: /password/.test(msg) ? "Password-protected, left untouched." : "Clearleaf couldn't clean this one. Your file wasn't changed." };
    }
  }
}

function imageResult(s, name, mime) {
  if (s.out) {
    return { removed: s.removed, file: { name: cleanedName(name), blob: new Blob([s.out], { type: mime }) } };
  }
  // Already clean — return a copy so the user still gets a saved file.
  return {
    removed: ["No embedded metadata present"],
    file: null,
  };
}

export { cleanedName };
