// FastSpring checkout wiring for the Mac tools page.
//
// The buy buttons themselves are plain markup: FastSpring's Store Builder
// Library reads data-fsc-action / data-fsc-item-path-value straight off them.
// This file only handles what happens AFTER a purchase, which is the part worth
// getting right: the same licence code that unlocks the Mac download also
// unlocks the browser versions at /tools/*, so a buyer should never have to go
// and find it in an email first.
//
// edenapps.app and edenapps.app/tools/* are one origin, so the code written to
// localStorage here is the code the gate reads there. Key and format are the
// gate's contract, see tools/_license/gate.js.

(function () {
  "use strict";

  var STORE_KEY = "eden-license"; // must match gate.js
  var CODE_RE = /EDEN1-[A-Z]+-[A-Z2-7]+-[A-Z2-7]+/;

  var TOOLS = [
    { path: "furrow", name: "Furrow" },
    { path: "pagenook", name: "Pagenook" },
    { path: "clearleaf", name: "Clearleaf" },
    { path: "bookplate", name: "Bookplate" },
  ];

  // FastSpring does not document the shape of the order object it hands these
  // callbacks, and a shape we guessed at would break silently the first time it
  // changed. So: walk whatever arrives and pick out anything with the shape of
  // one of our codes. The code format is distinctive, and nothing is trusted on
  // the strength of the match alone. It is checked against the signing key
  // below before it unlocks anything.
  function findCode(node, depth) {
    if (depth > 8 || node == null) return null;
    if (typeof node === "string") {
      var m = node.toUpperCase().match(CODE_RE);
      return m ? m[0] : null;
    }
    if (typeof node !== "object") return null;
    var keys = Object.keys(node);
    for (var i = 0; i < keys.length; i++) {
      var found = findCode(node[keys[i]], depth + 1);
      if (found) return found;
    }
    return null;
  }

  // Verify with the same offline check the tools use, so a string that merely
  // looks like a code cannot unlock anything.
  function verify(code) {
    // Absolute: this is a classic script, so a relative specifier would resolve
    // against the page rather than against this file.
    return import("/tools/_license/verify.mjs")
      .then(function (m) {
        return m.verifyCode(code, null);
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function store(code) {
    try {
      localStorage.setItem(STORE_KEY, code);
      return true;
    } catch (e) {
      return false; // private browsing; the panel still shows the code
    }
  }

  var shown = false;

  function showPanel(code, stored) {
    if (shown) return;
    shown = true;

    var wrap = document.createElement("div");
    wrap.className = "fs-done";
    wrap.setAttribute("role", "status");

    var list = TOOLS.map(function (t) {
      return (
        '<a class="fs-done-tool" href="tools/' +
        t.path +
        '/">' +
        t.name +
        "</a>"
      );
    }).join("");

    wrap.innerHTML =
      '<div class="fs-done-card">' +
      "<h3>Thank you. Your tools are ready.</h3>" +
      "<p>" +
      (stored
        ? "The browser versions are unlocked on this device already. Your code is below, and a copy is in your email with the Mac downloads."
        : "Your code is below, and a copy is in your email with the Mac downloads. Paste it into any tool to unlock it.") +
      "</p>" +
      '<div class="fs-done-code"><code>' +
      code +
      '</code><button type="button" class="fs-done-copy">Copy</button></div>' +
      '<p class="fs-done-open">Open in your browser: ' +
      list +
      "</p>" +
      '<p class="fs-done-foot">Keep the code somewhere safe. It works on as many of your devices as you like.</p>' +
      "</div>";

    // Top of the page content, not the end of the document. After a purchase
    // this is the first thing the buyer should see, and appending to <body>
    // would put it below the footer.
    var main = document.getElementById("main") || document.querySelector("main");
    if (main) main.insertBefore(wrap, main.firstChild);
    else document.body.appendChild(wrap);

    var btn = wrap.querySelector(".fs-done-copy");
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(code).then(
        function () {
          btn.textContent = "Copied";
        },
        function () {
          btn.textContent = "Select it above";
        }
      );
    });

    wrap.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleOrder(data) {
    var code = findCode(data, 0);
    if (!code) return; // nothing that looks like one of ours; leave the page alone
    verify(code).then(function (res) {
      if (!res || !res.ok) return; // not actually ours, say nothing
      showPanel(code, store(code));
    });
  }

  // Fires while the popup is still open, as soon as the order is confirmed.
  // This is the one that carries fulfilment data.
  window.fscPopupWebhookReceived = function (data) {
    handleOrder(data);
  };

  // Fires when the popup closes, whether the order completed or was abandoned.
  // Abandoned carries no code, and findCode simply returns nothing.
  window.fscPopupClosed = function (data) {
    handleOrder(data);
  };

  window.fscError = function (code, message) {
    // Nothing user-facing: a checkout that will not open should not also put an
    // error on the page. Left visible in the console for diagnosis.
    if (window.console) console.warn("FastSpring:", code, message);
  };
})();
