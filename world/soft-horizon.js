/*
 * Soft horizon: the seam between Chrome Extensions and How we work (sketch, ?seam=soft-horizon).
 * Preview only: injected into the running page, no project files changed.
 *
 * The hard colour edge between the sage-stone room and Eden's pink room becomes a low painted
 * horizon: three gentle ridges of rolling hills in sage-stone, their feet dissolving into the pink
 * of How we work like dawn mist lying in the valleys. As you scroll down to it, the far hills rise
 * into place, a pink-gold light rises behind them and catches their tops, the mist lifts and parts
 * sideways, and two small birds glide on towards the light (still gliding while the seam is in
 * view). At night the hills are dark roast, only a cup darker than the rooms, and the light is the
 * warm lamplight of the How room's cup, catching mostly the far crest and the mist near it.
 *
 * How it sits on the page:
 *  - One layer (#shz), inserted into <main> just before the story thread's svg, so it paints above
 *    the room grounds but always BELOW the thread and its star, and below all content (z 1).
 *  - It fills only the empty air between the last line of the Extensions room and the How we work
 *    eyebrow (it measures both), and adds a little air to the top of How we work so the hills
 *    are never squeezed.
 *  - The hills are painted once into canvases (gouache: matte body, soft edge tone, brushed contour
 *    streaks, fine grain, flanks modelled by the light), using the live room colours from CSS. The
 *    painting is split into ~5ms steps, one per frame, starting soon after load, and every layer
 *    appears at once when done; it is repainted only when the size or the day/night colours change.
 *  - Motion is transform/opacity only: one passive scroll listener (rAF), attached only while the
 *    seam is near (IntersectionObserver), plus a slow mist drift and the birds' occasional wing
 *    beats (CSS), which run only while near.
 *  - prefers-reduced-motion: the finished dawn, still (the birds rest mid-sky, wings open).
 */
(function () {
  'use strict';
  if (document.getElementById('shz')) return;
  var ext = document.querySelector('section#extensions');
  var how = document.querySelector('section[aria-labelledby="principle-title"]');
  if (!ext || !how || !how.parentElement) return;
  var main = how.parentElement;

  /* ---------------- style ---------------- */
  var css = [
    '/* ---------- Soft horizon: the seam between Chrome Extensions and How we work ---------- */',
    '#shz {',
    '  position: absolute; left: 0; top: 0; width: 100%; height: 0; z-index: 0;',
    '  pointer-events: none; overflow: hidden; contain: layout paint style;',
    '}',
    '#shz .shz-p { position: absolute; left: 0; top: 0; }',
    '#shz canvas { position: absolute; left: 0; top: 0; display: block; }',
    '#shz .shz-l { width: 100%; height: 100%; }',
    '/* the sky at the horizon turns from sage-stone to the pink of How we work (this alone hides the old edge) */',
    '#shz .shz-wash { width: 100%; }',
    '#shz.is-near .shz-l, #shz.is-near .shz-glow, #shz.is-near .shz-rim, #shz.is-near .shz-birds { will-change: transform, opacity; }',
    '/* two small birds, painted with the brush (a pair of tapered wing strokes), gliding towards the light */',
    '#shz .shz-birds { position: absolute; left: 0; top: 0; width: 0; height: 0; }',
    '#shz:not(.is-built) .shz-birds { visibility: hidden; }',
    '#shz .shz-bird { position: absolute; left: 0; top: 0; display: block; transform-origin: 50% 72%; }',
    '#shz .shz-bird svg { display: block; width: 100%; height: 100%; overflow: visible; }',
    '#shz .shz-bird path { fill: var(--shz-bird, #6b5443); fill-opacity: var(--shz-bird-a, 0.6); }',
    '/* the mist drifts, slowly, and the birds beat their wings now and then, only while the seam is near */',
    '@media (prefers-reduced-motion: no-preference) {',
    '  #shz .shz-drift { animation: shz-drift 23s ease-in-out infinite alternate; animation-play-state: paused; }',
    '  #shz .shz-drift--r { animation-duration: 31s; animation-direction: alternate-reverse; }',
    '  #shz .shz-drift--s { animation-duration: 41s; }',
    '  #shz .shz-bird { animation: shz-flap 3.1s ease-in-out infinite; animation-play-state: paused; }',
    '  #shz .shz-bird--b { animation-duration: 3.7s; animation-delay: -1.3s; }',
    '  #shz.is-near .shz-drift, #shz.is-near .shz-bird { animation-play-state: running; will-change: transform; }',
    '}',
    '@keyframes shz-drift { from { transform: translateX(calc(-1 * var(--shz-m, 40px))); } to { transform: translateX(var(--shz-m, 40px)); } }',
    '@keyframes shz-flap { 0%, 38%, 100% { transform: scaleY(1); } 8% { transform: scaleY(-0.45); } 16% { transform: scaleY(0.95); } 24% { transform: scaleY(-0.3); } 31% { transform: scaleY(0.9); } }',
    '/* a little more air at the top of How we work, so the hills are low and never squeezed */',
    'section[aria-labelledby="principle-title"] > div:first-child { padding-top: calc(5rem + 40px); }',
    '@media (min-width: 640px) { section[aria-labelledby="principle-title"] > div:first-child { padding-top: calc(5rem + 56px); } }',
    '@media (min-width: 1024px) { section[aria-labelledby="principle-title"] > div:first-child { padding-top: calc(7rem + 64px); } }',
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'shz-style';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------------- DOM ---------------- */
  // a bird far off: two tapered wing strokes meeting at a small body (filled, so it reads as a brush mark)
  function bird(mod) {
    return '<i class="shz-bird' + mod + '"><svg viewBox="0 0 24 10" focusable="false">' +
      '<path d="M0.6 4.7C4 1.7 8.3 1.3 11.2 5.5L12 6.6l0.8-1.1C15.7 1.3 20 1.7 23.4 4.7 19.6 3.3 15.9 3.9 12.9 7.9 12.4 8.7 11.6 8.7 11.1 7.9 8.1 3.9 4.4 3.3 0.6 4.7Z"/>' +
      '</svg></i>';
  }
  var root = document.createElement('div');
  root.id = 'shz';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML =
    '<div class="shz-p shz-wash"></div>' +
    '<canvas class="shz-glow shz-glow-a"></canvas>' +
    '<canvas class="shz-glow shz-glow-b"></canvas>' +
    '<div class="shz-p shz-l" data-k="far"><canvas></canvas><canvas class="shz-rim"></canvas></div>' +
    '<div class="shz-birds">' + bird('') + bird(' shz-bird--b') + '</div>' +
    '<div class="shz-p shz-l" data-k="mist1"><div class="shz-p shz-drift"><canvas></canvas></div></div>' +
    '<div class="shz-p shz-l" data-k="mid"><canvas></canvas><canvas class="shz-rim"></canvas></div>' +
    '<div class="shz-p shz-l" data-k="mist2"><div class="shz-p shz-drift shz-drift--r"><canvas></canvas></div></div>' +
    '<div class="shz-p shz-l" data-k="front"><canvas></canvas><canvas class="shz-rim"></canvas></div>' +
    '<div class="shz-p shz-l" data-k="mist3"><div class="shz-p shz-drift shz-drift--s"><canvas></canvas></div></div>' +
    '<span class="shz-probe" style="position:absolute;width:0;height:0;overflow:hidden"></span>';
  var story = null;
  for (var i = 0; i < main.children.length; i++) {
    var c = main.children[i];
    if (c.tagName.toLowerCase() === 'svg' && c.classList.contains('story')) { story = c; break; }
  }
  main.insertBefore(root, story || main.firstChild);

  var q = function (s) { return root.querySelector(s); };
  var wash = q('.shz-wash'), glowA = q('.shz-glow-a'), glowB = q('.shz-glow-b'), probe = q('.shz-probe');
  var birds = q('.shz-birds'), birdEls = root.querySelectorAll('.shz-bird');
  var layer = {};
  ['far', 'mid', 'front', 'mist1', 'mist2', 'mist3'].forEach(function (k) {
    var el = q('[data-k="' + k + '"]');
    layer[k] = { el: el, body: el.querySelector('canvas:not(.shz-rim)'), rim: el.querySelector('.shz-rim'), drift: el.querySelector('.shz-drift') };
  });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- small helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  function lum(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function cssColor(v, fb) {
    probe.style.color = '';
    probe.style.color = 'var(' + v + ', ' + fb + ')';
    var m = getComputedStyle(probe).color.match(/[\d.]+/g);
    return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null;
  }
  function rand(seed) { // mulberry32
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(i, j, s) {
    var h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise(x, y, s) { // smooth value noise, 0..1
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /* ---------------- colours (read live from the page, day or night) ---------------- */
  function readPalette() {
    var E = cssColor('--room-extensions', '#e1dfd8'), P = cssColor('--room-how', '#e0d4d3');
    var G = cssColor('--paper', '#f7f2eb'), S = cssColor('--sage', '#9da69f'), O = cssColor('--olive', '#8d9177');
    var Sa = cssColor('--sand', '#dcc4b2');
    if (!E || !P) return null;
    var night = lum(E) < 0.35;
    var key = [E, P, G, S, O].join('|') + night;
    if (night) {
      // dark roast hills, only a cup darker than the rooms (so the band never reads as a dark belt), with
      // a breath of the room's sage in them like the Lamplit Shelf in shade; the lamplight does the rest
      var amber = [255, 204, 146], EP = mix(E, P, 0.5);
      return {
        key: key, night: true, E: E, P: P,
        far: { top: mix(mix(E, G, 0.16), S, 0.04), body: mix(mix(E, G, 0.22), S, 0.03), haze: P },
        mid: { top: mix(mix(EP, G, 0.24), S, 0.05), body: mix(mix(EP, G, 0.30), S, 0.03), haze: P },
        front: { top: mix(mix(P, G, 0.26), O, 0.08), body: mix(mix(P, G, 0.30), O, 0.06), haze: P },
        glowA: [214, 160, 128], glowAa: 0.2, glowB: amber, glowBa: 0.34,
        rim: amber, rimA: 0.62, rimW: 0.25, rimFloor: 0,
        mist: mix(P, amber, 0.08), mistLit: mix(P, amber, 0.22), mistA: 0.62,
        tree: mix(mix(P, G, 0.62), O, 0.05), treeLit: mix(mix(P, G, 0.5), amber, 0.07), trunk: mix(G, [0, 0, 0], 0.2),
        bird: mix(G, [0, 0, 0], 0.15), birdA: 0.8,
        shade: -0.05, light: 0.10,
      };
    }
    var gold = [255, 238, 214];
    return {
      key: key, night: false, E: E, P: P,
      far: { top: mix(mix(E, S, 0.26), P, 0.24), body: mix(mix(E, S, 0.28), P, 0.30), haze: P },
      mid: { top: mix(mix(E, S, 0.40), P, 0.08), body: mix(mix(E, S, 0.42), P, 0.14), haze: P },
      front: { top: mix(mix(E, S, 0.48), O, 0.13), body: mix(mix(E, S, 0.46), O, 0.14), haze: P },
      glowA: [248, 235, 232], glowAa: 0.95, glowB: [253, 230, 196], glowBa: 1,
      rim: gold, rimA: 0.9, rimW: 0.33, rimFloor: 0.12,
      mist: mix(P, [255, 255, 255], 0.22), mistLit: mix(mix(P, [255, 255, 255], 0.3), gold, 0.35), mistA: 0.72,
      tree: mix(O, E, 0.18), treeLit: mix(mix(O, Sa, 0.35), gold, 0.25), trunk: mix([111, 82, 62], E, 0.35),
      bird: mix([95, 70, 52], E, 0.2), birdA: 0.62,
      shade: -0.07, light: 0.07,
    };
  }

  /* ---------------- layout: measure the free air between the two rooms ---------------- */
  var L = null;
  function measure() {
    var sy = window.scrollY;
    var positioned = getComputedStyle(main).position !== 'static';
    var base = positioned ? main.getBoundingClientRect().top + sy : 0;
    var W = Math.round(main.clientWidth || document.documentElement.clientWidth);
    var seam = how.getBoundingClientRect().top + sy - base;
    var hw = how.firstElementChild;
    var howTop = seam + (hw ? parseFloat(getComputedStyle(hw).paddingTop) || 0 : 0);
    var ew = ext.lastElementChild || ext;
    var er = ew.getBoundingClientRect();
    var extBottom = er.bottom + sy - base - (parseFloat(getComputedStyle(ew).paddingBottom) || 0);
    var gapT = W < 640 ? 16 : 24, gapB = W < 640 ? 18 : 26;
    var top = Math.round(extBottom + gapT), bottom = Math.round(howTop - gapB);
    var h = Math.max(60, bottom - top);
    return { W: W, top: top, h: h, A: seam - top, seamPage: seam + base, base: base };
  }

  /* the geometry of the drawing, in fractions of the band height (H) */
  function geometry(m) {
    var W = m.W, H = m.h, A = m.A;
    var narrow = W < 640;
    return {
      W: W, H: H, A: A,
      gx: W * (narrow ? 0.66 : 0.64), // where the light rises
      glow: { cy: H * 0.39, rx: clamp(W * 0.33, 190, 600), ry: H * 0.42, rise: H * 0.32 },
      far: { base: H * 0.405, amp: H * 0.17, lam: clamp(W * 0.40, 220, 700), fadeA: H * 0.07, fadeB: H * 0.26, end: 0, rise: H * 0.18, seed: 11 },
      mid: { base: H * 0.565, amp: H * 0.13, lam: clamp(W * 0.30, 165, 480), fadeA: H * 0.07, fadeB: H * 0.24, end: 0, rise: H * 0.09, seed: 23 },
      front: { base: H * 0.72, amp: H * 0.095, lam: clamp(W * 0.25, 140, 420), fadeA: H * 0.02, fadeB: H * 0.22 - 2, end: 1, rise: H * 0.018, seed: 37 },
      // the mist also parts sideways as you arrive (each band its own way), like walking into the valley
      mist1: { cy: H * 0.555, sig: H * 0.06, rise: H * 0.07, slide: narrow ? -10 : -22, seed: 5 },
      mist2: { cy: H * 0.70, sig: H * 0.055, rise: H * 0.035, slide: narrow ? 12 : 26, seed: 7 },
      mist3: { cy: H * 0.83, sig: H * 0.05, rise: H * 0.03, slide: narrow ? -8 : -18, seed: 9 },
      drift: narrow ? 22 : 40, slide: narrow ? 12 : 26,
      // two small birds gliding home towards the light, in the sky above the far hills
      birds: { x0: W * (narrow ? 0.16 : 0.27), x1: W * (narrow ? 0.44 : 0.50), y: H * 0.17, lift: H * 0.07, size: narrow ? 11 : 14 },
    };
  }

  /* a ridge of rolling hills: soft round tops, soft valleys (a sum of gentle bumps) */
  function ridge(W, r) {
    var R = rand(r.seed * 7919 + Math.round(W)), bumps = [], x = -r.lam * (0.25 + R() * 0.4);
    while (x < W + r.lam) {
      bumps.push({ c: x, h: 0.5 + R() * 0.5, s: r.lam * (0.28 + R() * 0.14) });
      x += r.lam * (0.72 + R() * 0.5);
    }
    var n = W + 3, ys = new Float32Array(n), lo = 1e9, hi = -1e9, i, v, j;
    for (i = 0; i < n; i++) {
      v = 0;
      for (j = 0; j < bumps.length; j++) { var d = (i - 1 - bumps[j].c) / bumps[j].s; if (d > -3 && d < 3) v += bumps[j].h * Math.exp(-d * d); }
      ys[i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
    var span = hi - lo || 1;
    for (i = 0; i < n; i++) {
      // highest point = base - amp/2, lowest = base + amp/2, with a hand-painted wobble
      ys[i] = r.base + r.amp * 0.5 - r.amp * (ys[i] - lo) / span + (noise((i - 1) / 9, r.seed, r.seed) - 0.5) * 0.7;
    }
    return { ys: ys, min: r.base - r.amp * 0.5 - 1, max: r.base + r.amp * 0.5 + 1 };
  }
  function at(ys, x) { var f = x + 1, i = Math.floor(f), t = f - i; i = clamp(i, 0, ys.length - 2); return ys[i] + (ys[i + 1] - ys[i]) * t; }

  /* ---------------- painting ----------------
   * Every layer is painted pixel by pixel into an offscreen buffer, a few milliseconds per frame (so
   * scrolling never stutters while it paints), and all of them are put on screen together at the end
   * (so a day/night change never shows half old, half new). */
  var scratch = document.createElement('canvas').getContext('2d');
  function buffer(w, h) { return scratch.createImageData(Math.max(1, w), Math.max(1, h)); }
  function commitTo(cv, img, cssW, cssH, top, left) {
    cv.width = img.width; cv.height = img.height;
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px'; cv.style.top = top + 'px';
    if (left != null) cv.style.left = left + 'px';
    var ctx = cv.getContext('2d');
    ctx.putImageData(img, 0, 0);
    return ctx;
  }

  // one ridge body: matte gouache with a quiet edge tone, brushed contour streaks, grain, and
  // flanks lit from the rising light; its foot dissolves into the pink (far and mid fade out over
  // the pink sky behind; the front ridge becomes exactly the How room colour at the bottom)
  function bodyJob(P, lk, g, r, rg, c, s, room, trees, tscale) {
    var W = g.W, top = Math.floor(rg.min - 2 - (room || 0));
    var bot = Math.min(g.H, r.end ? g.H : Math.ceil(rg.max + r.fadeB * 2 + 2)), h = bot - top;
    var w = Math.round(W * s), hh = Math.round(h * s), img = buffer(w, hh), d = img.data;
    var ys = rg.ys, gx = g.gx, night = P.night, seed = r.seed;
    return {
      n: w, top: top, h: h,
      unit: function (px) {
        var x = (px + 0.5) / s, ry = at(ys, x) - top;
        var sl = (at(ys, x + 1.5) - at(ys, x - 1.5)) / 3; // slope (y grows downward)
        var lx = 0.8 * clamp((gx - x) / (W * 0.18), -1, 1); // towards the light, turning smoothly beneath it
        var lam = (sl * lx + 0.6) / Math.sqrt(sl * sl + 1); // Lambert, the light low and towards the glow
        var near = Math.exp(-Math.pow((x - gx) / (W * 0.55), 2));
        var mod = (lam - 0.6) * (lam > 0.6 ? P.light * 2.2 : -P.shade * 2.4) * (0.6 + 0.4 * near);
        // the mist eats into each hill unevenly, so the feet never make a straight band: it lies in the
        // valleys (a wandering mist line at about one height), so a hill shows deeper under its peaks
        var fm = (r.end ? 0.8 : 0.7) + 0.6 * noise(x / 140, 2.5, seed + 9);
        var ml = r.base + r.amp * 0.15 + (noise(x / 210, 1.5, seed + 5) - 0.5) * r.amp * 0.9 - top;
        for (var py = Math.max(0, Math.floor((ry - 1) * s)); py < hh; py++) {
          var y = (py + 0.5) / s, dep = (y - ry) / fm;
          var cov = clamp(dep * fm * s / 1.15 + 0.5, 0, 1);
          if (cov <= 0) continue;
          var fd = ((y - ry) * 0.65 + Math.max(0, y - ml) * 0.35) / fm; // how deep into the mist
          var t = sstep(0, r.fadeA + (r.fadeB - r.fadeA) * 0.5, fd);
          var R0 = c.top[0] + (c.body[0] - c.top[0]) * t, G0 = c.top[1] + (c.body[1] - c.top[1]) * t, B0 = c.top[2] + (c.body[2] - c.top[2]) * t;
          // modelling (strongest near the crest), brushed streaks along the contour, mottling, grain
          var k = mod * Math.exp(-dep / 16);
          k += (noise(x / 120, dep / 3.4, seed) - 0.5) * 0.045 * Math.exp(-dep / 40);
          k += (noise(x / 260, (y + top) / 42, seed + 3) - 0.5) * 0.03;
          k += (hash(px, py, seed) - 0.5) * 0.022;
          if (dep * fm < 1.7) k -= 0.05 * (1 - dep * fm / 1.7); // the quiet edge tone, a deeper shade of its own colour
          var lift = night ? k * 120 : 0, mul = night ? 1 : 1 + k;
          R0 = R0 * mul + lift; G0 = G0 * mul + lift; B0 = B0 * mul + lift * 0.8;
          // the foot dissolves into the pink mist
          var hz = sstep(r.fadeA * 0.6, r.fadeB, fd);
          // exactly the How room at the bottom; where the front hill's foot sinks into it wanders, so it is never a straight edge
          if (r.end) hz = Math.max(hz, sstep(g.H * (0.76 + 0.12 * noise(x / 170, 4.5, seed + 11)), g.H - 1.5, y + top));
          R0 += (c.haze[0] - R0) * hz; G0 += (c.haze[1] - G0) * hz; B0 += (c.haze[2] - B0) * hz;
          var a = cov * (r.end ? 1 : 1 - sstep(r.fadeA, r.fadeB, fd));
          var o = (py * w + px) * 4;
          d[o] = R0; d[o + 1] = G0; d[o + 2] = B0; d[o + 3] = a * 255;
        }
      },
      commit: function () {
        var ctx = commitTo(lk.body, img, W, h, top);
        if (trees) paintTrees(P, ctx, top, g, rg, s, trees, tscale);
      },
    };
  }

  // the light catching the crest of a ridge (its own canvas, so it can brighten as the light rises)
  function rimJob(P, lk, g, rg, body, s, strength) {
    // by night the lamplight on a crest is a little softer and wider than the day's fine gold edge
    var tail = P.night ? 7.5 : 4.2, fall = P.night ? 0.6 : 0.9;
    var W = g.W, top = body.top, h = Math.min(body.h, Math.ceil(rg.max - top + tail + 4));
    var w = Math.round(W * s), hh = Math.round(h * s), img = buffer(w, hh), d = img.data;
    var ys = rg.ys, gx = g.gx, col = P.rim;
    return {
      n: w,
      unit: function (px) {
        var x = (px + 0.5) / s, ry = at(ys, x) - top;
        var sl = (at(ys, x + 1.5) - at(ys, x - 1.5)) / 3;
        var side = clamp((gx - x) / (W * 0.18), -1, 1);
        var face = clamp(0.55 + side * sl * 2.2 - Math.abs(sl) * 0.4, 0.15, 1); // flanks facing the light catch more
        var hor = P.rimFloor + (1 - P.rimFloor) * Math.exp(-Math.pow((x - gx) / Math.max(W * P.rimW, 130), 2));
        var A = P.rimA * strength * face * hor * (0.8 + 0.4 * noise(x / 30, 0.5, 4));
        if (A < 0.004) return;
        var y1 = Math.min(hh, Math.ceil((ry + tail) * s));
        for (var py = Math.max(0, Math.floor((ry - 1) * s)); py < y1; py++) {
          var dep = (py + 0.5) / s - ry;
          var a = A * clamp(dep * s / 1.15 + 0.5, 0, 1) * (dep < 0.7 ? 1 : Math.exp(-(dep - 0.7) * fall));
          if (a <= 0) continue;
          var o = (py * w + px) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = a * 255;
        }
      },
      commit: function () { commitTo(lk.rim, img, W, h, top); },
    };
  }

  // a few little gouache trees standing on a hilltop (painted into their ridge's canvas)
  function paintTrees(P, ctx, top, g, rg, s, spots, scale) {
    var gx = g.gx;
    ctx.setTransform(s, 0, 0, s, 0, -top * s);
    spots.forEach(function (sp) {
      var R = rand(sp.seed);
      var cx = sp.x * g.W, best = cx, by0 = 1e9, span = g.W * 0.07;
      for (var xx = cx - span; xx <= cx + span; xx += 2) { var yy = at(rg.ys, clamp(xx, 4, g.W - 4)); if (yy < by0) { by0 = yy; best = xx; } }
      for (var n = 0; n < sp.n; n++) {
        var x = clamp(best + (n - (sp.n - 1) / 2) * 9 * scale + (R() - 0.5) * 3 * scale, 6, g.W - 6);
        var hgt = (11 + R() * 6) * scale * (n % 2 ? 0.8 : 1);
        var wid = hgt * (0.46 + R() * 0.1);
        var by = at(rg.ys, x) + 1.6 * scale;
        var lit = gx > x ? 1 : -1;
        // trunk
        ctx.strokeStyle = rgb(P.trunk); ctx.lineWidth = Math.max(0.9, 1.1 * scale); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by - hgt * 0.42); ctx.stroke();
        // crown: a soft rounded leaf shape, lit on the side facing the light
        var cy = by - hgt * 0.58;
        var grd = ctx.createRadialGradient(x + lit * wid * 0.3, cy - hgt * 0.18, 0.5, x, cy, hgt * 0.62);
        grd.addColorStop(0, rgb(P.treeLit)); grd.addColorStop(0.55, rgb(mix(P.treeLit, P.tree, 0.65))); grd.addColorStop(1, rgb(P.tree));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(x, cy - hgt * 0.44);
        ctx.bezierCurveTo(x + wid * 0.62, cy - hgt * 0.30, x + wid * 0.62, cy + hgt * 0.26, x, cy + hgt * 0.32);
        ctx.bezierCurveTo(x - wid * 0.62, cy + hgt * 0.26, x - wid * 0.62, cy - hgt * 0.30, x, cy - hgt * 0.44);
        ctx.fill();
        // its quiet edge tone on the shaded side
        ctx.strokeStyle = rgb(mix(P.tree, P.night ? [0, 0, 0] : P.trunk, 0.25)); ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x - lit * wid * 0.05, cy + hgt * 0.32);
        ctx.bezierCurveTo(x - lit * wid * 0.62, cy + hgt * 0.24, x - lit * wid * 0.6, cy - hgt * 0.26, x - lit * wid * 0.05, cy - hgt * 0.43);
        ctx.globalAlpha = P.night ? 0.3 : 0.55; ctx.stroke(); ctx.globalAlpha = 1;
      }
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // the light: a wide soft oval, no disc and no point (the story thread carries the star), with a
  // fine dither so its long faint falloff never shows rings
  function glowJob(cv, g, kx, ky, col, maxA) {
    var rx = g.glow.rx * kx, ry = g.glow.ry * ky, W = Math.ceil(rx * 2), h = Math.ceil(ry * 2);
    var img = buffer(W, h), d = img.data;
    return {
      n: h,
      unit: function (py) {
        var dy = (py + 0.5 - ry) / ry;
        for (var px = 0; px < W; px++) {
          var dx = (px + 0.5 - rx) / rx, r = Math.sqrt(dx * dx + dy * dy);
          if (r >= 1) continue;
          var f = 1 - r * r * (3 - 2 * r);
          var a = maxA * f * f * (0.6 + 0.4 * f);
          if (a < 0.002) continue;
          var j = (hash(px, py, 77) - 0.5) * Math.min(40, 2 / a);
          var o = (py * W + px) * 4;
          d[o] = col[0] + j; d[o + 1] = col[1] + j; d[o + 2] = col[2] + j; d[o + 3] = a * 255;
        }
      },
      commit: function () { commitTo(cv, img, W, h, +(g.glow.cy - ry).toFixed(1), +(g.gx - rx).toFixed(1)); },
    };
  }

  // a band of mist: soft wisps stretched along the valley, wider than the page so it can drift
  function mistJob(P, lk, g, m) {
    // wider than the page by the drift plus the sideways slide, so its ends never show
    var M = g.drift + g.slide, W = g.W + M * 2, s = 0.5;
    var top = Math.max(0, Math.floor(m.cy - m.sig * 3)), bot = Math.min(g.H, Math.ceil(m.cy + m.sig * 3)), h = bot - top;
    var w = Math.round(W * s), hh = Math.round(h * s), img = buffer(w, hh), d = img.data, c0 = P.mist, c1 = P.mistLit;
    var lit = new Float32Array(w), sig = Math.max(g.W * 0.24, 140);
    for (var i = 0; i < w; i++) lit[i] = Math.exp(-Math.pow(((i + 0.5) / s - M - g.gx) / sig, 2)); // the mist catches the light near it
    return {
      n: hh,
      unit: function (py) {
        var y = top + (py + 0.5) / s, dy = (y - m.cy) / m.sig, prof = Math.exp(-dy * dy * 0.5);
        for (var px = 0; px < w; px++) {
          var x = (px + 0.5) / s, L = lit[px];
          var n = noise(x / 190, y / 16, m.seed) * 0.6 + noise(x / 85, y / 8, m.seed + 1) * 0.4; // long soft wisps, tapering ends
          var o = (py * w + px) * 4;
          d[o] = c0[0] + (c1[0] - c0[0]) * L; d[o + 1] = c0[1] + (c1[1] - c0[1]) * L; d[o + 2] = c0[2] + (c1[2] - c0[2]) * L;
          d[o + 3] = sstep(0.26, 0.86, n) * prof * P.mistA * 255;
        }
      },
      commit: function () {
        var dr = lk.drift.style;
        dr.top = top + 'px'; dr.left = -M + 'px'; dr.width = W + 'px'; dr.height = h + 'px';
        dr.setProperty('--shz-m', g.drift + 'px');
        commitTo(lk.body, img, W, h, 0);
      },
    };
  }

  /* ---------------- build / place ---------------- */
  var G = null, built = '', building = false, lastP = -1;
  function gkey(g) { return g.W + 'x' + g.H + '|' + g.A.toFixed(1); }
  function place() {
    var m = measure();
    L = m;
    root.style.top = m.top + 'px';
    root.style.height = m.h + 'px';
    G = geometry(m);
    // the sky wash: sage-stone (transparent) above, the How pink at and below the old edge
    var A = Math.max(4, m.A - 2);
    wash.style.height = m.h + 'px';
    wash.style.background = 'linear-gradient(to bottom, ' +
      'color-mix(in srgb, var(--room-how) 0%, transparent) 0px, ' +
      'color-mix(in srgb, var(--room-how) 10%, transparent) ' + (A * 0.35).toFixed(1) + 'px, ' +
      'color-mix(in srgb, var(--room-how) 38%, transparent) ' + (A * 0.62).toFixed(1) + 'px, ' +
      'color-mix(in srgb, var(--room-how) 78%, transparent) ' + (A * 0.84).toFixed(1) + 'px, ' +
      'var(--room-how) ' + A.toFixed(1) + 'px, var(--room-how) 100%)';
    // the two birds: the second a little smaller (farther), trailing below and behind
    var bs = G.birds.size;
    birdEls[0].style.cssText = 'width:' + bs + 'px;height:' + (bs * 10 / 24).toFixed(1) + 'px;left:0;top:0';
    birdEls[1].style.cssText = 'width:' + (bs * 0.76).toFixed(1) + 'px;height:' + (bs * 0.76 * 10 / 24).toFixed(1) + 'px;left:' + (-bs * 1.35).toFixed(1) + 'px;top:' + (bs * 0.62).toFixed(1) + 'px';
    lastP = -1;
  }

  function later(fn) { requestAnimationFrame(function () { setTimeout(fn, 0); }); }
  function build() {
    if (building || !G) return;
    var P = readPalette();
    if (!P) return;
    var g = G, want = P.key + '|' + gkey(g);
    if (want === built) return;
    building = true;
    var s = Math.min(2, window.devicePixelRatio || 1), sr = Math.min(s, 1.5), sc = clamp(g.H / 220, 0.72, 1.15);
    var rf = ridge(g.W, g.far), rm = ridge(g.W, g.mid), rn = ridge(g.W, g.front);
    var bf = bodyJob(P, layer.far, g, g.far, rf, P.far, s, 0, null, sc);
    var bm = bodyJob(P, layer.mid, g, g.mid, rm, P.mid, s, 20 * sc, [{ x: 0.40, n: 2, seed: 3 }], sc * 0.8);
    var bn = bodyJob(P, layer.front, g, g.front, rn, P.front, s, 28 * sc,
      g.W < 640 ? [{ x: 0.84, n: 3, seed: 9 }] : [{ x: 0.2, n: 3, seed: 5 }, { x: 0.82, n: 2, seed: 9 }], sc * 1.2);
    var jobs = [
      glowJob(glowA, g, 1.1, 1.18, P.glowA, P.glowAa), glowJob(glowB, g, 0.84, 0.88, P.glowB, P.glowBa),
      bf, rimJob(P, layer.far, g, rf, bf, sr, P.night ? 1 : 0.8), mistJob(P, layer.mist1, g, g.mist1),
      bm, rimJob(P, layer.mid, g, rm, bm, sr, P.night ? 0.62 : 0.8), mistJob(P, layer.mist2, g, g.mist2),
      bn, rimJob(P, layer.front, g, rn, bn, sr, P.night ? 0.4 : 0.75), mistJob(P, layer.mist3, g, g.mist3),
    ];
    var ji = 0, ui = 0;
    (function tick() {
      if (gkey(G) !== gkey(g)) { building = false; build(); return; } // the size changed: start again
      var end = performance.now() + 5;
      while (ji < jobs.length && performance.now() < end) {
        var j = jobs[ji];
        while (ui < j.n) { j.unit(ui++); if ((ui & 7) === 0 && performance.now() > end) break; }
        if (ui >= j.n) { ji++; ui = 0; }
      }
      if (ji < jobs.length) { later(tick); return; }
      for (var i = 0; i < jobs.length; i++) jobs[i].commit();
      root.style.setProperty('--shz-bird', rgb(P.bird));
      root.style.setProperty('--shz-bird-a', String(P.birdA));
      root.classList.add('is-built');
      building = false; built = want; lastP = -1; frame();
      build(); // the colours may have changed while it was painting
    })();
  }

  /* ---------------- motion ---------------- */
  var raf = 0, near = false;
  function tf(el, y, x) { el.style.transform = 'translate3d(' + (x || 0).toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)'; }
  function frame() {
    raf = 0;
    if (!L || !G) return;
    var vh = window.innerHeight || 800;
    var seamV = L.seamPage - window.scrollY;
    var raw = (vh - seamV) / (vh * 0.62);
    // p: the hills and the light settle at 1; q runs on a little further, for the birds, while the seam is still in view
    var p = reduce.matches ? 1 : clamp(raw, 0, 1), qv = reduce.matches ? 1 : clamp(raw, 0, 1.5);
    if (Math.abs(qv - lastP) < 0.0004) return;
    lastP = qv;
    var e = p * p * (3 - 2 * p), u = 1 - e;
    tf(layer.far.el, u * G.far.rise);
    tf(layer.mid.el, u * G.mid.rise);
    tf(layer.front.el, u * G.front.rise);
    tf(layer.mist1.el, u * G.mist1.rise, u * G.mist1.slide); layer.mist1.el.style.opacity = (0.45 + 0.55 * e).toFixed(3);
    tf(layer.mist2.el, u * G.mist2.rise, u * G.mist2.slide); layer.mist2.el.style.opacity = (0.5 + 0.5 * e).toFixed(3);
    tf(layer.mist3.el, u * G.mist3.rise, u * G.mist3.slide); layer.mist3.el.style.opacity = (0.55 + 0.45 * e).toFixed(3);
    // the birds glide on towards the light as you scroll, rising gently with the dawn, with a soft swell
    var B = G.birds, f = qv / 1.5;
    tf(birds, B.y + u * B.lift + Math.sin(qv * 4.2) * B.size * 0.16, B.x0 + (B.x1 - B.x0) * f);
    birds.style.opacity = (0.3 + 0.7 * e).toFixed(3);
    // the light rises from behind the far hills and warms from pale pink to gold
    tf(glowA, u * G.glow.rise); glowA.style.opacity = (0.55 + 0.25 * u + 0.2 * e).toFixed(3);
    tf(glowB, u * G.glow.rise * 1.25); glowB.style.opacity = Math.pow(e, 1.6).toFixed(3);
    var rim = Math.pow(e, 1.4);
    layer.far.rim.style.opacity = (rim * 0.9).toFixed(3);
    layer.mid.rim.style.opacity = rim.toFixed(3);
    layer.front.rim.style.opacity = (Math.pow(e, 1.8)).toFixed(3);
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(frame); }

  var io = new IntersectionObserver(function (entries) {
    var on = entries[entries.length - 1].isIntersecting;
    if (on) build();
    if (on === near) return;
    near = on;
    root.classList.toggle('is-near', on);
    if (on) { window.addEventListener('scroll', onScroll, { passive: true }); lastP = -1; frame(); }
    else window.removeEventListener('scroll', onScroll);
  }, { rootMargin: '90% 0px 90% 0px' });

  // re-measure when anything moves the rooms; repaint only when the size or the colours change
  var t1 = 0;
  function relayout() {
    clearTimeout(t1);
    t1 = setTimeout(function () { place(); build(); frame(); }, 140);
  }
  place();
  frame();
  io.observe(root);
  var ro = new ResizeObserver(relayout);
  ro.observe(main); ro.observe(ext); ro.observe(how);
  window.addEventListener('resize', relayout);
  var themeCheck = function () { place(); build(); };
  new MutationObserver(themeCheck).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  if (dark.addEventListener) dark.addEventListener('change', themeCheck);
  if (reduce.addEventListener) reduce.addEventListener('change', function () { lastP = -1; frame(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  setTimeout(relayout, 1500);
  // paint quietly soon after load, a few milliseconds a frame, long before anyone scrolls this far
  setTimeout(build, 900);
})();
