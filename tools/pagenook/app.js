// Pagenook web — UI, a faithful browser rendering of leaflet/src/App.tsx.
// Vanilla JS + the shared engine (pdf-lib + pdf.js). No framework, no network.

import { PagenookEngine, baseName } from "./engine.js";

const engine = new PagenookEngine();
const fmt = (n) => n.toLocaleString();

const state = {
  files: [], // { path, pages? }  pages: -1 protected, -2 unreadable
  results: null,
  busy: false,
  over: false,
  error: null,
  angle: 90,
  delPages: "",
  board: null, // [{page, image, wide}]
  boardBusy: false,
  boardNote: null,
  picked: new Set(),
  savedNote: null,
};

const root = document.getElementById("app");
const picker = document.getElementById("picker");
// drag bookkeeping (pointer-based)
let dragFrom = null;
let dragMoved = false;
let dragOver = null;

function set(patch) {
  Object.assign(state, patch);
  render();
}

async function addFiles(fileList) {
  const pdfs = [...fileList].filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  if (!pdfs.length) return;
  const seen = new Set(state.files.map((f) => f.path));
  const fresh = [];
  for (const f of pdfs) {
    engine.register(f);
    if (!seen.has(f.name)) fresh.push({ path: f.name });
  }
  set({ results: null, error: null, savedNote: null, picked: new Set(), files: [...state.files, ...fresh] });
  refreshBoard();
  for (const f of pdfs) {
    engine
      .analyze(f.name)
      .then((info) => {
        state.files = state.files.map((q) => (q.path === f.name ? { ...q, pages: info.pages } : q));
        render();
      })
      .catch((e) => {
        const isProtected = String(e?.message || e).includes("password-protected");
        state.files = state.files.map((q) =>
          q.path === f.name ? { ...q, pages: isProtected ? -1 : -2 } : q,
        );
        refreshBoard();
        render();
      });
  }
}

picker.addEventListener("change", () => {
  if (picker.files?.length) addFiles(picker.files);
  picker.value = "";
});
function openPicker() {
  picker.click();
}

async function trySample() {
  try {
    const res = await fetch("./sample.pdf");
    if (!res.ok) throw new Error("no sample");
    const blob = await res.blob();
    await addFiles([new File([blob], "Sample.pdf", { type: "application/pdf" })]);
  } catch {
    set({ error: "Couldn't open the sample." });
  }
}

// draw the board whenever exactly one readable PDF is queued
let boardToken = 0;
function refreshBoard() {
  state.picked = new Set();
  const only = state.files.length === 1 ? state.files[0] : null;
  if (!only || only.pages === -1 || only.pages === -2) {
    state.board = null;
    state.boardBusy = false;
    state.boardNote = null;
    return;
  }
  const token = ++boardToken;
  state.board = null;
  state.boardNote = null;
  state.boardBusy = true;
  engine
    .pageThumbnails(only.path, 200)
    .then((t) => {
      if (token !== boardToken) return;
      state.board = t;
      state.boardBusy = false;
      render();
    })
    .catch((e) => {
      if (token !== boardToken) return;
      state.board = null;
      state.boardBusy = false;
      state.boardNote =
        String(e?.message || e) ||
        "Couldn't draw the pages for this PDF. You can still use the operations below.";
      render();
    });
}

// ---- output ----------------------------------------------------------------
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function run(op) {
  if (state.busy) return;
  set({ busy: true, error: null, savedNote: null });
  try {
    const receipts = await op();
    set({ busy: false, results: receipts });
  } catch (e) {
    set({ busy: false, error: friendly(e) });
  }
}

function perFile(fn) {
  return async () => {
    const out = [];
    for (const f of state.files) out.push(await fn(f));
    return out;
  };
}

function friendly(e) {
  if (typeof e === "string") return e;
  if (e && typeof e.message === "string") return e.message;
  return "Something interrupted that. Your files weren't changed.";
}

const reordered = () => !!state.board && state.board.some((t, i) => t.page !== i + 1);

async function doReorder() {
  const f = state.files[0];
  if (!f || !state.board) return [];
  try {
    const r = await engine.reorder(f.path, state.board.map((t) => t.page));
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    return [{ ok: true, title: baseName(f.path), detail: `Saved in the new order, ${r.pages} pages`, files: r.files }];
  } catch (e) {
    return [{ ok: false, title: baseName(f.path), detail: friendly(e) }];
  }
}

const doSplit = perFile(async (f) => {
  try {
    const r = await engine.split(f.path);
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    return { ok: true, title: baseName(f.path), detail: `Split into ${r.files.length} single-page files`, files: r.files };
  } catch (e) {
    return { ok: false, title: baseName(f.path), detail: friendly(e) };
  }
});

const doRotate = perFile(async (f) => {
  try {
    const r = await engine.rotate(f.path, state.angle);
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    return { ok: true, title: baseName(f.path), detail: `Rotated ${r.pages} ${r.pages === 1 ? "page" : "pages"} by ${state.angle}°`, files: r.files };
  } catch (e) {
    return { ok: false, title: baseName(f.path), detail: friendly(e) };
  }
});

const doRemove = perFile(async (f) => {
  const pages = state.board
    ? [...state.picked].sort((a, b) => a - b)
    : state.delPages.split(",").map((s) => parseInt(s.trim())).filter((n) => n > 0);
  try {
    const r = await engine.remove(f.path, pages);
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    const removed = r.removed ?? pages.length;
    return { ok: true, title: baseName(f.path), detail: `Removed ${removed}, ${r.pages} ${r.pages === 1 ? "page" : "pages"} left`, files: r.files };
  } catch (e) {
    return { ok: false, title: baseName(f.path), detail: friendly(e) };
  }
});

async function doMerge() {
  try {
    const r = await engine.merge(state.files.map((f) => f.path));
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    return [{ ok: true, title: r.output, detail: `Merged ${state.files.length} PDFs into ${r.pages} pages`, files: r.files }];
  } catch (e) {
    return [{ ok: false, title: "Merge", detail: friendly(e) }];
  }
}

function startOver() {
  set({ files: [], results: null, error: null, delPages: "", savedNote: null, board: null, boardNote: null, picked: new Set() });
}

// ---- board interaction (pointer drag + click to pick) ----------------------
function indexUnder(x, y) {
  const el = document.elementFromPoint(x, y);
  const card = el?.closest("[data-thumb-index]");
  if (!card) return null;
  const n = Number(card.dataset.thumbIndex);
  return Number.isFinite(n) ? n : null;
}
function togglePage(n) {
  const next = new Set(state.picked);
  next.has(n) ? next.delete(n) : next.add(n);
  state.picked = next;
  render();
}
function moveCard(from, to) {
  if (from === to || !state.board) return;
  const next = [...state.board];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  state.board = next;
  render();
}

// ---- dom helper ------------------------------------------------------------
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return n;
}

function render() {
  root.replaceChildren(header(), body(), footer());
}

function header() {
  return el(
    "header",
    { class: "topbar" },
    el(
      "div",
      { class: "brand" },
      el("img", { class: "brand-icon", src: "icon.png", alt: "", width: "26", height: "26" }),
      el("span", { class: "brand-name" }, "Pagenook"),
      el("span", { class: "brand-tag" }, "Rearrange your PDFs"),
    ),
    el("span", { class: "chip", title: "Nothing is uploaded." }, "Runs on your device"),
  );
}

function body() {
  const main = el("main", { class: "body" });
  main.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!state.over) set({ over: true });
  });
  main.addEventListener("dragleave", (e) => {
    if (e.target === main) set({ over: false });
  });
  main.addEventListener("drop", (e) => {
    e.preventDefault();
    set({ over: false });
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  if (state.results) {
    main.append(resultsView());
    return main;
  }

  main.append(dropZone());
  if (state.files.length === 0)
    main.append(el("button", { class: "try-sample", onclick: trySample }, "Or try it with a sample PDF"));
  if (state.savedNote) main.append(el("div", { class: "undone" }, state.savedNote + " Your originals are untouched."));
  if (state.files.length > 0) {
    main.append(queue());
    if (state.boardBusy) main.append(el("div", { class: "board-wait" }, "Drawing the pages…"));
    if (state.boardNote) main.append(el("div", { class: "board-wait" }, state.boardNote));
    if (state.board) main.append(boardView());
    main.append(ops());
  }
  if (state.busy) main.append(el("div", { class: "working" }, "Working…"));
  if (state.error) main.append(el("div", { class: "error" }, state.error));
  return main;
}

function dropZone() {
  return el(
    "div",
    { class: "dropzone" + (state.over ? " over" : "") },
    el("div", {
      class: "dz-icon",
      html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="12" height="16" rx="1.5"/><path d="M4.5 6v13a1.5 1.5 0 0 0 1.5 1.5h9"/><path d="M10.5 8h5M10.5 11h5M10.5 14h3"/></svg>`,
    }),
    el("div", { class: "dz-title" }, "Rearrange a PDF"),
    el(
      "div",
      { class: "dz-sub" },
      "Drop PDF files here to merge, split, rotate, or remove pages. A fresh copy is downloaded for each. Your originals stay as they are, and nothing leaves your device.",
    ),
    el("button", { class: "dz-cta", onclick: openPicker }, "Choose files"),
    el("div", { class: "dz-hint" }, "Works with PDF files. Password-protected PDFs are left untouched."),
  );
}

function queue() {
  return el(
    "section",
    { class: "queue" },
    ...state.files.map((f) =>
      el(
        "div",
        { class: "qrow" },
        el("span", { class: "qkind" }, "PDF"),
        el("span", { class: "qname" }, baseName(f.path)),
        el(
          "span",
          { class: "qmeta" },
          f.pages == null
            ? ""
            : f.pages === -1
              ? "protected"
              : f.pages === -2
                ? "couldn't read this PDF"
                : `${fmt(f.pages)} pages`,
        ),
        el(
          "button",
          {
            class: "qx",
            title: "Remove",
            onclick: () => {
              engine.forget(f.path);
              state.files = state.files.filter((x) => x.path !== f.path);
              refreshBoard();
              render();
            },
          },
          "×",
        ),
      ),
    ),
  );
}

function boardView() {
  const b = state.board;
  const title = state.picked.size
    ? `${state.picked.size} of ${b.length} ${b.length === 1 ? "page" : "pages"} picked`
    : reordered()
      ? "New order, not saved yet"
      : `${b.length} ${b.length === 1 ? "page" : "pages"}. Click to pick, drag to move`;

  const grid = el("div", { class: "board-grid" });
  b.forEach((t, i) => {
    const card = el(
      "button",
      {
        "data-thumb-index": String(i),
        class:
          "thumb" +
          (state.picked.has(t.page) ? " picked" : "") +
          (dragOver === i && dragFrom !== null && dragFrom !== i ? " over" : ""),
        "aria-pressed": state.picked.has(t.page) ? "true" : "false",
        title: `Page ${t.page}. Click to pick, drag to move`,
      },
      el("img", { src: t.image, alt: "", draggable: "false" }),
      el("span", { class: "thumb-n" }, String(t.page)),
    );
    card.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragFrom = i;
      dragMoved = false;
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener("pointermove", (e) => {
      if (dragFrom === null) return;
      dragMoved = true;
      const over = indexUnder(e.clientX, e.clientY);
      if (over !== dragOver) {
        dragOver = over;
        render();
      }
    });
    card.addEventListener("pointerup", (e) => {
      const from = dragFrom;
      dragFrom = null;
      const wasOver = dragOver;
      dragOver = null;
      if (from === null) return;
      const to = indexUnder(e.clientX, e.clientY);
      if (!dragMoved || to === null || to === from) {
        togglePage(b[i].page);
        return;
      }
      moveCard(from, to);
      void wasOver;
    });
    grid.append(card);
  });

  return el(
    "section",
    { class: "board" },
    el(
      "div",
      { class: "board-head" },
      el("span", { class: "board-title" }, title),
      el(
        "span",
        { class: "board-actions" },
        reordered()
          ? el("button", { class: "board-save", disabled: state.busy, onclick: () => run(doReorder) }, "Save new order")
          : null,
        state.picked.size > 0
          ? el("button", { class: "board-clear", onclick: () => set({ picked: new Set() }) }, "Clear")
          : null,
      ),
    ),
    grid,
  );
}

function ops() {
  const validDel = state.delPages.split(",").map((s) => parseInt(s.trim())).some((n) => n > 0);
  return el(
    "section",
    { class: "ops" },
    el(
      "div",
      { class: "op" },
      el(
        "div",
        { class: "op-label" },
        "Merge all into one ",
        state.files.length < 2 ? el("span", { class: "dim" }, "(needs 2+)") : null,
      ),
      el("button", { class: "op-go", disabled: state.busy || state.files.length < 2, onclick: () => run(doMerge) }, "Merge"),
    ),
    el(
      "div",
      { class: "op" },
      el("div", { class: "op-label" }, "Split into single pages"),
      el("button", { class: "op-go", disabled: state.busy, onclick: () => run(doSplit) }, "Split"),
    ),
    el(
      "div",
      { class: "op" },
      el(
        "div",
        { class: "op-label" },
        "Rotate ",
        el(
          "span",
          { class: "seg" },
          ...[90, 180, 270].map((a) =>
            el("button", { class: state.angle === a ? "on" : "", onclick: () => set({ angle: a }) }, `${a}°`),
          ),
        ),
      ),
      el("button", { class: "op-go", disabled: state.busy, onclick: () => run(doRotate) }, "Rotate"),
    ),
    el(
      "div",
      { class: "op" },
      el(
        "div",
        { class: "op-label" },
        "Remove pages ",
        state.board
          ? el(
              "span",
              { class: "dim" },
              state.picked.size ? `pages ${[...state.picked].sort((a, b) => a - b).join(", ")}` : "pick some above",
            )
          : el("input", {
              class: "num wide",
              placeholder: "e.g. 1, 3, 5",
              value: state.delPages,
              oninput: (e) => {
                state.delPages = e.target.value;
              },
            }),
      ),
      el(
        "button",
        {
          class: "op-go",
          disabled: state.busy || (state.board ? state.picked.size === 0 : !validDel),
          onclick: () => run(doRemove),
        },
        "Remove",
      ),
    ),
  );
}

function resultsView() {
  const okCount = state.results.filter((r) => r.ok).length;
  return el(
    "section",
    { class: "results" },
    el(
      "div",
      { class: "results-head" },
      el(
        "div",
        { class: "results-title" },
        okCount === state.results.length ? "Done" : `Done: ${okCount} of ${state.results.length}`,
      ),
      el("div", {}, el("button", { class: "ghost", onclick: startOver }, "Start over")),
    ),
    el(
      "div",
      { class: "cards" },
      ...state.results.map((r) =>
        el(
          "div",
          { class: "card" + (r.ok ? "" : " card-skip") },
          el(
            "div",
            { class: "card-top" },
            el("span", { class: "tick " + (r.ok ? "ok" : "no"), "aria-hidden": true }, r.ok ? "✓" : "!"),
            el("span", { class: "card-name" }, r.title),
          ),
          el("div", { class: "card-note" }, r.detail),
          r.files && r.files.length > 1
            ? el("div", { class: "mini" }, r.files.map((o) => o.name).join(" · "))
            : null,
        ),
      ),
    ),
    el("div", { class: "note-soft" }, "Saved files land in your downloads folder."),
  );
}

function footer() {
  return el(
    "footer",
    { class: "footbar" },
    "Everything happens on your device. Nothing is uploaded. · ",
    el("a", { href: "https://edenapps.app/privacy.html", target: "_blank", rel: "noreferrer" }, "Privacy Policy"),
  );
}

render();
