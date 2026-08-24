// Furrow web — UI, a faithful browser rendering of winnow/src/App.tsx.
// Vanilla JS + the shared engine. No framework, no network.

import {
  FurrowEngine,
  baseName,
  extOf,
  sampleFile,
} from "./engine.js";
import { ensureLicensed } from "../_license/gate.js";

const ACCEPT = ["csv", "tsv", "txt", "xlsx", "xlsm", "xls", "ods"];
const engine = new FurrowEngine();
const fmt = (n) => n.toLocaleString();

// ---- state -----------------------------------------------------------------
const state = {
  files: [], // { path, kind, rows?, cols?, sheets? }
  results: null, // Receipt[] | null
  busy: false,
  over: false,
  error: null,
  splitRows: 1000,
  convertTo: "xlsx",
  preview: null,
  previewNote: null,
  sheet: null,
  steps: [], // { kind:'trim', column }
  picked: new Set(),
  savedNote: null,
};

const root = document.getElementById("app");
const picker = document.getElementById("picker");

function set(patch) {
  Object.assign(state, patch);
  render();
}

// ---- file intake -----------------------------------------------------------
async function addFiles(fileList) {
  const incoming = [...fileList];
  const accepted = incoming.filter((f) => ACCEPT.includes(extOf(f.name)));
  if (!accepted.length) {
    if (incoming.length)
      set({ error: "Furrow works with CSV and Excel files, so that one was skipped." });
    return;
  }
  const seen = new Set(state.files.map((f) => f.path));
  const fresh = [];
  for (const f of accepted) {
    engine.register(f);
    if (!seen.has(f.name)) fresh.push({ path: f.name, kind: "…" });
  }
  set({
    results: null,
    error: null,
    steps: [],
    picked: new Set(),
    savedNote: null,
    files: [...state.files, ...fresh],
  });
  refreshPreview();
  for (const f of accepted) {
    engine
      .analyze(f.name)
      .then((info) => {
        state.files = state.files.map((q) => (q.path === f.name ? { ...q, ...info } : q));
        render();
      })
      .catch(() => {});
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
    await addFiles([sampleFile()]);
  } catch (e) {
    set({ error: friendly(e) });
  }
}

// ---- preview (runs whenever exactly one file is queued) ---------------------
let previewToken = 0;
function refreshPreview() {
  const only = state.files.length === 1 ? state.files[0] : null;
  if (!only) {
    state.preview = null;
    state.previewNote = null;
    state.sheet = null;
    return;
  }
  const token = ++previewToken;
  engine
    .previewTable(only.path, state.sheet, 200, state.steps)
    .then((p) => {
      if (token !== previewToken) return;
      state.preview = p;
      state.previewNote = null;
      if (!state.sheet) state.sheet = p.sheet;
      render();
    })
    .catch((e) => {
      if (token !== previewToken) return;
      state.preview = null;
      state.previewNote = typeof e?.message === "string" ? e.message : "Couldn't show this file's contents.";
      render();
    });
}

// ---- operations ------------------------------------------------------------
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
  // Working the file is free; keeping the result is what needs a licence.
  // Asked here rather than at the door, so the preview above has already shown
  // this file's own columns before anyone is asked for anything.
  if (!(await ensureLicensed())) return;
  set({ busy: true, error: null, savedNote: null });
  try {
    const receipts = await op();
    set({ busy: false, results: receipts });
  } catch (e) {
    set({ busy: false, error: friendly(e) });
  }
}

// each op returns Receipt[]: { ok, title, detail, files?:[{name,blob}] }
function perFile(fn) {
  return async () => {
    const out = [];
    for (const f of state.files) out.push(await fn(f));
    return out;
  };
}

const doSplit = perFile(async (f) => {
  try {
    const r = await engine.split(f.path, state.splitRows);
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    return {
      ok: true,
      title: baseName(f.path),
      detail: `Split ${fmt(r.rows)} rows into ${r.files.length} files`,
      files: r.files,
    };
  } catch (e) {
    return { ok: false, title: baseName(f.path), detail: friendly(e) };
  }
});

const doConvert = perFile(async (f) => {
  try {
    const r = await engine.convert(f.path, state.convertTo);
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    let base = `Converted ${fmt(r.rows)} rows to ${state.convertTo.toUpperCase()}`;
    if (r.note) base += ` · ${r.note}`;
    if (r.files.length === 1) base += ` · saved ${r.files[0].name}`;
    return { ok: true, title: baseName(f.path), detail: base, files: r.files };
  } catch (e) {
    return { ok: false, title: baseName(f.path), detail: friendly(e) };
  }
});

const doDedup = perFile(async (f) => {
  try {
    const r = await engine.dedup(f.path);
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    let base = r.removed
      ? `Removed ${fmt(r.removed)} duplicate ${r.removed === 1 ? "row" : "rows"}, ${fmt(r.rows)} left`
      : "No duplicate rows, saved a clean copy anyway";
    if (r.note) base += ` · ${r.note}`;
    if (r.files.length === 1) base += ` · saved ${r.files[0].name}`;
    return { ok: true, title: baseName(f.path), detail: base, files: r.files };
  } catch (e) {
    return { ok: false, title: baseName(f.path), detail: friendly(e) };
  }
});

async function doMerge() {
  try {
    const r = await engine.merge(state.files.map((f) => f.path));
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    return [
      {
        ok: true,
        title: r.output,
        detail: `Merged ${state.files.length} files into ${fmt(r.rows)} rows · saved ${r.output}`,
        files: r.files,
      },
    ];
  } catch (e) {
    return [{ ok: false, title: "Merge", detail: friendly(e) }];
  }
}

async function doSaveRecipe() {
  const only = state.files[0];
  if (!only || !state.steps.length) return [];
  try {
    const r = await engine.applyAndSave(only.path, state.sheet, state.steps);
    r.files.forEach((o) => downloadBlob(o.name, o.blob));
    return [
      {
        ok: true,
        title: baseName(only.path),
        detail: `${r.steps.join(" · ")} · ${fmt(r.rows)} rows · saved ${r.output}`,
        files: r.files,
      },
    ];
  } catch (e) {
    return [{ ok: false, title: baseName(only.path), detail: friendly(e) }];
  }
}

function startOver() {
  set({
    files: [],
    results: null,
    error: null,
    savedNote: null,
    preview: null,
    previewNote: null,
    sheet: null,
    steps: [],
    picked: new Set(),
  });
}

function friendly(e) {
  if (typeof e === "string") return e;
  if (e && typeof e.message === "string") return e.message;
  return "Furrow couldn't finish that one.";
}

// ---- recipe helpers --------------------------------------------------------
function addTrim(columns) {
  const have = new Set(state.steps.filter((s) => s.kind === "trim").map((s) => s.column));
  const fresh = columns.filter((c) => c && !have.has(c)).map((c) => ({ kind: "trim", column: c }));
  if (fresh.length) {
    state.steps = [...state.steps, ...fresh];
    state.picked = new Set();
    refreshPreview();
    render();
  }
}
function removeStep(i) {
  state.steps = state.steps.filter((_, n) => n !== i);
  refreshPreview();
  render();
}
function clearSteps() {
  state.steps = [];
  refreshPreview();
  render();
}
function togglePick(name) {
  if (!name) return;
  const next = new Set(state.picked);
  next.has(name) ? next.delete(name) : next.add(name);
  state.picked = next;
  render();
}
function chooseSheet(s) {
  state.sheet = s;
  refreshPreview();
  render();
}

// ---- rendering -------------------------------------------------------------
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

const KIND_LABEL = {
  id: "ID (kept as text)",
  number: "Number",
  date: "Date",
  text: "Text",
  empty: "Empty",
};

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
      el("span", { class: "brand-name" }, "Furrow"),
      el("span", { class: "brand-tag" }, "Tidy your spreadsheets"),
    ),
    el("span", { class: "chip", title: "Nothing is uploaded." }, "Runs on your device"),
  );
}

function body() {
  const main = el("main", { class: "body" });
  // drop handling
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
    main.append(el("button", { class: "try-sample", onclick: trySample }, "Or try it with a sample spreadsheet"));
  if (state.savedNote)
    main.append(el("div", { class: "undone" }, state.savedNote + " Your originals are untouched."));
  if (state.previewNote) main.append(el("div", { class: "wb-note" }, state.previewNote));
  if (state.preview) main.append(workbench());
  if (state.files.length > 0) {
    main.append(queue());
    main.append(ops());
  }
  if (state.busy) main.append(el("div", { class: "working" }, "Working…"));
  if (state.error) main.append(el("div", { class: "error" }, state.error));
  return main;
}

function dropZone() {
  const dz = el(
    "div",
    { class: "dropzone" + (state.over ? " over" : "") + (state.files.length ? " packed" : "") },
    el("div", {
      class: "dz-icon",
      html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v8"/><path d="M8 5c0 3 1.5 5 4 6"/><path d="M16 5c0 3-1.5 5-4 6"/><path d="M6 11h12l-1.4 8.2a1 1 0 0 1-1 .8H8.4a1 1 0 0 1-1-.8L6 11z"/></svg>`,
    }),
    el("div", { class: "dz-title" }, "Tidy a spreadsheet"),
    el(
      "div",
      { class: "dz-sub" },
      "Drop CSV or Excel files here to split, merge, convert, or clean them. A fresh copy is downloaded for each. Your originals stay as they are, and nothing leaves your device.",
    ),
    el("button", { class: "dz-cta", onclick: openPicker }, "Choose files"),
    el("div", { class: "dz-hint" }, "Works with CSV, TSV, and Excel (.xlsx, .xls, .ods)."),
  );
  return dz;
}

function queue() {
  return el(
    "section",
    { class: "queue" },
    ...state.files.map((f) =>
      el(
        "div",
        { class: "qrow" },
        el("span", { class: "qkind" }, f.kind),
        el("span", { class: "qname" }, baseName(f.path)),
        el(
          "span",
          { class: "qmeta" },
          f.rows != null
            ? `${fmt(f.rows)} rows · ${f.cols} cols${f.sheets && f.sheets > 1 ? ` · ${f.sheets} sheets` : ""}`
            : "",
        ),
        el(
          "button",
          {
            class: "qx",
            title: "Remove",
            onclick: () => {
              engine.forget(f.path);
              state.files = state.files.filter((x) => x.path !== f.path);
              state.steps = [];
              refreshPreview();
              render();
            },
          },
          "×",
        ),
      ),
    ),
  );
}

function ops() {
  const allAlreadyTarget =
    state.files.length > 0 && state.files.every((f) => extOf(f.path) === state.convertTo);
  return el(
    "section",
    { class: "ops" },
    // split
    el(
      "div",
      { class: "op" },
      el(
        "div",
        { class: "op-label" },
        "Split into files of ",
        el("input", {
          class: "num",
          type: "number",
          min: "1",
          value: String(state.splitRows),
          oninput: (e) => {
            state.splitRows = Math.max(1, parseInt(e.target.value) || 1);
          },
        }),
        " rows",
      ),
      el("button", { class: "op-go", disabled: state.busy, onclick: () => run(doSplit) }, "Split"),
    ),
    // convert
    el(
      "div",
      { class: "op" },
      el(
        "div",
        { class: "op-label" },
        "Convert to ",
        el(
          "span",
          { class: "seg" },
          el(
            "button",
            { class: state.convertTo === "xlsx" ? "on" : "", onclick: () => set({ convertTo: "xlsx" }) },
            "Excel",
          ),
          el(
            "button",
            { class: state.convertTo === "csv" ? "on" : "", onclick: () => set({ convertTo: "csv" }) },
            "CSV",
          ),
        ),
        allAlreadyTarget ? el("span", { class: "dim" }, `(already ${state.convertTo.toUpperCase()})`) : null,
      ),
      el(
        "button",
        { class: "op-go", disabled: state.busy || allAlreadyTarget, onclick: () => run(doConvert) },
        "Convert",
      ),
    ),
    // dedup
    el(
      "div",
      { class: "op" },
      el("div", { class: "op-label" }, "Remove duplicate rows"),
      el("button", { class: "op-go", disabled: state.busy, onclick: () => run(doDedup) }, "Clean"),
    ),
    // merge
    el(
      "div",
      { class: "op" },
      el(
        "div",
        { class: "op-label" },
        "Merge all files into one ",
        state.files.length < 2 ? el("span", { class: "dim" }, "(needs 2+)") : null,
      ),
      el(
        "button",
        { class: "op-go", disabled: state.busy || state.files.length < 2, onclick: () => run(doMerge) },
        "Merge",
      ),
    ),
  );
}

function workbench() {
  const p = state.preview;
  const trimmed = (col) => state.steps.some((s) => s.kind === "trim" && s.column === col);
  const pickedList = [...state.picked];

  const wb = el("section", { class: "wb" });

  if (p.sheets.length > 1) {
    wb.append(
      el(
        "div",
        { class: "wb-sheets" },
        ...p.sheets.map((s) =>
          el(
            "button",
            { class: "wb-sheet" + (s === (state.sheet ?? p.sheet) ? " on" : ""), onclick: () => chooseSheet(s) },
            s,
          ),
        ),
      ),
    );
  }

  // action bar
  wb.append(
    el(
      "div",
      { class: "wb-bar" },
      state.picked.size
        ? [
            el(
              "span",
              { class: "wb-bar-note" },
              state.picked.size === 1 ? `"${pickedList[0]}" picked` : `${state.picked.size} columns picked`,
            ),
            el("button", { class: "wb-bar-act", onclick: () => addTrim(pickedList) }, "Trim spaces"),
            el("button", { class: "wb-bar-clear", onclick: () => set({ picked: new Set() }) }, "Clear"),
          ]
        : el("span", { class: "wb-bar-hint" }, "Click a column to clean it."),
    ),
  );

  // recipe
  if (state.steps.length) {
    wb.append(
      el(
        "div",
        { class: "recipe" },
        el(
          "div",
          { class: "recipe-head" },
          el(
            "span",
            { class: "recipe-title" },
            `${state.steps.length} ${state.steps.length === 1 ? "cleanup" : "cleanups"}, not saved yet`,
          ),
          el(
            "span",
            { class: "recipe-actions" },
            el("button", { class: "recipe-clear", onclick: clearSteps }, "Clear all"),
            el(
              "button",
              { class: "recipe-save", disabled: state.busy, onclick: () => run(doSaveRecipe) },
              state.busy ? "Saving…" : "Save cleaned copy",
            ),
          ),
        ),
        el(
          "ol",
          { class: "recipe-list" },
          ...state.steps.map((s, i) =>
            el(
              "li",
              {},
              el("span", { class: "recipe-n" }, String(i + 1)),
              el("span", { class: "recipe-text" }, `Trim spaces in "${s.column}"`),
              el("button", { class: "recipe-x", title: "Remove this step", onclick: () => removeStep(i) }, "×"),
            ),
          ),
        ),
      ),
    );
  }

  // table
  const thead = el(
    "tr",
    {},
    ...p.columns.map((c) =>
      el(
        "th",
        {
          class: state.picked.has(c.name) ? "sel" : "",
          title: `${KIND_LABEL[c.kind]}${c.blanks ? ` · ${c.blanks} blank` : ""}`,
          onclick: () => togglePick(c.name),
        },
        el(
          "span",
          { class: "wb-h" },
          el("span", { class: "dot " + c.kind, "aria-hidden": true }),
          c.name || "(unnamed)",
        ),
        el("span", { class: "wb-kind" }, KIND_LABEL[c.kind]),
        trimmed(c.name) ? el("span", { class: "wb-done" }, "✓ Trimmed") : null,
      ),
    ),
  );
  const tbody = el(
    "tbody",
    {},
    ...p.rows.map((r) =>
      el(
        "tr",
        {},
        ...p.columns.map((c, ci) =>
          el("td", { class: state.picked.has(c.name) ? "sel" : "" }, r[ci] ?? ""),
        ),
      ),
    ),
  );
  wb.append(
    el("div", { class: "wb-scroll" }, el("table", { class: "wb-table" }, el("thead", {}, thead), tbody)),
  );

  wb.append(
    el(
      "div",
      { class: "wb-foot" },
      (p.shown < p.total_rows
        ? `Showing the first ${fmt(p.shown)} of ${fmt(p.total_rows)} rows`
        : `${fmt(p.total_rows)} ${p.total_rows === 1 ? "row" : "rows"}`) +
        (state.steps.length ? ", with your cleanups applied, live" : ", nothing has been changed") +
        ".",
    ),
  );

  return wb;
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
      el(
        "div",
        { class: "results-actions" },
        el("button", { class: "ghost", onclick: startOver }, "Start over"),
      ),
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
    el(
      "div",
      { class: "wb-note", style: "color:var(--faint)" },
      "Saved files land in your downloads folder.",
    ),
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
