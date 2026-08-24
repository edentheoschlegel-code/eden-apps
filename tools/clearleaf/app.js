// Clearleaf web — UI, a faithful browser rendering of scrub/src/App.tsx.
// Queue files → reveal what's hidden (grouped) → Clean → download clean copies.

import { ClearleafEngine, baseName, extOf } from "./engine.js";

const ACCEPT = ["docx", "xlsx", "pptx", "pdf", "jpg", "jpeg", "png", "tiff", "tif"];
const engine = new ClearleafEngine();

const state = {
  queued: [], // display names ("paths")
  reveal: null, // RevealResult[]
  looking: false,
  results: null, // ScrubResult[]
  busy: false,
  over: false,
  error: null,
  notice: null,
};

const root = document.getElementById("app");
const picker = document.getElementById("picker");

function set(patch) {
  Object.assign(state, patch);
  render();
}

function addFiles(fileList) {
  const supported = [];
  const skipped = [];
  for (const f of [...fileList]) {
    const e = extOf(f.name);
    if (ACCEPT.includes(e)) {
      engine.register(f);
      supported.push(f.name);
    } else {
      skipped.push(f.name);
    }
  }
  const seen = new Set(state.queued);
  const merged = [...state.queued, ...supported.filter((n) => !seen.has(n))];
  set({
    results: null,
    error: null,
    reveal: null,
    notice: skipped.length ? `Left ${skipped.length === 1 ? "one file" : `${skipped.length} files`} as ${skipped.length === 1 ? "it is" : "they are"}. Clearleaf doesn't handle that type: ${skipped.map(baseName).join(", ")}.` : null,
    queued: merged,
  });
  runReveal();
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
    const res = await fetch("./sample.docx");
    if (!res.ok) throw new Error("no sample");
    const blob = await res.blob();
    addFiles([new File([blob], "Practice document.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })]);
  } catch {
    set({ error: "Couldn't open the sample." });
  }
}

let revealToken = 0;
async function runReveal() {
  if (!state.queued.length) {
    set({ reveal: null });
    return;
  }
  const token = ++revealToken;
  set({ looking: true });
  const out = [];
  for (const name of state.queued) {
    out.push(await engine.reveal(name));
  }
  if (token !== revealToken) return;
  set({ reveal: out, looking: false });
}

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

async function clean() {
  if (!state.queued.length || state.busy) return;
  const submitted = state.queued;
  set({ busy: true, error: null });
  try {
    const results = [];
    for (const name of submitted) {
      const r = await engine.scrub(name);
      if (r.ok && r.file) downloadBlob(r.file.name, r.file.blob);
      results.push(r);
    }
    set({ busy: false, results, queued: [] });
  } catch (e) {
    set({ busy: false, error: friendly(e) });
  }
}

function friendly(e) {
  if (typeof e === "string") return e;
  if (e && typeof e.message === "string") return e.message;
  return "Something interrupted the cleaning. Your files weren't changed.";
}

function startOver() {
  set({ queued: [], reveal: null, results: null, error: null, notice: null });
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
      el("span", { class: "brand-name" }, "Clearleaf"),
      el("span", { class: "brand-tag" }, "Remove hidden data"),
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
  if (state.queued.length === 0)
    main.append(el("button", { class: "try-sample", onclick: trySample }, "Or try it with a practice document"));
  if (state.notice) main.append(el("div", { class: "notice" }, state.notice));
  if (state.queued.length > 0) {
    main.append(queue());
    if (state.looking) main.append(el("div", { class: "looking" }, "Looking inside…"));
    if (state.reveal) main.append(revealView());
    main.append(cleanBar());
  }
  if (state.busy) main.append(el("div", { class: "working" }, "Cleaning…"));
  if (state.error) main.append(el("div", { class: "error" }, state.error));
  return main;
}

function dropZone() {
  return el(
    "div",
    { class: "dropzone" + (state.over ? " over" : "") },
    el("div", {
      class: "dz-icon",
      html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3c-3 4-6 6-6 10a6 6 0 0 0 12 0c0-4-3-6-6-10z"/><path d="M11 21V9"/></svg>`,
    }),
    el("div", { class: "dz-title" }, "See and remove hidden data"),
    el(
      "div",
      { class: "dz-sub" },
      "Drop documents, PDFs or photos here. Clearleaf shows the hidden trail inside (author names, GPS, edit history) and saves a clean copy beside each one. Your originals stay as they are, and nothing leaves your device.",
    ),
    el("button", { class: "dz-cta", onclick: openPicker }, "Choose files"),
    el("div", { class: "dz-hint" }, "Word, Excel, PowerPoint, PDF, JPEG and PNG."),
  );
}

function queue() {
  return el(
    "section",
    { class: "queue" },
    ...state.queued.map((name) =>
      el(
        "div",
        { class: "qrow" },
        el("span", { class: "qkind" }, extOf(name)),
        el("span", { class: "qname" }, baseName(name)),
        el(
          "button",
          {
            class: "qx",
            title: "Remove",
            onclick: () => {
              engine.forget(name);
              state.queued = state.queued.filter((n) => n !== name);
              runReveal();
              render();
            },
          },
          "×",
        ),
      ),
    ),
  );
}

function revealView() {
  return el(
    "section",
    { class: "reveal" },
    ...state.reveal.map((r) => {
      const head = el(
        "div",
        { class: "rfile-head" },
        el("span", { class: "rfile-name" }, baseName(r.input)),
        !r.ok
          ? el("span", { class: "rfile-err" }, r.error || "couldn't read")
          : r.found
            ? el("span", { class: "rfile-count" }, `${r.found} hidden ${r.found === 1 ? "detail" : "details"}`)
            : el("span", { class: "rfile-clean" }, "Already clean"),
      );
      const kids = [head];
      if (r.ok && r.groups?.length) {
        kids.push(
          el(
            "div",
            { class: "rgroups" },
            ...r.groups.map((g) =>
              el(
                "div",
                { class: "rgroup" },
                el("div", { class: "rgroup-title" }, g.title),
                el("ul", {}, ...g.items.map((it) => el("li", {}, it))),
              ),
            ),
          ),
        );
      }
      return el("div", { class: "rfile" }, ...kids);
    }),
  );
}

function cleanBar() {
  const anyCleanable = state.reveal
    ? state.reveal.some((r) => r.ok && (r.found ?? 0) > 0)
    : false;
  const note = state.looking
    ? "Looking inside your files…"
    : anyCleanable
      ? "Save a clean copy of each file, with the hidden data removed."
      : "Nothing hidden was found. You can still save clean copies.";
  return el(
    "section",
    { class: "clean-bar" },
    el("span", { class: "clean-note" }, note),
    el(
      "button",
      { class: "clean-go", disabled: state.busy || !state.queued.length, onclick: clean },
      state.queued.length > 1 ? `Clean ${state.queued.length} files` : "Clean & save",
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
      ...state.results.map((r) => {
        const real = (r.removed || []).filter((x) => !/^No /.test(x));
        const note = !r.ok
          ? r.error || "Couldn't clean this one."
          : real.length
            ? `Removed ${real.length} hidden ${real.length === 1 ? "detail" : "details"} · saved ${r.output}`
            : `Already clean${r.output ? ` · saved ${r.output}` : ""}`;
        return el(
          "div",
          { class: "card" + (r.ok ? "" : " card-skip") },
          el(
            "div",
            { class: "card-top" },
            el("span", { class: "tick " + (r.ok ? "ok" : "no"), "aria-hidden": true }, r.ok ? "✓" : "!"),
            el("span", { class: "card-name" }, baseName(r.input)),
          ),
          el("div", { class: "card-note" }, note),
          r.ok && real.length
            ? el("ul", { class: "card-list" }, ...real.map((x) => el("li", {}, x)))
            : null,
        );
      }),
    ),
    el("div", { class: "note-soft" }, "Clean copies land in your downloads folder. TIFF files aren't cleaned by the web version yet."),
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
