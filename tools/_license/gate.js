// Shared license gate for the Eden web tools.
//
// Wraps each app in a lock screen until a valid EDEN1 license code is entered —
// the SAME code sold with the Mac download on FastSpring. Verification is
// offline (ed25519, see verify.mjs); a valid code is remembered on this device
// and re-checked on each load. Like the Mac app's LicenseGate, this is a
// client-side gate: it stops casual free use, matching the existing model.
//
// Each page declares its product with <meta name="eden-product" content="furrow">.
// A "bundle" code unlocks every app.

import { verifyCode } from "./verify.mjs";

const PRODUCT = document.querySelector('meta[name="eden-product"]')?.content || "";
const APP_NAME = document.querySelector('meta[name="eden-appname"]')?.content || "this tool";
const STORE_KEY = "eden-license"; // one stored code unlocks whatever it's valid for
const BUY_URL = "https://edenapps.app/mac-tools.html";

const CSS = `
.eden-gate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;
  background:var(--bg,#f6f6f9);color:var(--ink,#14152a);padding:24px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
@media(prefers-color-scheme:dark){.eden-gate{background:#0c0d12;color:#f0f1f6}}
.eden-gate-card{max-width:400px;width:100%;text-align:center}
.eden-gate-icon{width:56px;height:56px;border-radius:14px;margin:0 auto 16px;display:block}
.eden-gate h1{font-size:22px;font-weight:750;letter-spacing:-.3px;margin:0 0 6px}
.eden-gate p{color:#6b6d84;font-size:14px;margin:0 auto 20px;max-width:34ch;line-height:1.55}
@media(prefers-color-scheme:dark){.eden-gate p{color:#9a9cb0}}
.eden-gate input{width:100%;border:1px solid #d7d7e2;border-radius:11px;padding:12px 14px;
  font:inherit;font-size:14px;text-align:center;letter-spacing:.02em;background:#fff;color:#14152a}
@media(prefers-color-scheme:dark){.eden-gate input{background:#15161e;color:#f0f1f6;border-color:#31334a}}
.eden-gate input:focus{outline:2px solid #4338ca;border-color:#4338ca}
.eden-gate-btn{margin-top:10px;width:100%;border:0;border-radius:11px;background:#4338ca;color:#fff;
  font-weight:650;font-size:15px;padding:12px;cursor:pointer}
.eden-gate-btn:disabled{opacity:.5;cursor:default}
.eden-gate-err{color:#b4690e;font-size:13px;margin-top:10px;min-height:18px}
.eden-gate-buy{margin-top:22px;font-size:13.5px}
.eden-gate-buy a{color:#4338ca;text-decoration:underline;text-underline-offset:3px}
@media(prefers-color-scheme:dark){.eden-gate-buy a{color:#8b83f0}}
.eden-gate-foot{margin-top:8px;color:#9a9ca8;font-size:12px}
`;

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

function unlock() {
  document.getElementById("eden-gate-root")?.remove();
  document.documentElement.classList.remove("eden-locked");
}

// Lock synchronously the moment this module runs, so the app is never usable
// for even a frame before we know whether this device is licensed.
document.documentElement.classList.add("eden-locked");
(function injectLockStyle() {
  const style = el("style");
  style.id = "eden-lock-style";
  style.textContent = CSS + "\n.eden-locked #app{filter:blur(6px);pointer-events:none;user-select:none}";
  document.head.appendChild(style);
})();

function showGate() {
  const input = el("input", {
    type: "text",
    placeholder: "EDEN1-…",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": "License code",
  });
  const err = el("div", { class: "eden-gate-err" });
  const btn = el("button", { class: "eden-gate-btn" }, "Unlock");

  async function attempt() {
    const code = input.value.trim();
    if (!code) return;
    btn.disabled = true;
    err.textContent = "";
    const res = await verifyCode(code, PRODUCT);
    if (res.ok) {
      try {
        localStorage.setItem(STORE_KEY, code);
      } catch { /* private mode — unlock for this session anyway */ }
      unlock();
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

  const root = el(
    "div",
    { id: "eden-gate-root", class: "eden-gate", role: "dialog", "aria-modal": "true" },
    el(
      "div",
      { class: "eden-gate-card" },
      el("img", { class: "eden-gate-icon", src: "icon.png", alt: "", width: "56", height: "56" }),
      el("h1", {}, `Unlock ${APP_NAME}`),
      el("p", {}, "Enter the license code from your Eden Apps purchase. It works on all your devices, and it's checked right here, so nothing is sent anywhere."),
      input,
      btn,
      err,
      el("div", { class: "eden-gate-buy" }, "Don't have one yet? ", el("a", { href: BUY_URL }, "Get " + APP_NAME)),
      el("div", { class: "eden-gate-foot" }, "One code unlocks the tool. The four-app code unlocks all of them."),
    ),
  );
  document.body.appendChild(root);
  setTimeout(() => input.focus(), 30);
}

// A code can also arrive in the link itself, as ?code=... or #code=... . That is
// how a receipt or the checkout on edenapps.app hands a fresh purchase straight
// to the tool, so nobody has to copy and paste anything. It is verified like any
// other code before it is trusted.
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

// On load: a code in the URL wins, then a code already stored on this device.
// If neither verifies, show the gate. The gate is shown synchronously (no flash
// of the app) and removed if the async re-check succeeds.
(async function init() {
  const fromUrl = codeFromUrl();
  if (fromUrl) {
    const res = await verifyCode(fromUrl, PRODUCT);
    if (res.ok) {
      try {
        localStorage.setItem(STORE_KEY, fromUrl.trim().toUpperCase());
      } catch { /* private mode - unlock for this session anyway */ }
      scrubUrl();
      unlock();
      return;
    }
  }

  let stored = null;
  try {
    stored = localStorage.getItem(STORE_KEY);
  } catch { /* ignore */ }
  if (stored) {
    const res = await verifyCode(stored, PRODUCT);
    if (res.ok) {
      unlock(); // valid on this device, lift the synchronous lock, no gate shown
      return;
    }
  }
  showGate();
})();
