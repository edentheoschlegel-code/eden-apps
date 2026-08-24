// Bookplate web — UI for the browser-only reading library.
// Two panes: the library list and a clean reader with read-aloud.

import {
  BookplateLibrary,
  extractFromHtml,
  articleFromText,
  readerDoc,
  speakableText,
  SAMPLE,
} from "./engine.js";
import { useOnce } from "../_license/gate.js";

const lib = new BookplateLibrary();

const state = {
  tab: "library", // "library" | "trash"
  items: [],
  trashCount: 0,
  selected: null, // full article
  addOpen: false,
  addText: "",
  addTitle: "",
  speaking: false,
  paused: false,
  error: null,
  toast: null, // { msg, undo }
};

const root = document.getElementById("app");
const picker = document.getElementById("picker");

function set(patch) {
  Object.assign(state, patch);
  render();
}

// ---- data ------------------------------------------------------------------
async function refresh() {
  const items = await lib.list({ deleted: state.tab === "trash" ? 1 : 0 });
  const counts = await lib.count();
  state.items = items;
  state.trashCount = counts.trash;
  // keep selection valid
  if (state.selected && !items.some((i) => i.id === state.selected.id) && state.tab === "library") {
    state.selected = null;
  }
  render();
}

async function selectArticle(id) {
  stopSpeech();
  try {
    const a = await lib.get(id);
    set({ selected: a });
  } catch (e) {
    set({ error: friendly(e) });
  }
}

// Bookplate has no "save the result" moment, being a library, so a go is a
// saved article. Same three, same shared counter as the other three tools.
async function mayAddArticle() {
  return useOnce();
}

async function addFromSample() {
  const rec = await lib.save(SAMPLE);
  await refresh();
  selectArticle(rec.id);
}

async function importFile(file) {
  try {
    if (!(await mayAddArticle())) return;
    const text = await file.text();
    const isHtml = /\.html?$/i.test(file.name) || /^\s*<(!doctype|html)/i.test(text);
    const article = isHtml ? extractFromHtml(text) : articleFromText(text, stripExt(file.name));
    const rec = await lib.save(article);
    set({ error: null });
    await refresh();
    selectArticle(rec.id);
  } catch (e) {
    set({ error: friendly(e) });
  }
}

async function saveTyped() {
  try {
    if (!(await mayAddArticle())) return;
    const article = articleFromText(state.addText, state.addTitle);
    const rec = await lib.save(article);
    set({ addOpen: false, addText: "", addTitle: "", error: null });
    await refresh();
    selectArticle(rec.id);
  } catch (e) {
    set({ error: friendly(e) });
  }
}

async function deleteSelected() {
  if (!state.selected) return;
  const id = state.selected.id;
  const title = state.selected.title;
  stopSpeech();
  await lib.delete(id);
  set({ selected: null, toast: { msg: `Moved “${trunc(title, 40)}” to the trash.`, undo: () => undoDelete(id) } });
  await refresh();
  scheduleToastClear();
}
async function undoDelete(id) {
  await lib.restore(id);
  set({ toast: null });
  await refresh();
  selectArticle(id);
}
async function restoreItem(id) {
  await lib.restore(id);
  await refresh();
}
async function purgeItem(id) {
  await lib.purge(id);
  if (state.selected?.id === id) state.selected = null;
  await refresh();
}

let toastTimer = null;
function scheduleToastClear() {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null }), 8000);
}

// ---- read aloud (Web Speech API) -------------------------------------------
function canSpeak() {
  return typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
}
function stopSpeech() {
  if (canSpeak()) speechSynthesis.cancel();
  state.speaking = false;
  state.paused = false;
}
function toggleSpeech() {
  if (!canSpeak() || !state.selected) return;
  if (state.speaking && !state.paused) {
    speechSynthesis.pause();
    set({ paused: true });
    return;
  }
  if (state.speaking && state.paused) {
    speechSynthesis.resume();
    set({ paused: false });
    return;
  }
  const text = speakableText(state.selected.content_html);
  if (!text) return;
  speechSynthesis.cancel();
  // Chunk long text — some engines cut off past ~32k chars.
  const chunks = text.match(/[\s\S]{1,800}(?:\s|$)/g) || [text];
  let i = 0;
  const speakNext = () => {
    if (i >= chunks.length) {
      state.speaking = false;
      state.paused = false;
      render();
      return;
    }
    const u = new SpeechSynthesisUtterance(chunks[i++]);
    u.onend = speakNext;
    u.onerror = () => {
      state.speaking = false;
      render();
    };
    speechSynthesis.speak(u);
  };
  set({ speaking: true, paused: false });
  speakNext();
}

// ---- helpers ---------------------------------------------------------------
function friendly(e) {
  if (typeof e === "string") return e;
  if (e && typeof e.message === "string") return e.message;
  return "Something went wrong.";
}
function stripExt(name) {
  return name.replace(/\.[^.]+$/, "");
}
function trunc(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function whenText(secs) {
  const d = new Date(secs * 1000);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

picker.addEventListener("change", () => {
  if (picker.files?.length) importFile(picker.files[0]);
  picker.value = "";
});

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
  root.replaceChildren(header(), cols());
  const t = document.getElementById("toast-slot");
  if (state.toast) {
    document.body.appendChild(
      Object.assign(
        el(
          "div",
          { class: "toast", id: "live-toast" },
          state.toast.msg,
          state.toast.undo ? el("button", { onclick: () => state.toast.undo() }, "Undo") : null,
        ),
      ),
    );
  }
  const prev = document.querySelectorAll(".toast");
  if (prev.length > 1) prev[0].remove();
  if (!state.toast) document.querySelectorAll(".toast").forEach((n) => n.remove());
  void t;
}

function header() {
  return el(
    "header",
    { class: "topbar" },
    el(
      "div",
      { class: "brand" },
      el("img", { class: "brand-icon", src: "icon.png", alt: "", width: "26", height: "26" }),
      el("span", { class: "brand-name" }, "Bookplate"),
      el("span", { class: "brand-tag" }, "Read it later"),
    ),
    el("span", { class: "chip", title: "Your library stays on this device." }, "Runs on your device"),
  );
}

function cols() {
  return el("div", { class: "cols" }, listPane(), readerPane());
}

function listPane() {
  const pane = el("div", { class: "list-pane" });

  // add area
  const add = el(
    "div",
    { class: "add" + (state.addOpen ? " expanded" : "") },
    el(
      "div",
      { class: "add-row" },
      el("button", { class: "btn", onclick: () => picker.click() }, "Import file"),
      el(
        "button",
        { class: "btn ghost", onclick: () => set({ addOpen: !state.addOpen }) },
        state.addOpen ? "Cancel" : "Paste text",
      ),
    ),
    el("input", {
      class: "title",
      placeholder: "Title (optional)",
      value: state.addTitle,
      oninput: (e) => {
        state.addTitle = e.target.value;
      },
    }),
    el("textarea", {
      placeholder: "Paste an article or note here…",
      oninput: (e) => {
        state.addText = e.target.value;
      },
    }),
    state.addOpen
      ? el(
          "div",
          { class: "add-row" },
          el("button", { class: "btn", disabled: !state.addText.trim(), onclick: saveTyped }, "Save to library"),
        )
      : null,
  );
  // preserve textarea content across re-render
  const ta = add.querySelector("textarea");
  if (ta) ta.value = state.addText;
  pane.append(add);

  // tabs
  pane.append(
    el(
      "div",
      { class: "tabs" },
      el("button", { class: "tab" + (state.tab === "library" ? " on" : ""), onclick: () => switchTab("library") }, "Library"),
      el(
        "button",
        { class: "tab" + (state.tab === "trash" ? " on" : ""), onclick: () => switchTab("trash") },
        `Trash${state.trashCount ? ` (${state.trashCount})` : ""}`,
      ),
    ),
  );

  // list
  const list = el("div", { class: "list" });
  if (!state.items.length) {
    list.append(
      el(
        "div",
        { class: "empty" },
        el("div", { class: "empty-title" }, state.tab === "trash" ? "Trash is empty" : "Your library is empty"),
        el(
          "div",
          { class: "empty-sub" },
          state.tab === "trash"
            ? "Deleted articles wait here until you empty them."
            : "Import a saved web page or a text file, or paste text. It's yours to read anytime, offline.",
        ),
        state.tab === "library"
          ? el("button", { class: "btn", style: "margin-top:14px", onclick: addFromSample }, "Add a sample to try it")
          : null,
      ),
    );
  } else {
    for (const a of state.items) {
      list.append(
        el(
          "button",
          {
            class: "item" + (state.selected?.id === a.id ? " sel" : ""),
            onclick: () => (state.tab === "trash" ? selectArticle(a.id) : selectArticle(a.id)),
          },
          el("div", { class: "item-title" }, a.title),
          a.byline || a.excerpt ? el("div", { class: "item-meta" }, a.byline ? a.byline : a.excerpt) : null,
          el("div", { class: "item-date" }, `Saved ${whenText(a.saved_at)}`),
        ),
      );
    }
  }
  pane.append(list);
  if (state.error) pane.append(el("div", { class: "empty", style: "color:var(--warn)" }, state.error));
  return pane;
}

function readerPane() {
  const pane = el("div", { class: "reader-pane" + (state.selected ? "" : " ") });
  if (!state.selected) {
    pane.append(
      el(
        "div",
        { class: "reader-empty" },
        el(
          "div",
          {},
          el("div", { class: "empty-title", style: "font-size:18px" }, "Nothing open"),
          el("div", { class: "empty-sub", style: "margin-top:8px" }, "Pick something from your library, and it opens here in a calm reader, offline, and yours."),
        ),
      ),
    );
    return pane;
  }

  const a = state.selected;
  const inTrash = state.tab === "trash";
  const bar = el(
    "div",
    { class: "reader-bar" },
    el("span", { class: "reader-title" }, a.title),
    el("span", { class: "sp" }),
    canSpeak() && !inTrash
      ? el(
          "button",
          { class: "icon-btn", onclick: toggleSpeech },
          state.speaking ? (state.paused ? "Resume" : "Pause") : "Listen",
        )
      : null,
    inTrash
      ? el("button", { class: "icon-btn", onclick: () => restoreItem(a.id) }, "Restore")
      : null,
    inTrash
      ? el("button", { class: "icon-btn warn", onclick: () => purgeItem(a.id) }, "Delete forever")
      : el("button", { class: "icon-btn warn", onclick: deleteSelected }, "Trash"),
  );
  pane.append(bar);

  const frame = el("iframe", {
    class: "reader-frame",
    sandbox: "allow-popups allow-popups-to-escape-sandbox",
    srcdoc: readerDoc(a),
    title: a.title,
  });
  pane.append(frame);
  return pane;
}

function switchTab(tab) {
  stopSpeech();
  state.tab = tab;
  state.selected = null;
  refresh();
}

// ---- boot ------------------------------------------------------------------
render();
refresh();
