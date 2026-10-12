/* Dusk horizon: the closing seam (How we work -> the closing mark). Sketch only: injected into the
 * running page by /sketch/scene/?close=dusk-horizon; no project files change.
 *
 * The sibling of "soft horizon" (the dawn above How we work). There the day begins: sage hills, a
 * light rising behind them. Here it ends: the straight edge between Eden's pink room and the closing
 * paper becomes a low painted horizon at dusk. The pink is the evening sky; three low ridges in the
 * pink's own tones (a deeper rose range far away, warmer rolling hills between, a pale bank near)
 * settle into the paper ground like evening mist, so the closing room is the misty valley floor the
 * mark rests on. Every ridge dips toward the middle, so the land leads the eye down to the mark.
 *
 * Scrolling in, as if coming down into the valley: the far range settles while the nearer hills rise
 * past it, two veils of mist gather in from the sides toward the middle, the sky above the valley
 * warms, the crests nearest the middle catch the light, and a warm glow rises behind the mark like the
 * last light. Everything gathers back into the mark. By night the ridges are dark roast and the light
 * is lamplight.
 *
 * How it sits on the page:
 *  - One zero-height layer (.dh) inserted between the How room and the closing; it paints above both
 *    rooms' grounds and BELOW all their content (which sits at z 1), so the glow is behind the mark.
 *  - It adds a little air to the bottom of How we work (24/32/40px), the mirror of what soft horizon
 *    adds to its top, and measures the clear air: no painted layer (in any pose of the motion) comes
 *    within 26px (phone) / 32px (desktop) of the lowest word of How we work, and the ridges end far
 *    above the mark. No star (the story thread has it).
 *  - Gouache, painted once into canvases (matte body, a quiet edge tone, brushed streaks along the
 *    contour, mottle, fine grain, flanks modelled by the light), with the live colours from CSS;
 *    repainted only when the size or day/night changes. The two big soft lights are dithered so
 *    their long fades never show rings, and fall off to nothing with no visible oval edge.
 *  - Lost and found edges (polish pass): where a ridge lies low (the flat valley floor, the saddles)
 *    the mist lies over its crest and the edge is lost in a soft feather; it is found again where the
 *    land rises into a hill. The light on the crests is a dry brush that comes and goes, never a
 *    drawn contour, and never on a lost edge. So no long straight line crosses the page, by night
 *    either (the old hard edge must not come back as a lit line).
 *  - Motion is transform/opacity only: a passive scroll listener (rAF) while the seam is near, plus
 *    a slow mist drift and a breathing glow that run only while it is near.
 *  - prefers-reduced-motion: the finished dusk, still.
 */
(function () {
  'use strict';
  var how = document.querySelector('section[aria-labelledby="principle-title"]');
  var close = document.querySelector('section[aria-label="Closing"]');
  if (!how || !close || !close.querySelector('svg') || document.querySelector('.dh')) return;

  /* ---------------- style ---------------- */
  var css = [
    '/* ---------- Dusk horizon: the closing seam ---------- */',
    '.dh { position: relative; z-index: 0; height: 0; pointer-events: none; }',
    '.dh-stage { position: absolute; left: 0; right: 0; overflow: hidden; contain: layout paint style; }',
    '.dh-p { position: absolute; left: 0; top: 0; }',
    '.dh canvas { position: absolute; left: 0; top: 0; display: block; }',
    '.dh.is-near .dh-p { will-change: transform, opacity; }',
    '.dh.is-near .dh-rim { will-change: opacity; }',
    /* gently alive while near: the mist drifts, the glow breathes */
    '@media (prefers-reduced-motion: no-preference) {',
    '  .dh .dh-drift { animation: dh-drift 21s ease-in-out infinite alternate; animation-play-state: paused; }',
    '  .dh .dh-drift--r { animation-duration: 27s; animation-direction: alternate-reverse; }',
    '  .dh .dh-breathe { animation: dh-breathe 7.5s ease-in-out infinite alternate; animation-play-state: paused; }',
    '  .dh.is-near .dh-drift, .dh.is-near .dh-breathe { animation-play-state: running; will-change: transform, opacity; }',
    '}',
    '@keyframes dh-drift { from { transform: translateX(calc(-1 * var(--dh-m, 16px))); } to { transform: translateX(var(--dh-m, 16px)); } }',
    '@keyframes dh-breathe { from { opacity: 0.86; transform: scale(0.985); } to { opacity: 1; transform: scale(1.02); } }',
    /* a little more air at the bottom of How we work, so the hills stay low and never squeezed
       (soft horizon adds the same at the top of the room) */
    'section[aria-labelledby="principle-title"] > div:first-child { padding-bottom: calc(5rem + 24px); }',
    '@media (min-width: 640px) { section[aria-labelledby="principle-title"] > div:first-child { padding-bottom: calc(5rem + 32px); } }',
    '@media (min-width: 1024px) { section[aria-labelledby="principle-title"] > div:first-child { padding-bottom: calc(7rem + 40px); } }',
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'dh-style';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------------- DOM ---------------- */
  var dh = document.createElement('div');
  dh.className = 'dh';
  dh.setAttribute('aria-hidden', 'true');
  dh.innerHTML =
    '<div class="dh-stage">' +
    '<div class="dh-p" data-k="sky"><canvas></canvas></div>' +
    '<div class="dh-p" data-k="far"><canvas></canvas><canvas class="dh-rim"></canvas></div>' +
    '<div class="dh-p" data-k="mistL1"><div class="dh-p dh-drift"><canvas></canvas></div></div>' +
    '<div class="dh-p" data-k="mistR1"><div class="dh-p dh-drift dh-drift--r"><canvas></canvas></div></div>' +
    '<div class="dh-p" data-k="mid"><canvas></canvas><canvas class="dh-rim"></canvas></div>' +
    '<div class="dh-p" data-k="mistL2"><div class="dh-p dh-drift dh-drift--r"><canvas></canvas></div></div>' +
    '<div class="dh-p" data-k="mistR2"><div class="dh-p dh-drift"><canvas></canvas></div></div>' +
    '<div class="dh-p" data-k="near"><canvas></canvas><canvas class="dh-rim"></canvas></div>' +
    '<div class="dh-p" data-k="glow"><div class="dh-p dh-breathe"><canvas></canvas></div></div>' +
    '</div>' +
    '<span class="dh-probe" style="position:absolute;width:0;height:0;overflow:hidden"></span>';
  how.parentNode.insertBefore(dh, close);

  var stage = dh.querySelector('.dh-stage'), probe = dh.querySelector('.dh-probe');
  var layer = {};
  ['sky', 'far', 'mid', 'near', 'glow', 'mistL1', 'mistR1', 'mistL2', 'mistR2'].forEach(function (k) {
    var el = dh.querySelector('[data-k="' + k + '"]');
    layer[k] = { el: el, body: el.querySelector('canvas:not(.dh-rim)'), rim: el.querySelector('.dh-rim'), inner: el.querySelector('.dh-drift, .dh-breathe') };
  });
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkMQ = window.matchMedia('(prefers-color-scheme: dark)');

  /* ---------------- small helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  function lum(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function cssColor(v, fb) {
    probe.style.color = '';
    probe.style.color = 'var(' + v + ', ' + fb + ')';
    var m = getComputedStyle(probe).color.match(/[\d.]+/g);
    return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null;
  }
  function hash(i, j, s) {
    var h = (Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(s + 101, 0x85ebca6b)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }
  function noise(x, y, s) { // smooth value noise, 0..1
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /* ---------------- colours (read live from the page, day or night) ---------------- */
  var pal = null;
  function readPalette() {
    var P = cssColor('--room-how', '#e0d4d3'), G = cssColor('--paper', '#f7f2eb');
    var Mv = cssColor('--mauve', '#b799a0'), Sa = cssColor('--sand', '#dcc4b2'), O = cssColor('--olive', '#8d9177');
    if (!P || !G) return null;
    var night = lum(G) < 0.35;
    var key = [P, G, Mv, Sa].join('|') + night;
    if (night) {
      var lamp = [255, 200, 138];
      return {
        key: key, night: true, P: P, G: G,
        // dark roast ridges, darker as they come nearer; the haze at their feet a lighter cup
        far: { top: mix(mix(P, G, 0.22), Mv, 0.05), body: mix(P, G, 0.28), haze: mix(P, G, 0.08) },
        mid: { top: mix(mix(P, G, 0.5), Mv, 0.03), body: mix(P, G, 0.56), haze: mix(P, G, 0.34) },
        // the near bank only a cup darker than the mid hills at its crest, deepening to the roast as it
        // comes down, so it never reads as a dark belt across the page
        near: { top: mix(P, G, 0.62), body: mix(P, G, 0.82), haze: G },
        sky: lamp, skyA: 0.13, glow: lamp, glowA: 0.2,
        rim: lamp, rimA: 0.6, rimFloor: 0,
        mist: mix(P, lamp, 0.14), mistA: 0.55,
        tree: mix(mix(P, G, 0.62), O, 0.06), treeLit: mix(mix(P, G, 0.2), lamp, 0.22), trunk: mix(G, [0, 0, 0], 0.35),
        shade: -0.05, light: 0.1,
      };
    }
    var peach = [255, 236, 214];
    return {
      key: key, night: false, P: P, G: G,
      // the pink's own tones: deeper rose far away, sand-rose between, a pale blush near
      far: { top: mix(P, Mv, 0.36), body: mix(P, Mv, 0.24), haze: mix(P, G, 0.12) },
      mid: { top: mix(mix(P, Sa, 0.3), Mv, 0.14), body: mix(mix(P, Sa, 0.2), G, 0.12), haze: mix(P, G, 0.5) },
      near: { top: mix(P, G, 0.5), body: mix(P, G, 0.72), haze: G },
      // the last light by day: a rosy peach (the pink's own warmth), never a yellow sun
      sky: [255, 233, 214], skyA: 0.6, glow: [253, 230, 212], glowA: 0.62,
      rim: peach, rimA: 0.95, rimFloor: 0.06,
      mist: mix(G, [255, 255, 255], 0.35), mistA: 0.7,
      tree: mix(mix(Mv, O, 0.35), [74, 56, 40], 0.18), treeLit: mix(mix(Sa, Mv, 0.3), peach, 0.3), trunk: mix([111, 82, 62], P, 0.3),
      shade: -0.07, light: 0.05,
    };
  }

  /* ---------------- the ridges: low, soft, every one dipping toward the middle (u = 0) ---------------- */
  // rise above the seam in px at full size; bumps are [centre u, width u, height px]; rip = a slow ripple
  var PROF = {
    far: { base: 20, bumps: [[-0.72, 0.13, 38], [-0.47, 0.085, 28], [-0.95, 0.08, 14], [-0.2, 0.07, 7], [0.5, 0.12, 42], [0.75, 0.1, 25], [0.97, 0.07, 10], [0.24, 0.07, 6], [0, 0.09, -9]], rip: [1.5, 13, 0.7], seed: 11 },
    mid: { base: 9, bumps: [[-0.3, 0.085, 31], [-0.58, 0.1, 18], [-0.88, 0.12, 22], [0.33, 0.09, 27], [0.62, 0.1, 16], [0.9, 0.11, 24], [0, 0.1, -4]], rip: [1.1, 17, 2.1], seed: 23 },
    near: { base: 7, bumps: [[-0.7, 0.2, 15], [-0.2, 0.1, 4], [0.62, 0.2, 13], [0.16, 0.08, 3]], rip: [0.8, 21, 4.0], seed: 37 },
  };
  function gauss(u, c, w) { var d = (u - c) / w; return Math.exp(-0.5 * d * d); }
  var TALL = 1.28; // the whole range, a touch taller than drawn above (still low: about 85px at most)
  function rise(P, u) {
    var r = P.base + P.rip[0] * Math.sin(P.rip[1] * u + P.rip[2]);
    for (var i = 0; i < P.bumps.length; i++) r += P.bumps[i][2] * gauss(u, P.bumps[i][0], P.bumps[i][1]);
    return r * TALL;
  }
  function maxRise(P) { var m = 0; for (var k = 0; k <= 400; k++) m = Math.max(m, rise(P, -1 + k / 200)); return m; }
  var MAX = { far: maxRise(PROF.far), mid: maxRise(PROF.mid), near: maxRise(PROF.near) };
  var NEAR_MIN = (function () { var m = 1e9; for (var k = 0; k <= 400; k++) m = Math.min(m, rise(PROF.near, -1 + k / 200)); return m; })();
  // the crest line in stage px (y grows down), one sample per css px, with a hand-painted wobble
  function crest(P, W, seamY, s) {
    var n = W + 3, ys = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i - 1, u = (x - W / 2) / (W / 2);
      ys[i] = seamY - s * rise(P, u) + (noise(x / 9, P.seed, P.seed) - 0.5) * 0.7;
    }
    var lo = 1e9, hi = -1e9;
    for (i = 0; i < n; i++) { if (ys[i] < lo) lo = ys[i]; if (ys[i] > hi) hi = ys[i]; }
    return { ys: ys, min: lo, max: hi };
  }
  function at(ys, x) { var f = x + 1, i = Math.floor(f), t = f - i; i = clamp(i, 0, ys.length - 2); return ys[i] + (ys[i + 1] - ys[i]) * t; }

  /* ---------------- painting ---------------- */
  function size(cv, W, top, h, s, left) {
    cv.width = Math.max(1, Math.round(W * s)); cv.height = Math.max(1, Math.round(h * s));
    cv.style.width = W + 'px'; cv.style.height = h + 'px'; cv.style.top = top + 'px'; cv.style.left = (left || 0) + 'px';
    return cv.getContext('2d');
  }

  // "lost and found" edges: where a ridge lies low (the flat valley floor, the saddles between hills)
  // the evening mist lies over its crest and the edge is lost in a soft feather; where it rises into
  // a hill the edge is found again. So no ridge ever draws one long straight line across the page
  // (the old hard edge), by day or by night. Returns the feather width in css px at x.
  function softAt(r, g, ys, x) {
    if (!r.soft) return 0;
    var rr = (g.seamY - at(ys, x)) / Math.max(1, r.hi); // 0 at the seam .. 1 at the ridge's highest crest
    var lost = 1 - sstep(r.softLo, r.softHi, rr);
    return r.soft * lost * (0.4 + 0.6 * noise(x / 85, 7.7, r.seed + 21));
  }

  // one ridge body: matte gouache with a quiet edge tone, brushed streaks along the contour, mottle,
  // grain, and flanks lit by the low light in the middle; its foot dissolves into mist (the far and
  // middle ridges fade into the evening air; the near one becomes exactly the closing paper)
  function paintBody(lk, g, r, rg, c, s, room) {
    var W = g.W, top = Math.floor(rg.min - 2 - Math.max(room || 0, (r.soft || 0) * 0.45 + 1));
    var bot = r.end ? g.bandH : Math.min(g.bandH, Math.ceil(rg.max + r.fadeB * 1.3 + 2));
    var h = bot - top, ctx = size(lk.body, W, top, h, s);
    if (!ctx) return null;
    var w = lk.body.width, hh = lk.body.height, img = ctx.createImageData(w, hh), d = img.data;
    var ys = rg.ys, gx = g.gx, night = pal.night, seed = r.seed;
    var hR = +c.haze[0], hG = +c.haze[1], hB = +c.haze[2]; // plain numbers (keeps WebKit's fast path on repaints)
    for (var px = 0; px < w; px++) {
      var x = (px + 0.5) / s, ry = at(ys, x) - top;
      var sl = (at(ys, x + 1.5) - at(ys, x - 1.5)) / 3; // slope (y grows downward)
      var lx = 0.8 * clamp((gx - x) / (W * 0.2), -1, 1); // the light is low, in the middle
      var lam = (sl * lx + 0.6) / Math.sqrt(sl * sl + 1);
      var nearL = Math.exp(-Math.pow((x - gx) / (W * 0.5), 2));
      var mod = (lam - 0.6) * (lam > 0.6 ? pal.light * 2.2 : -pal.shade * 2.4) * (0.55 + 0.45 * nearL);
      var fm = (r.end ? 0.8 : 0.7) + 0.6 * noise(x / 150, 2.5, seed + 9); // the mist eats in unevenly
      var fs = softAt(r, g, ys, x), fw = Math.max(1.15 / s, fs), lostE = clamp(fs / 4, 0, 1);
      var y0 = Math.max(0, Math.floor((ry - 1 - fw * 0.4) * s));
      for (var py = y0; py < hh; py++) {
        var y = (py + 0.5) / s, dep = Math.max(0, y - ry) / fm;
        var cov = fs > 1.15 / s ? sstep(-0.4 * fw, 0.6 * fw, y - ry) : clamp((y - ry) * s / 1.15 + 0.5, 0, 1);
        if (cov <= 0) continue;
        // below the painted part: a far or middle ridge has faded into the air (nothing to paint, and
        // nothing more further down), the near bank has become exactly the paper (no brushwork needed)
        var hz = sstep(r.fadeA * 0.6, r.fadeB, dep);
        if (r.end) hz = Math.max(hz, sstep(g.groundY - g.mist * 0.55 - top, g.groundY - top, y)); // exactly the paper
        var o = (py * w + px) * 4;
        if (!r.end && dep >= r.fadeB) break;
        if (hz >= 1) { d[o] = hR; d[o + 1] = hG; d[o + 2] = hB; d[o + 3] = cov * 255 + 0.5; continue; }
        var t = sstep(0, r.fadeA + (r.fadeB - r.fadeA) * 0.5, dep);
        var R0 = c.top[0] + (c.body[0] - c.top[0]) * t, G0 = c.top[1] + (c.body[1] - c.top[1]) * t, B0 = c.top[2] + (c.body[2] - c.top[2]) * t;
        var k = mod * Math.exp(-dep / 14);
        k += (noise(x / 110, dep / 3.2, seed) - 0.5) * 0.04 * Math.exp(-dep / 36); // streaks along the contour
        k += (noise(x / 240, (y + top) / 40, seed + 3) - 0.5) * 0.028; // mottle
        k += (hash(px, py, seed) - 0.5) * 0.02; // grain
        if (dep * fm < 1.6) k -= 0.045 * (1 - dep * fm / 1.6) * (1 - lostE); // the quiet edge tone (none where the edge is lost)
        var lift = night ? k * 110 : 0, mul = night ? 1 : 1 + k;
        R0 = R0 * mul + lift; G0 = G0 * mul + lift; B0 = B0 * mul + lift * 0.8;
        R0 += (c.haze[0] - R0) * hz; G0 += (c.haze[1] - G0) * hz; B0 += (c.haze[2] - B0) * hz;
        var a = cov * (r.end ? 1 : 1 - sstep(r.fadeA, r.fadeB, dep));
        d[o] = R0; d[o + 1] = G0; d[o + 2] = B0; d[o + 3] = a * 255 + 0.5;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { top: top, h: h, ctx: ctx };
  }

  // the last light catching a crest (its own canvas, so it can warm as the light rises)
  // the light is caught in touches, a dry brush along the crest that comes and goes, never a drawn
  // contour; none where the edge is lost in mist; by night a little softer and wider, like lamplight
  function paintRim(lk, g, r, rg, b, s, strength) {
    var tail = pal.night ? 7 : 4, fall = pal.night ? 0.62 : 0.95;
    var W = g.W, top = b.top, h = Math.min(b.h, Math.ceil(rg.max - top + tail + 4));
    var ctx = size(lk.rim, W, top, h, s);
    if (!ctx) return;
    var w = lk.rim.width, hh = lk.rim.height, img = ctx.createImageData(w, hh), d = img.data;
    var ys = rg.ys, gx = g.gx, col = pal.rim;
    for (var px = 0; px < w; px++) {
      var x = (px + 0.5) / s, ry = at(ys, x) - top;
      var sl = (at(ys, x + 1.5) - at(ys, x - 1.5)) / 3;
      var side = clamp((gx - x) / (W * 0.2), -1, 1);
      var face = clamp(0.55 + side * sl * 2.2 - Math.abs(sl) * 0.4, 0.15, 1); // flanks facing the light catch more
      var hor = pal.rimFloor + (1 - pal.rimFloor) * Math.exp(-Math.pow((x - gx) / (W * 0.27), 2));
      var touch = 0.3 + 0.7 * sstep(0.32, 0.64, noise(x / 42, 1.5, r.seed + 6)); // comes and goes
      var found = 1 - clamp(softAt(r, g, ys, x) / 4, 0, 1);
      var A = pal.rimA * strength * face * hor * touch * found * (0.85 + 0.3 * noise(x / 30, 0.5, 4));
      if (A < 0.004) continue;
      var y0 = Math.max(0, Math.floor((ry - 1) * s)), y1 = Math.min(hh, Math.ceil((ry + tail) * s));
      for (var py = y0; py < y1; py++) {
        var dep = (py + 0.5) / s - ry;
        var cov = clamp(dep * s / 1.15 + 0.5, 0, 1);
        var prof = dep < 0.8 ? 1 : Math.exp(-(dep - 0.8) * fall);
        var a = A * cov * prof;
        if (a <= 0) continue;
        var o = (py * w + px) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // a few little gouache trees on the middle ridge, standing on hilltops away from the mark's axis
  function paintTrees(b, g, rg, s, spots, scale) {
    var ctx = b.ctx, gx = g.gx;
    ctx.setTransform(s, 0, 0, s, 0, -b.top * s);
    spots.forEach(function (sp) {
      var cx = sp.x * g.W, best = cx, by0 = 1e9, span = g.W * 0.06;
      for (var xx = cx - span; xx <= cx + span; xx += 2) { var yy = at(rg.ys, clamp(xx, 4, g.W - 4)); if (yy < by0) { by0 = yy; best = xx; } }
      for (var n = 0; n < sp.n; n++) {
        var j = hash(n, sp.seed, 5), j2 = hash(sp.seed, n, 9);
        var x = clamp(best + (n - (sp.n - 1) / 2) * 8 * scale + (j - 0.5) * 3 * scale, 6, g.W - 6);
        var hgt = (10 + j2 * 5) * scale * (n % 2 ? 0.78 : 1);
        var wid = hgt * (0.46 + j * 0.1);
        var by = at(rg.ys, x) + 1.5 * scale;
        var lit = gx > x ? 1 : -1;
        ctx.strokeStyle = rgb(pal.trunk); ctx.lineWidth = Math.max(0.9, 1.05 * scale); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by - hgt * 0.42); ctx.stroke();
        var cy = by - hgt * 0.58;
        var grd = ctx.createRadialGradient(x + lit * wid * 0.3, cy - hgt * 0.16, 0.5, x, cy, hgt * 0.62);
        grd.addColorStop(0, rgb(pal.treeLit)); grd.addColorStop(0.55, rgb(mix(pal.treeLit, pal.tree, 0.65))); grd.addColorStop(1, rgb(pal.tree));
        ctx.fillStyle = grd;
        // a crown like a small petal standing on end
        ctx.beginPath();
        ctx.moveTo(x, cy - hgt * 0.44);
        ctx.bezierCurveTo(x + wid * 0.62, cy - hgt * 0.3, x + wid * 0.62, cy + hgt * 0.26, x, cy + hgt * 0.32);
        ctx.bezierCurveTo(x - wid * 0.62, cy + hgt * 0.26, x - wid * 0.62, cy - hgt * 0.3, x, cy - hgt * 0.44);
        ctx.fill();
      }
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // a soft oval of light (no disc, no point), with a fine dither so its long fade never shows rings;
  // ryCss (optional) paints only the top of a taller oval whose centre sits on the canvas's bottom edge
  function paintLight(cv, cssW, cssH, col, maxA, bg, ryCss) {
    var s = Math.min(2, window.devicePixelRatio || 1);
    var ctx = size(cv, cssW, 0, cssH, s);
    if (!ctx) return;
    var w = cv.width, h = cv.height, img = ctx.createImageData(w, h), d = img.data;
    var diff = Math.max(Math.abs(col[0] - bg[0]), Math.abs(col[1] - bg[1]), Math.abs(col[2] - bg[2]), 1);
    var amp = clamp((0.6 * 255) / diff, 0.8, 6); // alpha noise worth about half a level of the strongest channel
    var TAB = new Float32Array(1025);
    // falloff in r^2 with a zero slope at the rim, so the oval never shows its own edge (a breath of
    // light, not a shape): the same soft family as soft horizon's light
    for (var q = 0; q <= 1024; q++) { var t = q / 1024, f = 1 - t; TAB[q] = Math.exp(-2.2 * t) * f * f * maxA * 255; }
    var cx = w / 2, cy = ryCss ? h : h / 2, ix = 2 / w, iy = ryCss ? 1 / (ryCss * s) : 2 / h;
    for (var y = 0; y < h; y++) {
      var dy = (y + 0.5 - cy) * iy, dy2 = dy * dy;
      for (var x = 0; x < w; x++) {
        var dx = (x + 0.5 - cx) * ix, rr = dx * dx + dy2;
        if (rr >= 1) continue;
        var a = TAB[(rr * 1024) | 0];
        var av = a + (hash(x, y, 77) - 0.5) * 2 * amp * Math.min(1, a / (2 * amp));
        var o = (y * w + x) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = av <= 0 ? 0 : av >= 255 ? 255 : av + 0.5;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // a veil of mist: soft wisps stretched along the valley, fading out at both ends
  function paintMist(lk, g, m) {
    var Mg = g.drift, W = Math.round(m.w + Mg * 2), s = 0.5;
    var top = Math.floor(m.cy - m.sig * 3), h = Math.ceil(m.sig * 6);
    var ctx = size(lk.body, W, 0, h, s);
    if (!ctx) return;
    lk.inner.style.top = top + 'px'; lk.inner.style.left = Math.round(m.x - Mg) + 'px';
    lk.inner.style.width = W + 'px'; lk.inner.style.height = h + 'px';
    lk.inner.style.setProperty('--dh-m', Mg + 'px');
    var w = lk.body.width, hh = lk.body.height, img = ctx.createImageData(w, hh), d = img.data, col = pal.mist;
    for (var py = 0; py < hh; py++) {
      var y = (py + 0.5) / s, dy = (y - m.sig * 3) / m.sig;
      var prof = Math.exp(-dy * dy * 0.5);
      for (var px = 0; px < w; px++) {
        var x = (px + 0.5) / s, ex = x / W;
        var ends = sstep(0, 0.3, ex) * sstep(1, 0.7, ex);
        var n = noise(x / 150, y / 14, m.seed) * 0.65 + noise(x / 55, y / 7, m.seed + 1) * 0.35;
        var a = sstep(0.3, 0.76, n) * prof * ends * pal.mistA;
        var o = (py * w + px) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ---------------- measuring the clear air (so nothing ever reaches a word or the mark) ---------------- */
  function revealY(el) {
    if (!el) return 0;
    var t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    var m = t.match(/matrix(3d)?\(([^)]+)\)/);
    if (!m) return 0;
    var v = m[2].split(',').map(parseFloat);
    return m[1] ? v[13] : v[5];
  }
  function measure() {
    var sy = window.scrollY;
    var hr = how.getBoundingClientRect();
    var seam = hr.bottom + sy, low = hr.top + sy;
    var tw = document.createTreeWalker(how, NodeFilter.SHOW_TEXT), rg = document.createRange();
    while (tw.nextNode()) {
      var tn = tw.currentNode;
      if (!tn.textContent.trim()) continue;
      rg.selectNodeContents(tn);
      var rs = rg.getClientRects();
      var host = tn.parentElement && tn.parentElement.closest('[data-reveal]');
      var lift = revealY(host); // the How room's words reveal with a lift; measure where they rest
      for (var i = 0; i < rs.length; i++) low = Math.max(low, rs[i].bottom + sy - lift);
    }
    var off = revealY(close.querySelector('[data-reveal]'));
    var mr = close.querySelector('svg').getBoundingClientRect();
    return {
      W: Math.round(document.documentElement.clientWidth),
      seam: seam, low: low,
      markTop: mr.top + sy - off, markBot: mr.bottom + sy - off, markCx: mr.left + mr.width / 2,
      docH: document.documentElement.scrollHeight,
    };
  }

  /* ---------------- layout ---------------- */
  var M = null, G = null;
  function px(v) { return Math.round(v) + 'px'; }
  function place() {
    M = measure();
    var W = M.W, narrow = W < 640;
    var gapAbove = M.seam - M.low, gapBelow = M.markTop - M.seam;
    var clear = narrow ? 26 : 32;
    var settle = narrow ? 9 : 15; // how far the far range starts above its rest (counted in the clear air)
    var s = clamp(W / 1440, 0.58, 1);
    if (MAX.far * s + settle > gapAbove - clear) s = Math.max(0.3, (gapAbove - clear - settle) / MAX.far);
    var mist = Math.round(clamp(gapBelow * 0.4, 24, 54));
    var k = narrow ? 0.62 : 1;
    var top = Math.ceil(gapAbove - 4); // the stage starts just under the lowest word of How we work
    var markCy = (M.markTop + M.markBot) / 2 - M.seam; // the mark's centre, below the seam
    // a wide low oval (the last light lies along the valley); on a phone it stays wider than tall, so
    // it never reads as a round sun or a halo around the mark
    var rx = clamp(W * 0.24, 172, 350), ry = Math.min(rx * (narrow ? 0.6 : 0.5), markCy + 20);
    var gLift = Math.round(markCy * 0.22); // the light leans up from the mark toward the hills
    var bandH = top + mist + 4; // the ridges end here, far above the mark
    // the warm sky: the top half of a low oval resting on the horizon, ending well under the words
    var skyH = Math.min(top - 24, Math.round(MAX.far * s + 30)), skyW = Math.round(W * 0.86);
    G = {
      W: W, s: s, top: top, mist: mist, k: k, narrow: narrow, settle: settle,
      gx: M.markCx, seamY: top, groundY: top + mist, bandH: bandH,
      // where each ridge starts (px from its rest) when the seam enters the screen: the far range a
      // little above (it settles), the middle hills a little below (they rise), the near bank barely
      // below (never so far that the old edge could show under it)
      // soft: the widest feather where the ridge lies low (softLo..softHi of its height, see softAt)
      far: { fadeA: 5, fadeB: 34, end: 0, seed: PROF.far.seed, from: -settle, soft: 0, softLo: 0, softHi: 1, hi: MAX.far * s },
      mid: { fadeA: 5, fadeB: 30, end: 0, seed: PROF.mid.seed, from: Math.round(17 * k), soft: 8 * k, softLo: 0.22, softHi: 0.5, hi: MAX.mid * s },
      near: { fadeA: 3, fadeB: 26, end: 1, seed: PROF.near.seed, from: clamp(NEAR_MIN * s - 3, 0, 4), soft: 18 * k, softLo: 0.42, softHi: 0.82, hi: MAX.near * s },
      glow: { x: M.markCx - rx, y: top + markCy - gLift - ry, w: Math.round(rx * 2), h: Math.round(ry * 2), rise: Math.round(64 * k) },
      sky: { x: (W - skyW) / 2, y: top - skyH, w: skyW, h: skyH + 6, ry: skyH },
      mists: {
        mistL1: { x: W * 0.04, w: W * 0.4, cy: top - 30 * s, sig: 7 * Math.max(s, 0.7), seed: 5 },
        mistR1: { x: W * 0.56, w: W * 0.4, cy: top - 26 * s, sig: 6.5 * Math.max(s, 0.7), seed: 7 },
        mistL2: { x: W * 0.08, w: W * 0.36, cy: top - 8 * s, sig: 6 * Math.max(s, 0.7), seed: 9 },
        mistR2: { x: W * 0.56, w: W * 0.36, cy: top - 10 * s, sig: 6 * Math.max(s, 0.7), seed: 13 },
      },
      gather: narrow ? 28 : 76, drift: narrow ? 10 : 18,
      stageH: Math.ceil(top + markCy - gLift + ry + 8),
    };
    stage.style.top = px(-top);
    stage.style.height = px(G.stageH);
    var gl = layer.glow;
    gl.el.style.left = px(G.glow.x); gl.el.style.top = px(G.glow.y); gl.el.style.width = px(G.glow.w); gl.el.style.height = px(G.glow.h);
    gl.inner.style.width = px(G.glow.w); gl.inner.style.height = px(G.glow.h);
    var sk = layer.sky;
    sk.el.style.left = px(G.sky.x); sk.el.style.top = px(G.sky.y);
    lastP = -1;
  }

  var built = '', building = false, again = false;
  function build() {
    if (building) { again = true; return; } // asked again while painting (e.g. day/night flipped): paint once more after
    if (!G) return;
    var p = readPalette();
    if (!p) return;
    var g = G;
    var want = p.key + '|' + g.W + '|' + g.top + '|' + g.mist + '|' + Math.round(g.s * 1000) + '|' + Math.round(g.gx) + '|' + g.glow.w + 'x' + g.glow.h + '|' + (window.devicePixelRatio || 1);
    if (want === built) return;
    pal = p; building = true;
    var s = Math.min(2, window.devicePixelRatio || 1);
    var scale = clamp(g.s * 1.05, 0.7, 1.05);
    var dark = pal.night;
    // small steps (each ridge's body, then its light), so no single task holds a frame for long
    var R = {};
    function ridge(k, room) { R[k] = { rg: crest(PROF[k], g.W, g.seamY, g.s) }; R[k].b = paintBody(layer[k], g, g[k], R[k].rg, pal[k], s, room); }
    var steps = [
      function () { paintLight(layer.glow.body, g.glow.w, g.glow.h, pal.glow, pal.glowA, pal.G); },
      function () { paintLight(layer.sky.body, g.sky.w, g.sky.h, pal.sky, pal.skyA, pal.P, g.sky.ry + 6); },
      function () { ridge('far'); },
      function () { if (R.far.b) paintRim(layer.far, g, g.far, R.far.rg, R.far.b, Math.min(s, 1.5), 0.75); },
      function () { ['mistL1', 'mistR1'].forEach(function (k) { paintMist(layer[k], g, g.mists[k]); }); },
      function () {
        ridge('mid', 16 * scale);
        if (R.mid.b) paintTrees(R.mid.b, g, R.mid.rg, s, g.narrow ? [{ x: 0.2, n: 2, seed: 3 }] : [{ x: 0.21, n: 3, seed: 3 }, { x: 0.79, n: 2, seed: 8 }], scale * 0.8);
      },
      function () { if (R.mid.b) paintRim(layer.mid, g, g.mid, R.mid.rg, R.mid.b, Math.min(s, 1.5), 0.9); },
      function () { ['mistL2', 'mistR2'].forEach(function (k) { paintMist(layer[k], g, g.mists[k]); }); },
      function () { ridge('near'); },
      function () { if (R.near.b) paintRim(layer.near, g, g.near, R.near.rg, R.near.b, Math.min(s, 1.5), 0.8); },
    ];
    var i = 0;
    (function next() {
      if (G !== g) { building = false; build(); return; } // the size changed while painting: start again
      steps[i++]();
      if (i < steps.length) { setTimeout(next, 0); return; }
      building = false; built = want; lastP = -1; frame();
      dh.dataset.painted = dark ? 'night' : 'day';
      if (again) { again = false; build(); }
    })();
  }

  /* ---------------- motion: from the seam entering the screen to the mark at rest ---------------- */
  var raf = 0, near = false, lastP = -1;
  function tf(el, x, y, sc) { el.style.transform = 'translate3d(' + r2(x) + 'px,' + r2(y) + 'px,0)' + (sc ? ' scale(' + sc.toFixed(3) + ')' : ''); }
  function frame() {
    raf = 0;
    if (!M || !G) return;
    var p = 1;
    if (!reduceMQ.matches) {
      var vh = window.innerHeight || 800;
      var maxY = Math.max(0, M.docH - vh);
      var y0 = M.seam - vh * 0.98;
      var y1 = Math.min(maxY, (M.markTop + M.markBot) / 2 - vh * 0.56);
      if (y1 < y0 + 160) y1 = y0 + 160;
      p = clamp((window.scrollY - y0) / (y1 - y0), 0, 1);
    }
    if (Math.abs(p - lastP) < 0.0004) return;
    lastP = p;
    var e = p * p * (3 - 2 * p), u = 1 - e;
    // descending into the valley at dusk: the far range settles as the nearer hills rise past it
    tf(layer.far.el, 0, u * G.far.from);
    tf(layer.mid.el, 0, u * G.mid.from);
    tf(layer.near.el, 0, u * G.near.from);
    // the mist gathers in from the sides toward the middle
    var gx = u * G.gather;
    tf(layer.mistL1.el, -gx, 0); tf(layer.mistR1.el, gx, 0);
    tf(layer.mistL2.el, -gx * 0.7, 0); tf(layer.mistR2.el, gx * 0.7, 0);
    var ma = (0.35 + 0.65 * e).toFixed(3);
    layer.mistL1.el.style.opacity = layer.mistR1.el.style.opacity = layer.mistL2.el.style.opacity = layer.mistR2.el.style.opacity = ma;
    // the last light: the sky above the valley warms, then the glow rises behind the mark
    var es = sstep(0.1, 0.7, p);
    tf(layer.sky.el, 0, (1 - es) * 12 * G.k); layer.sky.el.style.opacity = es.toFixed(3);
    var gw = clamp((p - 0.2) / 0.8, 0, 1), eg = 1 - Math.pow(1 - gw, 2.2);
    tf(layer.glow.el, 0, (1 - eg) * G.glow.rise, 0.8 + 0.2 * eg); layer.glow.el.style.opacity = eg.toFixed(3);
    // and the crests nearest the middle catch it
    var rim = Math.pow(sstep(0.15, 1, p), 1.3);
    layer.far.rim.style.opacity = (rim * 0.85).toFixed(3);
    layer.mid.rim.style.opacity = rim.toFixed(3);
    layer.near.rim.style.opacity = Math.pow(rim, 1.5).toFixed(3);
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(frame); }

  var io = new IntersectionObserver(function (entries) {
    var on = entries[entries.length - 1].isIntersecting;
    if (on) build();
    if (on === near) return;
    near = on;
    dh.classList.toggle('is-near', on);
    if (on) { window.addEventListener('scroll', onScroll, { passive: true }); lastP = -1; frame(); }
    else window.removeEventListener('scroll', onScroll);
  }, { rootMargin: '90% 0px 90% 0px' });

  // re-measure when anything moves the rooms; repaint only when the size or the colours change
  var t1 = 0;
  function relayout() {
    clearTimeout(t1);
    t1 = setTimeout(function () { place(); if (near || built) build(); frame(); }, 140);
  }
  place();
  frame();
  io.observe(stage);
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(relayout); ro.observe(how); ro.observe(close); }
  window.addEventListener('resize', relayout);
  var rv = close.querySelector('[data-reveal]');
  if (rv) rv.addEventListener('transitionend', relayout);
  var themeCheck = function () { if (built || near) { place(); build(); frame(); } };
  new MutationObserver(themeCheck).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', themeCheck);
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function () { lastP = -1; frame(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  setTimeout(relayout, 1500);
  window.__dh = { place: place, build: build, frame: frame, get G() { return G; }, get M() { return M; } };
})();
