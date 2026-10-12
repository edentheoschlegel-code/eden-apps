/* Edges · "star": the header's and footer's hairlines, each replaced (Eden: "no lines, tables or
 * boxes"). Sketch only: injected into the running page by /sketch/scene/?edges=star; no project
 * files change. One <style>, no new DOM.
 *
 *  - Footer: the full-width rule above "© 2026 Eden Apps" becomes one small sign, the four-point
 *    star from Eden's mark, centred where the line was, in faint warm ink, with nothing either side
 *    (a dinkus, not a rule). 10px, about the size of the star inside the closing mark above it and
 *    much lighter, so it reads as a quiet echo, not a second logo. Day and night it sits at the same
 *    presence on its paper (about 3.8:1: a sign, not text). The 1px border stays as transparent
 *    space, so nothing moves.
 *  - Phone footer: the link grid's hairlines go; the rows keep their 44px height and are told apart
 *    by air alone.
 *  - Header: no line. Once scrolled, only a whisper of soft shade below the frosted paper: a long
 *    (120px), very faint fade with no edge and no band. It is drawn once on a pseudo layer and shown
 *    with opacity, so scrolling never animates a filter or a shadow. Its strength is capped so that
 *    even at its darkest (the first pixel under the header) every word passing beneath keeps 4.5:1:
 *    4% warm ink by day (the small notes on the How we work pink stay at 4.5:1), 12% by night (the
 *    faint ink on the lightest night room stays at 4.5:1).
 *  - Phone menu: the header while the sheet is open, and the sheet's big links, lose their lines.
 *  - Night follows the site exactly: data-theme="dark" on <html>, or the device setting.
 */
(function () {
  'use strict';
  if (document.getElementById('edges-star')) return;

  var STAR = 'M330.5,274.5 Q337.36,319.65 379.5,327 Q337.36,334.35 330.5,379.5 Q323.64,334.35 281.5,327 Q323.64,319.65 330.5,274.5Z';
  var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='281.5 274.5 98 105'><path d='" + STAR + "'/></svg>";
  var mask = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';

  /* the shade below the header: alpha falls as (1 - t)^2, so it starts soft and ends at nothing
   * with no visible end; no stop ever rises, so it can never read as a band or a line */
  function shade(r, g, b, a) {
    var stops = [];
    for (var i = 0; i <= 12; i++) {
      var k = Math.pow(1 - i / 12, 2);
      stops.push('rgba(' + r + ',' + g + ',' + b + ',' + (a * k).toFixed(4) + ') ' + ((i * 100) / 12).toFixed(2) + '%');
    }
    return 'linear-gradient(to bottom,' + stops.join(',') + ')';
  }

  var dayTokens = [
    /* faint warm ink: the faint ink warmed with a little sand (3.7:1 on the paper) */
    '--edges-star: color-mix(in srgb, var(--ink-faint) 72%, var(--sand));',
    /* Eden chose star (2026-10-12); by day the header has no shade at all (the judge: a 4% shade
     * starting at the cut made the edge crisper, not softer) */
    '--edges-shade: none;',
  ].join(' ');
  var nightTokens = [
    /* by night the same star, lit softly: faint ink with a breath of sand, settled into the dark
     * roast (3.9:1, the same presence as by day) */
    '--edges-star: color-mix(in srgb, color-mix(in srgb, var(--ink-faint) 82%, var(--sand)) 64%, var(--paper));',
    '--edges-shade: ' + shade(12, 7, 4, 0.12) + ';',
  ].join(' ');

  var css = [
    '/* ---------- Edges: star ---------- */',
    ':root { ' + dayTokens + ' }',
    ':root[data-theme="dark"] { ' + nightTokens + ' }',
    '@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ' + nightTokens + ' } }',

    /* header: the hairline goes in every state (scrolled, and while the phone sheet is open) */
    'body > header.fixed { box-shadow: none; }',
    'body > header.fixed::after {',
    '  content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 120px;',
    '  background: var(--edges-shade); opacity: 0; pointer-events: none;',
    '}',
    /* scrolled (the frosted state carries the backdrop blur class); never while the sheet is open */
    'body > header.fixed[class*="backdrop-blur"]::after { opacity: 1; }',
    '@media (prefers-reduced-motion: no-preference) {',
    '  body > header.fixed::after { transition: opacity 500ms var(--ease); }',
    '}',

    /* phone menu sheet: big links told apart by their own air (py-4), not rules */
    '#mobile-nav > a.border-b { border-bottom-color: transparent; }',

    /* footer: the rule becomes a star. The border keeps its 1px as clear space (no shift). */
    'body > footer { position: relative; }',
    'body > footer, body > footer.border-t { border-top-color: transparent; }',
    'body > footer::before {',
    '  content: ""; position: absolute; left: 50%; top: -0.5px;',
    '  width: 10px; height: 10.7px; transform: translate(-50%, -50%);',
    '  background: var(--edges-star); pointer-events: none;',
    '  -webkit-mask: ' + mask + ' center / contain no-repeat;',
    '  mask: ' + mask + ' center / contain no-repeat;',
    '}',

    /* phone footer: the grid and its rows lose their hairlines; each row stays a 44px target */
    'body > footer nav[aria-label="Footer"], body > footer nav[aria-label="Footer"] > a { border-color: transparent; }',
    /* phone: a little more air above the link list, doing the job the rule above it used to do */
    '@media (width < 40rem) { body > footer nav[aria-label="Footer"] { margin-top: 16px; } }',

    /* "so i feel like a star every time i see it" (Eden): the star twinkles once, softly, as the
     * footer comes into view; reduced motion keeps it still */
    '@media (prefers-reduced-motion: no-preference) {',
    '  body > footer.edges-star-in::before { animation: edges-twinkle 1800ms var(--ease, ease-out) 200ms both; }',
    '}',
    '@keyframes edges-twinkle {',
    '  0% { opacity: 0.35; transform: translate(-50%, -50%) scale(0.6) rotate(-20deg); }',
    '  45% { opacity: 1; transform: translate(-50%, -50%) scale(1.35) rotate(6deg); }',
    '  100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }',
    '}',
  ].join('\n');

  var style = document.createElement('style');
  style.id = 'edges-star';
  style.textContent = css;
  document.head.appendChild(style);

  // the twinkle runs once each time the footer comes into view
  var foot = document.querySelector('body > footer');
  if (foot && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { foot.classList.toggle('edges-star-in', e.isIntersecting); });
    }, { threshold: 0.6 }).observe(foot);
  }
})();
