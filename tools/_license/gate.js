// Shared licence gate for the Eden web tools.
//
// The tools are free to use on your own files. The licence is asked for at the
// point where you keep the result: saving or exporting a file, or in Bookplate
// growing the library past the free few. Seeing your own file handled correctly
// is what makes the tool worth buying, so that part costs nothing.
//
// The code is the SAME one sold with the Mac download on FastSpring.
// Verification is offline (ed25519, see verify.mjs); a valid code is remembered
// on this device and re-checked on each load. Like the Mac app's LicenseGate,
// this is a client-side gate: it stops casual free use, matching the existing
// model. It is not, and never was, a hard lock.
//
// Each page declares its product with <meta name="eden-product" content="furrow">.
// A "bundle" code unlocks every app.
//
// Apps use it like this:
//   import { ensureLicensed } from "../_license/gate.js";
//   if (!(await ensureLicensed())) return;   // user dismissed, do nothing
//   ...save the file...

import { verifyCode } from "./verify.mjs";

const PRODUCT = document.querySelector('meta[name="eden-product"]')?.content || "";
const APP_NAME = document.querySelector('meta[name="eden-appname"]')?.content || "this tool";
const STORE_KEY = "eden-license"; // one stored code unlocks whatever it's valid for
const BUY_URL = "https://edenapps.app/mac-tools.html";

const CSS = `
.eden-gate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;
  background:rgba(20,21,42,.42);backdrop-filter:blur(3px);padding:24px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.eden-gate-card{max-width:400px;width:100%;text-align:center;background:#fff;color:#14152a;
  border-radius:18px;padding:28px 26px;box-shadow:0 30px 70px -20px rgba(20,21,42,.4)}
@media(prefers-color-scheme:dark){.eden-gate-card{background:#15161e;color:#f0f1f6}}
.eden-gate-icon{width:52px;height:52px;border-radius:13px;margin:0 auto 14px;display:block}
.eden-gate h1{font-size:20px;font-weight:750;letter-spacing:-.3px;margin:0 0 6px}
.eden-gate p{color:#6b6d84;font-size:14px;margin:0 auto 18px;max-width:34ch;line-height:1.55}
@media(prefers-color-scheme:dark){.eden-gate p{color:#9a9cb0}}
.eden-gate input{width:100%;border:1px solid #d7d7e2;border-radius:11px;padding:12px 14px;
  font:inherit;font-size:14px;text-align:center;letter-spacing:.02em;background:#fff;color:#14152a}
@media(prefers-color-scheme:dark){.eden-gate input{background:#0f1017;color:#f0f1f6;border-color:#31334a}}
.eden-gate input:focus{outline:2px solid #4338ca;border-color:#4338ca}
.eden-gate-btn{margin-top:10px;width:100%;border:0;border-radius:11px;background:#4338ca;color:#fff;
  font:inherit;font-weight:650;font-size:15px;padding:12px;cursor:pointer}
.eden-gate-btn:disabled{opacity:.5;cursor:default}
.eden-gate-err{color:#b4690e;font-size:13px;margin-top:10px;min-height:18px}
.eden-gate-buy{margin-top:18px;font-size:13.5px}
.eden-gate-buy a{color:#4338ca;text-decoration:underline;text-underline-offset:3px}
@media(prefers-color-scheme:dark){.eden-gate-buy a{color:#8b83f0}}
.eden-gate-back{margin-top:12px;background:none;border:0;font:inherit;font-size:13px;
  color:#9a9ca8;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.id = "eden-gate-style";
  style.textContent = CSS;
  document.head.appendChild(style);
}

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) n.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  return n;
}

// ---- licence state ---------------------------------------------------------

let licensed = false;

function codeFromUrl() {
  try {
    const q = new URLSearchParams(location.search).get("code");
    if (q) return q;
    const h = location.hash.match(/(?:^|[#&])code=([^&]+)/);
    return h ? decodeURIComponent(h[1]) : null;
  } catch {
    return null;
  }
}

// Take the code out of the address bar once it has been stored, so it is not
// left sitting in the URL to be shared or bookmarked by accident.
function scrubUrl() {
  try {
    const u = new URL(location.href);
    u.searchParams.delete("code");
    u.hash = u.hash.replace(/(?:^|[#&])code=[^&]*/, "").replace(/^#&/, "#");
    if (u.hash === "#") u.hash = "";
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch { /* not worth failing the unlock over */ }
}

function store(code) {
  try {
    localStorage.setItem(STORE_KEY, code.trim().toUpperCase());
  } catch { /* private mode: this session only */ }
}

// Settled once on load: a code in the URL wins, then one already on the device.
const ready = (async function init() {
  const fromUrl = codeFromUrl();
  if (fromUrl) {
    const res = await verifyCode(fromUrl, PRODUCT);
    if (res.ok) {
      store(fromUrl);
      scrubUrl();
      licensed = true;
      return true;
    }
  }
  let stored = null;
  try {
    stored = localStorage.getItem(STORE_KEY);
  } catch { /* ignore */ }
  if (stored) {
    const res = await verifyCode(stored, PRODUCT);
    if (res.ok) {
      licensed = true;
      return true;
    }
  }
  return false;
})();

/** True if this device already holds a valid code. Sync, so safe in render. */
export function isLicensed() {
  return licensed;
}

/** Resolves once the on-load check has settled. */
export function licenseReady() {
  return ready;
}

// ---- the ask ---------------------------------------------------------------

let openPrompt = null;

/**
 * Ask for a licence, but only if this device does not already have one.
 * Resolves true when the caller may proceed, false when the person backed out.
 * `note` replaces the default explanation, for cases like Bookplate's limit.
 */
export function ensureLicensed({ note } = {}) {
  return ready.then((ok) => {
    if (ok || licensed) return true;
    if (openPrompt) return openPrompt; // never stack two dialogs
    openPrompt = showPrompt({ note }).finally(() => {
      openPrompt = null;
    });
    return openPrompt;
  });
}

function showPrompt({ note }) {
  injectStyle();

  return new Promise((resolve) => {
    const input = el("input", {
      type: "text",
      placeholder: "EDEN1-…",
      autocomplete: "off",
      spellcheck: "false",
      "aria-label": "Licence code",
    });
    const err = el("div", { class: "eden-gate-err" });
    const btn = el("button", { class: "eden-gate-btn" }, "Unlock");

    let root;
    function close(result) {
      root?.remove();
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === "Escape") close(false);
    }

    async function attempt() {
      const code = input.value.trim();
      if (!code) return;
      btn.disabled = true;
      err.textContent = "";
      const res = await verifyCode(code, PRODUCT);
      if (res.ok) {
        store(code);
        licensed = true;
        close(true);
        return;
      }
      err.textContent = res.reason || "That code didn't work.";
      btn.disabled = false;
      input.focus();
      input.select();
    }

    btn.addEventListener("click", attempt);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") attempt();
    });

    root = el(
      "div",
      { id: "eden-gate-root", class: "eden-gate", role: "dialog", "aria-modal": "true" },
      el(
        "div",
        { class: "eden-gate-card" },
        el("img", { class: "eden-gate-icon", src: "icon.png", alt: "", width: "52", height: "52" }),
        el("h1", {}, "Enter your code to save"),
        el(
          "p",
          {},
          note ||
            `${APP_NAME} is free to use on your own files. Keeping the result needs the licence code from your Eden Apps purchase, the same one that opens the Mac app.`,
        ),
        input,
        btn,
        err,
        el("div", { class: "eden-gate-buy" }, "Don't have one yet? ", el("a", { href: BUY_URL }, "Get " + APP_NAME)),
        el("button", { class: "eden-gate-back", onclick: () => close(false) }, "Not now"),
      ),
    );

    // A click on the backdrop backs out too. They have done real work behind
    // this dialog, so it must never feel like a trap.
    root.addEventListener("mousedown", (e) => {
      if (e.target === root) close(false);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(root);
    setTimeout(() => input.focus(), 30);
  });
}
