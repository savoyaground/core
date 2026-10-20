/*!
 * Savoya Nav (Concept 01) — master nav script
 * Formerly nav-v3.js. Earlier versions are kept for rollback: nav-v2.js, nav-v1.js.
 *
 *   - Mega-menu behavior: tabs, column/tab hover sync, item hover states,
 *     entrance-animation replay, mobile accordion.
 *   - Flush columns: no padding around the active column's black panel; the
 *     thumbnail sits flush with the column edges (bottom corners square only
 *     while active); title + links indent 12px only while the column is active
 *     (Figma "Savoya Menu Concept | V2: Hover State").
 *   - Pixel arrows: chevrons built from crisp 1px squares.
 *   - Menu motion (V3): the first time the menu is hovered, the active
 *     column's black panel rises from the bottom with its image reveal (0.9s
 *     ease-in-out sine); after that, columns fade to black as in V1.
 *     data-nc1-rise="open" on .nc1-nav makes it rise on every open instead.
 *   - Image ripple: when a column becomes active, a faint water ripple spreads
 *     across its image (SVG displacement, 1.8s) with a soft highlight ring;
 *     replays when the cursor enters the image. Sidebar CTA image too.
 *   - Click focus (desktop): clicking a top link focuses its column with one
 *     lap of the gold ring from .glow-card (core/cards.css); the column lifts
 *     8px with an elastic overshoot and a drop shadow, then rests with the glow.
 *     The link's href stays for SEO; on desktop the click doesn't navigate.
 *   - Current section: while the menu is closed, the top link whose category
 *     holds the current page (its page, column heading, a link, or a page
 *     nested under one, like /blog/post) keeps its active/hover underline.
 *   - Round 2 feedback: round Close (X) button after Book Now while the menu
 *     is open (desktop); hamburger turns into an X (mobile); mega menu text
 *     10% smaller on desktop; link arrows only on hover; hover sound removed.
 *   - Active column panel is charcoal (#2a2826); override with --nc1-col-bg.
 *   - Lite mode (Windows, or any computer whose first menu open drops frames):
 *     light ring instead of the water ripple, tinted backdrop without blur.
 *     Force with ?nc1-lite=1 or ?nc1-lite=0. Backdrop blur is 6px otherwise.
 *   - Tablet (768-991px): sidebar ad shows as a horizontal card (image left).
 *   - Frosted backdrop behind the open menu (desktop); panel gets a soft shadow.
 *   - Type above 1920px grows at ~1/3 the rate (same size at 1920).
 *
 * Its styles are injected by this file and scoped to .nc1-nav.nc1-v2, on top
 * of the Webflow nc1-* classes.
 */
(function () {
  'use strict';

  // ---- pixel arrow shapes (1px squares) ------------------------------------
  // Inline SVG with shape-rendering="crispEdges" snaps every square to the
  // pixel grid, so the arrows stay sharp even at fractional positions.
  function pixelSvg(w, h, pts) {
    var d = pts.map(function (p) { return 'M' + p[0] + ' ' + p[1] + 'h1v1h-1z'; }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
      '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" fill="currentColor"' +
      ' aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }
  // Right chevron, 5 x 9
  var RIGHT = pixelSvg(5, 9, [[0,0],[1,1],[2,2],[3,3],[4,4],[3,5],[2,6],[1,7],[0,8]]);
  // Down chevron, 9 x 5
  var DOWN = pixelSvg(9, 5, [[0,0],[1,1],[2,2],[3,3],[4,4],[5,3],[6,2],[7,1],[8,0]]);

  function addPixelArrows(nav) {
    Array.prototype.forEach.call(nav.querySelectorAll('.nc1-link-arrow, .nc1-link-arrow-in'), function (el) {
      if (!el.querySelector('svg')) el.innerHTML = RIGHT;
    });
    Array.prototype.forEach.call(nav.querySelectorAll('.nc1-chev'), function (el) {
      if (!el.querySelector('svg')) el.innerHTML = DOWN;
    });
  }

  var N = '.nc1-nav.nc1-v2 ';
  var css = [
    // Pixel arrows (all breakpoints): color drives the SVG fill
    N + '.nc1-link-arrow,' + N + '.nc1-link-arrow-in{border:0!important;width:5px;height:9px;' +
      'color:var(--gradient-start,#c56129);}',
    N + '.nc1-link-arrow svg,' + N + '.nc1-link-arrow-in svg,' + N + '.nc1-chev svg{display:block;}',
    N + '.nc1-link-arrow{transform:none;}',
    N + '.nc1-link-arrow.nc1-active{color:var(--light-grey,#c9c6c2);}',
    N + '.nc1-link-arrow.nc1-hover{opacity:0;transform:translateX(10px);}',
    N + '.nc1-link-arrow-in{transform:translate(-10px,-50%);}',
    N + '.nc1-link-arrow-in.nc1-hover{opacity:1;transform:translate(0,-50%);}',
    N + '.nc1-chev{border:0!important;width:9px;height:5px;margin-right:2px;transform:none;' +
      'color:var(--text,#141313);transition:transform .2s ease,color .2s ease;}',
    N + '.nc1-chev.nc1-open{transform:rotate(180deg);color:var(--gradient-start,#c56129);}',

    // Flush columns (desktop only)
    '@media screen and (min-width:992px){' +
      N + '.nc1-cols{grid-column-gap:24px;column-gap:24px;}' +
      N + '.nc1-col{padding:0;}' +
      N + '.nc1-thumb{background:transparent;line-height:0;transition:border-radius .2s ease;}' +
      N + '.nc1-col.nc1-active .nc1-thumb{border-bottom-left-radius:0;border-bottom-right-radius:0;}' +
      N + '.nc1-thumb-img{display:block;width:100%;height:100%;object-fit:cover;}' +
      N + '.nc1-col-label{padding:0;transition:padding .2s ease,color .2s ease;}' +
      N + '.nc1-col-label.nc1-active{padding:0 12px;}' +
      N + '.nc1-link{margin:0;padding:10px 0;' +
        'transition:opacity .6s ease,transform .6s ease,padding .2s ease,background-color .2s ease,color .2s ease;}' +
      N + '.nc1-col .nc1-link.nc1-active{padding:10px 12px;}' +
      N + '.nc1-link-arrow-in{left:12px;}' +
    '}'
    ,
    // ---- Menu animation: black panel rises with the image reveal (desktop) --
    '@media screen and (min-width:992px){' +
      N + '.nc1-col{position:relative;isolation:isolate;}' +
      N + '.nc1-col.nc1-active{background-color:transparent;}' +
      // default: black fades in/out (as in V1)
      N + '.nc1-col::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;' +
        'background:var(--nc1-col-bg,#2a2826);opacity:0;clip-path:inset(0 0 0 0);transition:opacity .25s ease;}' +
      N + '.nc1-col.nc1-active::before{opacity:1;}' +
      // first hover only: black rises from the bottom with the image reveal
      N + '.nc1-panel.nc1-rise-ready .nc1-col::before{opacity:1;clip-path:inset(100% 0 0 0);transition:none;}' +
      N + '.nc1-panel.nc1-rise-ready .nc1-col.nc1-active::before,' + N + '.nc1-col.nc1-rising.nc1-active::before{' +
        'opacity:1;clip-path:inset(0 0 0 0);transition:clip-path .9s EASE;transition-delay:var(--nc1-bg-delay,0ms);}' +
      N + '.nc1-col.nc1-noanim::before{transition:none!important;}' +
      // while rising, text turns white as the black passes behind it
      [' .nc1-col-label',' .nc1-col-rule',' .nc1-link-text',' .nc1-link-arrow'].map(function (t) {
        return N + '.nc1-panel.nc1-rise-ready .nc1-col.nc1-active' + t + ',' + N + '.nc1-col.nc1-rising.nc1-active:not(.nc1-settled)' + t;
      }).join(',') + '{transition-delay:calc(var(--nc1-bg-delay,0ms) + var(--nc1-td,0ms));}' +
      // image reveal on the same curve and duration as the black panel
      N + '.nc1-thumb-img.fade-in.reveal-up{transition:opacity .9s EASE,transform .9s EASE,clip-path .9s EASE;}' +
      // panel stays distinct over the blurred page
      N + '.nc1-panel.nc1-open{box-shadow:0 28px 60px -24px rgba(20,19,19,.35),0 1px 0 rgba(20,19,19,.06);}' +
    '}',

    // ---- Image ripple (no hover image) ----------------------------------------
    N + '.nc1-thumb,' + N + '.nc1-cta-media{position:relative;overflow:hidden;isolation:isolate;}' +
    N + '.nc1-ring{position:absolute;left:var(--x);top:var(--y);width:var(--d);height:var(--d);z-index:2;' +
      'margin:calc(var(--d) / -2) 0 0 calc(var(--d) / -2);border-radius:50%;pointer-events:none;' +
      'border:1px solid rgba(255,255,255,.4);box-shadow:inset 0 0 14px rgba(255,255,255,.18),0 0 10px rgba(255,255,255,.12);' +
      'transform:scale(0);opacity:.75;animation:nc1-ring 1.8s cubic-bezier(.33,1,.68,1) forwards;}' +
    '@keyframes nc1-ring{to{transform:scale(1);opacity:0;}}',

    // ---- Click focus halo (same ring as .glow-card in core/cards.css) -------
    // One lap of the traveling gold ring, then it rests with the soft glow.
    '@property --nc1-halo-a{syntax:"<angle>";inherits:false;initial-value:0deg;}',
    '@keyframes nc1-halo-spin{from{--nc1-halo-a:0deg;}to{--nc1-halo-a:360deg;}}',
    '@keyframes nc1-close-ringfade{to{opacity:0;}}',
    '@keyframes nc1-close-glow{0%{filter:drop-shadow(0 0 7px rgba(245,173,89,.35));}100%{filter:drop-shadow(0 0 0 rgba(245,173,89,0));}}',
    '@media screen and (min-width:992px){' +
      N + '.nc1-col{transition:transform .7s cubic-bezier(.34,1.56,.64,1),box-shadow .5s ease;}' +
      N + '.nc1-col::after{content:"";position:absolute;inset:0;z-index:2;padding:1.5px;border-radius:inherit;' +
        'background:conic-gradient(from var(--nc1-halo-a),rgba(197,97,41,.2) 0%,#C56129 20%,#F5AD59 35%,#C56129 50%,rgba(197,97,41,.2) 70%);' +
        '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;' +
        'mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;' +
        'opacity:0;pointer-events:none;transition:opacity .5s ease;}' +
      N + '.nc1-col.nc1-halo::after{opacity:1;animation:nc1-halo-spin 3.5s linear 1 forwards;}' +
      N + '.nc1-col.nc1-halo{transform:translateY(-8px);' +
        'box-shadow:0 22px 40px -14px rgba(20,19,19,.55),0 0 24px rgba(245,173,89,.28),0 0 60px rgba(197,97,41,.16);}' +
    '}',
    '@media (prefers-reduced-motion:reduce){' + N + '.nc1-col.nc1-halo::after{animation:none;}' + N + '.nc1-col.nc1-halo{transform:none;}}',

    // ---- Tablet (768-991px): sidebar ad becomes a horizontal card ---------
    '@media screen and (min-width:768px) and (max-width:991px){' +
      N + '.nc1-cta{display:grid;grid-template-columns:minmax(0,42%) minmax(0,1fr);column-gap:24px;' +
        'align-items:center;width:100%;max-width:none;padding:16px;}' +
      N + '.nc1-cta > *{min-width:0;}' +
      N + '.nc1-cta-media{grid-row:1 / span 5;grid-column:1;height:100%;aspect-ratio:4 / 3;border-radius:6px;overflow:hidden;}' +
      N + '.nc1-cta-img{width:100%;height:100%;object-fit:cover;}' +
      N + '.nc1-cta > :not(.nc1-cta-media){grid-column:2;}' +
    '}',

    // ---- Frosted backdrop behind the open menu (desktop) -------------------
    '.nc1-backdrop{position:fixed;inset:0;z-index:49;pointer-events:none;opacity:0;visibility:hidden;' +
      'background:rgba(20,19,19,.16);-webkit-backdrop-filter:blur(6px) saturate(1.05);backdrop-filter:blur(6px) saturate(1.05);' +
      'transition:opacity .45s EASE,visibility 0s linear .45s;}' +
    '.nc1-backdrop.nc1-on{opacity:1;visibility:visible;transition:opacity .45s EASE,visibility 0s;}' +
    '@media screen and (max-width:991px){.nc1-backdrop{display:none;}}',
    '.nc1-lite .nc1-backdrop{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(20,19,19,.22);}',

    // ---- Typography above 1920px: same size at 1920, ~1/3 the growth after --
    '@media screen and (min-width:1921px){' +
      N + '.nc1-link-text{font-size:clamp(14.15px,calc(0.108vw + 12.08px),15.3px);}' +
      N + '.nc1-col-label{font-size:clamp(10.75px,calc(0.063vw + 9.54px),11.7px);}' +
      N + '.nc1-cta-eyebrow{font-size:clamp(10.94px,calc(0.07vw + 9.6px),12px);}' +
      N + '.nc1-cta-title{font-size:clamp(23.6px,calc(0.25vw + 18.8px),27px);}' +
      N + '.nc1-cta-body{font-size:clamp(14.46px,calc(0.1vw + 12.54px),15.5px);}' +
      N + '.nc1-cta{width:clamp(345.6px,calc(8vw + 192px),400px);}' +
    '}',
    // ---- Round 2 feedback ----------------------------------------------------
    // Mega menu type (desktop): original weights (titles 600, links 500) at 90%
    // of the Webflow sizes. Top links and tablet/mobile sizes are unchanged.
    '@media screen and (min-width:992px) and (max-width:1920px){' +
      N + '.nc1-link-text{font-size:clamp(12.6px,calc(0.315vw + 8.1px),16.2px);}' +
      N + '.nc1-col-label{font-size:clamp(9.9px,calc(0.18vw + 7.29px),12.6px);}' +
    '}',
    // Menu link arrows show only on hover, so they read as "go to page",
    // not "opens more links". The hover arrow slides in from the left as before.
    N + '.nc1-col .nc1-link-arrow{opacity:0;}',
    // Close button (desktop): a soft raised (neumorphic) round button with a
    // plain X, shown after Book Now while the menu is open; a gold ring runs one
    // lap as it appears. White like the bar,
    // so at rest only its soft shadow on the bottom right lifts it; on hover it
    // presses in. A "Close nav" tooltip follows the pointer inside the button.
    N + '.nc1-close{display:none;}' +
    '@media screen and (min-width:992px){' +
      N + '.nc1-close{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box;' +
        'width:0;height:40px;margin-left:-12px;padding:0;border:0;border-radius:999px;cursor:pointer;' +
        'color:var(--text,#141313);background:#fff;opacity:0;pointer-events:none;' +
        'box-shadow:inset -1px -1px 2px rgba(20,19,19,.07),-3px -3px 8px rgba(255,255,255,.9),5px 6px 14px rgba(20,19,19,.28),1px 1px 3px rgba(20,19,19,.12);' +
        'transition:width .3s EASE,margin .3s EASE,opacity .2s ease,box-shadow .25s ease;}' +
      N + '.nc1-close svg{width:14px;height:14px;flex:none;display:block;transition:transform .25s ease;}' +
      '.nc1-nav.nc1-v2.nc1-menu-open .nc1-close{width:40px;margin-left:0;opacity:1;pointer-events:auto;}' +
      N + '.nc1-close:hover,' + N + '.nc1-close:focus-visible{background:#fff;' +
        'box-shadow:inset 3px 3px 7px rgba(20,19,19,.22),inset -3px -3px 6px rgba(255,255,255,.95);}' +
      N + '.nc1-close:hover svg,' + N + '.nc1-close:focus-visible svg{transform:scale(.92);}' +
      N + '.nc1-close:focus-visible{outline:2px solid var(--gradient-start,#c56129);outline-offset:3px;}' +
      // gold ring: one lap each time the menu opens, then it and the glow fade; hidden on hover
      N + '.nc1-close::before{content:"";position:absolute;inset:-3px;border-radius:inherit;padding:1.5px;pointer-events:none;opacity:0;' +
        'background:conic-gradient(from var(--nc1-halo-a),rgba(197,97,41,0) 0%,#C56129 18%,#F5AD59 32%,#C56129 46%,rgba(197,97,41,0) 64%,rgba(197,97,41,0) 100%);' +
        '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;' +
        'mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;}' +
      '.nc1-nav.nc1-v2.nc1-menu-open .nc1-close::before{opacity:1;' +
        'animation:nc1-halo-spin 4s EASE .3s 1 both,nc1-close-ringfade .5s ease 4.3s forwards;}' +
      '.nc1-nav.nc1-v2.nc1-menu-open .nc1-close{animation:nc1-close-glow 4.8s ease .3s 1 both;}' +
      N + '.nc1-close:hover::before,' + N + '.nc1-close:focus-visible::before{visibility:hidden;}' +
      N + '.nc1-close:hover,' + N + '.nc1-close:focus-visible{filter:none!important;}' +
      // tooltip: follows the pointer, sitting just below-left of it (--nc1-tx/--nc1-ty set by
      // script) so it never runs off the right edge; centered below for keyboard focus
      N + '.nc1-close::after{content:attr(data-tip);position:absolute;left:var(--nc1-tx,50%);top:var(--nc1-ty,calc(100% + 6px));z-index:60;' +
        'transform:translate(calc(-100% - 6px),14px);padding:6px 10px;border-radius:6px;white-space:nowrap;pointer-events:none;' +
        'font-family:inherit;font-size:12px;font-weight:500;line-height:1.2;letter-spacing:.01em;color:#fff;background:#141313;' +
        'opacity:0;visibility:hidden;transition:opacity .15s ease,visibility 0s linear .15s;}' +
      N + '.nc1-close:focus-visible:not(:hover)::after{transform:translate(-50%,0);}' +
      N + '.nc1-close:hover::after,' + N + '.nc1-close:focus-visible::after{opacity:1;visibility:visible;' +
        'transition:opacity .15s ease .2s,visibility 0s linear .2s;}' +
    '}',
    // Mobile: the hamburger turns into a clear X (slightly longer lines).
    '@media screen and (max-width:991px){' +
      N + '.nc1-burger{width:44px;}' +
      N + '.nc1-bl-top,' + N + '.nc1-bl-mid,' + N + '.nc1-bl-bot{width:24px;transition:transform .3s EASE,opacity .2s ease;}' +
      N + '.nc1-bl-top.nc1-open{transform:translateY(7px) rotate(45deg);}' +
      N + '.nc1-bl-mid.nc1-open{opacity:0;}' +
      N + '.nc1-bl-bot.nc1-open{transform:translateY(-7px) rotate(-45deg);}' +
    '}',
    '@media (prefers-reduced-motion:reduce){.nc1-nav.nc1-v2.nc1-menu-open .nc1-close::before{animation:none;opacity:0;}.nc1-nav.nc1-v2.nc1-menu-open .nc1-close{animation:none;}}',
    '@media (prefers-reduced-motion:reduce){' +  N + '.nc1-ring{display:none;}' + N + '.nc1-col::before{transition:none!important;}}'
  ].join('\n').replace(/EASE/g, 'cubic-bezier(.37,0,.63,1)');

  function injectStyles() {
    if (document.getElementById('nc1-v2-styles')) return;
    var style = document.createElement('style');
    style.id = 'nc1-v2-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---- image swap (ripple) + backdrop + black-panel sync -------------------
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  var DESKTOP = window.matchMedia('(min-width: 992px)');

  // ---- lite mode ------------------------------------------------------------
  // Lite = light ring only (no water distortion) and a tinted backdrop with no
  // blur. On for Windows (weaker graphics on many laptops), and for any other
  // computer whose first menu open drops frames. ?nc1-lite=1 / ?nc1-lite=0 in
  // the URL forces it on or off for testing.
  var LITE_KEY = 'nc1-lite';
  var lite = false;
  function setLite(on) {
    lite = !!on;
    document.documentElement.classList.toggle('nc1-lite', lite);
  }
  (function () {
    var force = /[?&]nc1-lite=([01])/.exec(location.search);
    if (force) { setLite(force[1] === '1'); setLite.forced = true; return; }
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
    var saved = null;
    try { saved = sessionStorage.getItem(LITE_KEY); } catch (e) {}
    setLite(/win/i.test(plat) || saved === '1');
  })();
  // Times ~40 frames while the menu first opens; if the computer is struggling,
  // switch to lite for the rest of the visit.
  function checkFrames() {
    if (lite || setLite.forced || checkFrames.done) return;
    checkFrames.done = true;
    var last = 0, gaps = [];
    (function tick(ts) {
      if (last) gaps.push(ts - last);
      last = ts;
      if (gaps.length < 40) { requestAnimationFrame(tick); return; }
      var slow = gaps.filter(function (g) { return g > 25; }).length;
      var sorted = gaps.slice().sort(function (a, b) { return a - b; });
      if (slow >= 8 || sorted[20] > 22) {
        setLite(true);
        try { sessionStorage.setItem(LITE_KEY, '1'); } catch (e) {}
      }
    })(0);
  }

  function ring(box, x, y, delay) {
    if (REDUCED.matches) return;
    var r = box.getBoundingClientRect();
    var d = 1.8 * Math.max(r.width, r.height);
    var el = document.createElement('span');
    el.className = 'nc1-ring';
    el.style.cssText = '--x:' + x + 'px;--y:' + y + 'px;--d:' + d + 'px;' + (delay ? '--nc1-rip-delay:' + delay + 'ms;' : '');
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 2000 + (delay || 0));
  }

  // ---- water ripple: concentric displacement map, expanded from a point ----
  var RIPPLE_MS = 1800, RIPPLE_SCALE = 6;
  var rippleMap = null, svgDefs = null, rippleId = 0;
  function getRippleMap() {
    if (rippleMap) return rippleMap;
    var n = 256, c = document.createElement('canvas'); c.width = c.height = n;
    var g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1, r = Math.sqrt(dx * dx + dy * dy);
      var w = 0;
      if (r < 1 && r > 0.0001) {
        var env = Math.sin(Math.PI * Math.min(1, Math.max(0, (r - 0.35) / 0.65)));   // wave band near the front
        w = Math.sin(r * Math.PI * 5) * env * env;
      }
      var k = (y * n + x) * 4, ux = r ? dx / r : 0, uy = r ? dy / r : 0;
      d[k] = 128 + 127 * w * ux; d[k + 1] = 128 + 127 * w * uy; d[k + 2] = 128; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    rippleMap = c.toDataURL('image/png');
    return rippleMap;
  }
  function ensureDefs() {
    if (svgDefs) return svgDefs;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(svgDefs); document.body.appendChild(svg);
    return svgDefs;
  }
  function makeRipple(box, layer) {
    var NS = 'http://www.w3.org/2000/svg', id = 'nc1-ripple-' + (++rippleId);
    var f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id); f.setAttribute('x', '0'); f.setAttribute('y', '0');
    f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    // neutral grey everywhere (= no displacement), the ripple map on top,
    // then a light blur to smooth the 8-bit steps
    var flood = document.createElementNS(NS, 'feFlood');
    flood.setAttribute('flood-color', 'rgb(128,128,128)'); flood.setAttribute('result', 'bg');
    var fi = document.createElementNS(NS, 'feImage');
    fi.setAttribute('preserveAspectRatio', 'none'); fi.setAttribute('result', 'img');
    var merge = document.createElementNS(NS, 'feMerge'); merge.setAttribute('result', 'raw');
    ['bg', 'img'].forEach(function (n) {
      var mn = document.createElementNS(NS, 'feMergeNode'); mn.setAttribute('in', n); merge.appendChild(mn);
    });
    var blur = document.createElementNS(NS, 'feGaussianBlur');
    blur.setAttribute('in', 'raw'); blur.setAttribute('stdDeviation', '1.5'); blur.setAttribute('result', 'map');
    var fd = document.createElementNS(NS, 'feDisplacementMap');
    fd.setAttribute('in', 'SourceGraphic'); fd.setAttribute('in2', 'map');
    fd.setAttribute('result', 'warped');
    // where the wave pulls in pixels from outside the image, show the original
    var under = document.createElementNS(NS, 'feMerge');
    ['SourceGraphic', 'warped'].forEach(function (n) {
      var mn = document.createElementNS(NS, 'feMergeNode'); mn.setAttribute('in', n); under.appendChild(mn);
    });
    fd.setAttribute('xChannelSelector', 'R'); fd.setAttribute('yChannelSelector', 'G');
    [flood, fi, merge, blur, fd, under].forEach(function (n) { f.appendChild(n); }); ensureDefs().appendChild(f);
    var raf = 0, timer = 0;
    function stop() { cancelAnimationFrame(raf); clearTimeout(timer); layer.style.filter = ''; }
    return {
      play: function (x, y, delay) {
        stop();
        if (REDUCED.matches) return;
        timer = setTimeout(function () {
          if (lite) { ring(box, x, y, 0); return; }
          var href = getRippleMap();
          fi.setAttribute('href', href); fi.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
          var r = box.getBoundingClientRect(), t0 = 0;
          var max = 2.3 * Math.sqrt(r.width * r.width + r.height * r.height) / 1.0;
          var px = x, py = y;
          layer.style.filter = 'url(#' + id + ')';
          ring(box, x, y, 0);
          (function step(ts) {
            if (!t0) t0 = ts;
            var t = Math.min(1, (ts - t0) / RIPPLE_MS), e = Math.sin(t * Math.PI / 2);
            var size = Math.max(1, max * e);
            fi.setAttribute('x', px - size / 2); fi.setAttribute('y', py - size / 2);
            fi.setAttribute('width', size); fi.setAttribute('height', size);
            fd.setAttribute('scale', (RIPPLE_SCALE * (1 - t)).toFixed(2));
            if (t < 1) raf = requestAnimationFrame(step); else layer.style.filter = '';
          })(performance.now());
        }, delay || 0);
      },
      stop: stop
    };
  }

  // While the black panel rises (0.9s, ease-in-out sine), each piece of text
  // turns white at the moment the panel's top edge passes behind it. Delays are
  // stored per element as --nc1-td and only apply until the column "settles".
  var RISE_MS = 900;
  var TEXT_PARTS = '.nc1-col-label, .nc1-col-rule, .nc1-link-text, .nc1-link-arrow';
  function measureTextDelays(col) {
    var r = col.getBoundingClientRect();
    if (!r.height) return;
    Array.prototype.forEach.call(col.querySelectorAll(TEXT_PARTS), function (el) {
      var e = el.getBoundingClientRect();
      var y = 1 - ((e.top + e.height / 2) - r.top) / r.height;   // 0 = bottom, 1 = top
      y = Math.max(0, Math.min(1, y));
      var t = Math.acos(1 - 2 * y) / Math.PI;                       // inverse easeInOutSine
      el.style.setProperty('--nc1-td', Math.max(0, Math.round(t * RISE_MS - 120)) + 'ms');
    });
  }

  // Ripple target: the column's own image (no hover image). The ripple plays
  // when the column becomes active, from the cursor if it's over the image,
  // otherwise from the image's center.
  function makeRippleTarget(box, tracker) {
    var img = box.querySelector('img') || box.querySelector('.nc1-thumb-img, .nc1-cta-img');
    if (!img) return null;
    var rip = makeRipple(box, img);
    var last = { x: null, y: null }, active = false;
    function track(e) {
      var r = box.getBoundingClientRect(); last.x = e.clientX - r.left; last.y = e.clientY - r.top;
    }
    (tracker || box).addEventListener('pointerenter', track);
    (tracker || box).addEventListener('pointermove', track);
    return {
      on: function (fromPointer, delay) {
        if (active) return;
        active = true;
        var r = box.getBoundingClientRect();
        var x = fromPointer && last.x !== null ? last.x : -1, y = fromPointer && last.y !== null ? last.y : -1;
        var inside = x >= 0 && x <= r.width && y >= 0 && y <= r.height;
        rip.play(inside ? x : r.width / 2, inside ? y : r.height / 2, (delay || 0) + 120);
      },
      off: function () { active = false; rip.stop(); last.x = last.y = null; },
      replay: function (x, y) { if (active) rip.play(x, y, 0); }
    };
  }


  function initFx(nav) {
    var panel = nav.querySelector('.nc1-panel');
    if (!panel) return;
    var cols = Array.prototype.slice.call(panel.querySelectorAll('.nc1-col'));
    var colSwaps = cols.map(function (col) {
      var thumb = col.querySelector('.nc1-thumb');
      var sw = thumb && makeRippleTarget(thumb, col);
      if (!sw) return null;
      sw.pointerIn = false;
      col.addEventListener('pointerenter', function () { sw.pointerIn = true; });
      col.addEventListener('pointerleave', function () { sw.pointerIn = false; });
      return sw;
    });

    // Sidebar CTA: ripple on hover
    var cta = panel.querySelector('.nc1-cta');
    var ctaMedia = cta && cta.querySelector('.nc1-cta-media');
    var csw = ctaMedia && makeRippleTarget(ctaMedia, cta);
    if (csw) {
      cta.addEventListener('pointerenter', function () {
        if (DESKTOP.matches) requestAnimationFrame(function () { csw.on(true, 0); });
      });
      cta.addEventListener('pointerleave', function () { csw.off(); });
    }

    // Prepare the ripple map in idle time, so the first ripple doesn't hitch.
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1500); };
    window.addEventListener('load', function () { idle(function () { if (!lite) getRippleMap(); }); });

    // Frosted backdrop
    var backdrop = document.createElement('div');
    backdrop.className = 'nc1-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    // Black panel: rises from the bottom on the first hover only, then fades.
    // RISE_ONCE = 'page' -> once per page view; 'open' -> every time the menu opens.
    var RISE_ONCE = nav.getAttribute('data-nc1-rise') === 'open' ? 'open' : 'page';
    function has(el, c) { return el.classList.contains(c); }
    function add(el, c) { if (!has(el, c)) el.classList.add(c); }
    function rem(el, c) { if (has(el, c)) el.classList.remove(c); }
    function armRise() {
      cols.forEach(function (col, i) { col.style.setProperty('--nc1-bg-delay', (i * 70) + 'ms'); });
      add(panel, 'nc1-rise-ready');
    }
    function disarmRise() {
      var idle = cols.filter(function (c) { return !has(c, 'nc1-active'); });
      idle.forEach(function (c) { add(c, 'nc1-noanim'); });
      rem(panel, 'nc1-rise-ready');
      void panel.offsetWidth; // switch idle columns to fade mode without animating
      idle.forEach(function (c) { rem(c, 'nc1-noanim'); });
    }
    function measureAll() { cols.forEach(measureTextDelays); }
    if (document.readyState === 'complete') measureAll(); else window.addEventListener('load', measureAll);
    window.addEventListener('resize', measureAll);
    armRise();

    var wasOpen = false, openTimer = null, loaded = false;
    function sync() {
      var open = has(panel, 'nc1-open');
      backdrop.classList.toggle('nc1-on', open && DESKTOP.matches);
      var opening = open && !wasOpen;
      var closing = !open && wasOpen;
      wasOpen = open;
      if (opening) {
        if (DESKTOP.matches) checkFrames();
        clearTimeout(openTimer);
        openTimer = setTimeout(function () { opening = false; }, 1400);
      }
      if (closing && RISE_ONCE === 'open') armRise();

      // First activation while armed: that column rises; everything after fades.
      if (open && DESKTOP.matches && has(panel, 'nc1-rise-ready')) {
        var first = cols.filter(function (c) { return has(c, 'nc1-active'); })[0];
        if (first) {
          add(first, 'nc1-rising');
          var idx = cols.indexOf(first);
          clearTimeout(first.__nc1Settle);
          first.__nc1Settle = setTimeout(function () { add(first, 'nc1-settled'); },
            idx * 70 + RISE_MS + 100);
          disarmRise();
        }
      }

      cols.forEach(function (col, i) {
        var nowActive = open && DESKTOP.matches && has(col, 'nc1-active');
        if (!nowActive && col.__nc1Active) {
          clearTimeout(col.__nc1Settle);
          rem(col, 'nc1-rising'); rem(col, 'nc1-settled');
        }
        if (!nowActive) rem(col, 'nc1-halo');
        col.__nc1Active = nowActive;
        var sw = colSwaps[i];
        if (!sw) return;
        if (nowActive) sw.on(sw.pointerIn, opening ? i * 70 + 350 : 0);
        else sw.off();
      });
    }
    colSwaps.forEach(function (sw, i) {
      if (!sw) return;
      var thumb = cols[i].querySelector('.nc1-thumb');
      thumb.addEventListener('pointerenter', function (e) {
        var r = thumb.getBoundingClientRect();
        sw.replay(e.clientX - r.left, e.clientY - r.top);
      });
    });
    // Clicking (or pressing Enter on) a top link focuses its column with the
    // gold halo instead of navigating. The href stays for crawlers and no-JS.
    function halo(col) {
      cols.forEach(function (c) { if (c !== col) rem(c, 'nc1-halo'); });
      rem(col, 'nc1-halo');
      void col.offsetWidth; // restart the lap on repeat clicks
      add(col, 'nc1-halo');
    }
    Array.prototype.forEach.call(nav.querySelectorAll('.nc1-tab'), function (tab, i) {
      tab.addEventListener('click', function (e) {
        if (!DESKTOP.matches || !cols[i]) return;
        e.preventDefault();
        setTimeout(function () {
          if (has(panel, 'nc1-open') && has(cols[i], 'nc1-active')) halo(cols[i]);
        }, 0);
      });
    });
    var mo = new MutationObserver(sync);
    mo.observe(panel, { attributes: true, attributeFilter: ['class'] });
    cols.forEach(function (col) { mo.observe(col, { attributes: true, attributeFilter: ['class'] }); });

  }

  function initV2(nav) {
    nav.classList.add('nc1-v2');
    addPixelArrows(nav);
    initFx(nav);
  }

  function bootV2() {
    injectStyles();
    Array.prototype.forEach.call(document.querySelectorAll('.nc1-nav'), initV2);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootV2);
  else bootV2();
})();

/*!
 * Savoya Nav Concept 01 — Editorial Columns mega menu
 * Webflow classes: nc1-*   State combo classes: nc1-open / nc1-active
 *
 * Desktop (>= 992px): hovering or focusing a top tab opens the full mega menu
 *   (all four columns at once). The hovered tab's copper underline draws in
 *   left to right, and its matching category column switches to the dark
 *   active state (black panel, white text, light grey arrows). Hovering a
 *   column does the reverse: it activates that column and its top link.
 *   Hovering an item in the active column gives it a white background; its
 *   text shifts right as a left arrow slides in and the right arrow slides out.
 *   First click/tap on a tab while the menu is closed opens it; a click while
 *   open follows the tab's link. Escape, outside click, or leaving the nav closes it.
 * Tablet/mobile (<= 991px): the hamburger opens a full-height drawer. Column
 *   headings become an accordion (one open at a time, first one open by default).
 *
 * Entrance animation: thumbnails (.fade-in .reveal-up inside .reveal-up-group),
 *   links (.fade-in) and the CTA image (.fade-in) replay each time the menu
 *   opens, staggered by column. Requires animation.css from savoyaground/animation
 *   (and .fade-section on .nc1-panel-inner). Respects prefers-reduced-motion.
 *
 * No other dependencies. Load in the page/site footer:
 *   <script defer src="https://cdn.jsdelivr.net/gh/savoyaground/core@<commit>/nav.js"></script>
 */
(function () {
  'use strict';

  var MQ_MOBILE = window.matchMedia('(max-width: 991px)');
  var CLOSE_DELAY = 180; // ms grace period when the pointer leaves the nav

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function toggle(el, cls, on) { if (el) el.classList.toggle(cls, !!on); }

  function init(nav) {
    var panel = $('.nc1-panel', nav);
    if (!panel) return;

    var tabs = $$('.nc1-tab', nav);
    var burger = $('.nc1-burger', nav);
    var burgerLines = burger ? $$('.nc1-bl-top, .nc1-bl-mid, .nc1-bl-bot', burger) : [];
    var cols = $$('.nc1-col', panel);
    var isOpen = false;
    var closeTimer = null;
    var suppressFocusOpen = false; // focus returned by Escape must not reopen the menu

    if (!panel.id) panel.id = 'nc1-panel';

    // Close button (desktop): added after Book Now, shown while the menu is open.
    var actions = $('.nc1-actions', nav);
    var closeBtn = null;
    if (actions && !$('.nc1-close', actions)) {
      closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'nc1-close';
      closeBtn.setAttribute('aria-label', 'Close menu');
      closeBtn.setAttribute('aria-controls', panel.id);
      closeBtn.tabIndex = -1;
      closeBtn.setAttribute('data-tip', 'Close nav');
      closeBtn.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
      // Tooltip follows the pointer while it's over the button.
      closeBtn.addEventListener('pointermove', function (e) {
        var r = closeBtn.getBoundingClientRect();
        closeBtn.style.setProperty('--nc1-tx', (e.clientX - r.left) + 'px');
        closeBtn.style.setProperty('--nc1-ty', (e.clientY - r.top) + 'px');
      });
      closeBtn.addEventListener('pointerleave', function () {
        closeBtn.style.removeProperty('--nc1-tx');
        closeBtn.style.removeProperty('--nc1-ty');
      });
      actions.appendChild(closeBtn);
    }

    // ---- a11y wiring -------------------------------------------------------
    tabs.forEach(function (tab) {
      tab.setAttribute('aria-haspopup', 'true');
      tab.setAttribute('aria-expanded', 'false');
      tab.setAttribute('aria-controls', panel.id);
    });
    if (burger) {
      burger.setAttribute('role', 'button');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-controls', panel.id);
    }
    cols.forEach(function (col, i) {
      var head = $('.nc1-col-head', col);
      var links = $('.nc1-links', col);
      if (!head || !links) return;
      if (!links.id) links.id = 'nc1-links-' + i;
      head.setAttribute('aria-controls', links.id);
    });

    // ---- desktop: tabs + panel ---------------------------------------------
    // Pieces of a column that switch to the dark "active" treatment.
    var COL_PARTS = '.nc1-col-head, .nc1-col-label, .nc1-col-rule, .nc1-link, .nc1-link-text, .nc1-link-arrow';

    // Item hover inside the active (black) column: white pill, text nudges
    // right, right arrow slides out, left arrow slides in.
    var LINK_PARTS = '.nc1-link-text, .nc1-link-arrow, .nc1-link-arrow-in';

    function setLinkHover(link, on) {
      toggle(link, 'nc1-hover', on);
      $$(LINK_PARTS, link).forEach(function (el) { toggle(el, 'nc1-hover', on); });
    }

    function setActiveCol(index) {
      var desktop = !MQ_MOBILE.matches;
      cols.forEach(function (col, i) {
        var on = desktop && i === index;
        toggle(col, 'nc1-active', on);
        $$(COL_PARTS, col).forEach(function (el) { toggle(el, 'nc1-active', on); });
        if (!on) $$('.nc1-link', col).forEach(function (l) { setLinkHover(l, false); });
      });
    }

    cols.forEach(function (col) {
      $$('.nc1-link', col).forEach(function (link) {
        function enter() {
          if (MQ_MOBILE.matches || !col.classList.contains('nc1-active')) return;
          setLinkHover(link, true);
        }
        function leave() { setLinkHover(link, false); }
        link.addEventListener('mouseenter', enter);
        link.addEventListener('focus', enter);
        link.addEventListener('mouseleave', leave);
        link.addEventListener('blur', leave);
      });
    });

    // ---- current section ("you are here") ---------------------------------
    // A tab keeps its active (hover) look while the menu is closed if the
    // current page is that tab's page, its column heading, one of its links,
    // or a page nested under one of those (e.g. /blog/post under /blog).
    function cleanPath(p) {
      p = (p || '/').toLowerCase().replace(/\/+$/, '');
      return p || '/';
    }
    function sameSite(a) { return a && a.href && a.host === location.host; }
    var herePath = cleanPath(location.pathname);
    function isHere(a) {
      if (!sameSite(a)) return false;
      var p = cleanPath(a.pathname);
      if (p === '/') return herePath === '/';
      return herePath === p || herePath.indexOf(p + '/') === 0;
    }
    var currentTabs = tabs.map(function (tab, i) {
      var col = cols[i];
      var links = [tab].concat(col ? $$('.nc1-col-head, .nc1-link', col) : []);
      var match = false;
      links.forEach(function (a) {
        if (!isHere(a)) return;
        match = true;
        if (cleanPath(a.pathname) === herePath && a !== tab) a.setAttribute('aria-current', 'page');
      });
      return match;
    });

    function setActiveTab(index) {
      tabs.forEach(function (tab, i) {
        // Open: follow the pointer. Closed (index -1): show the current section.
        var on = index < 0 ? currentTabs[i] : i === index;
        toggle($('.nc1-tab-text', tab), 'nc1-active', on);
        toggle($('.nc1-tab-line', tab), 'nc1-active', on);
        tab.setAttribute('aria-expanded', on && isOpen ? 'true' : 'false');
      });
      // Tab N highlights category column N (Company, Benefits, Who We Serve, Resources).
      setActiveCol(index);
    }

    // ---- entrance animation (classes from savoyaground/animation) --------
    // animation.js reveals .fade-in / .reveal-up once on page load, while the
    // menu is still hidden. Replay them here every time the menu opens.
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
    var ANIM_SEL = '.fade-in, .reveal-up';
    var ACTIVE = { 'fade-in': 'fade-in-active', 'reveal-up': 'reveal-up-active' };
    var COL_STEP = 70;   // ms between columns
    var ITEM_STEP = 45;  // ms between items within a column
    var MAX_DELAY = 600;

    function activeClasses(el) {
      return Object.keys(ACTIVE)
        .filter(function (c) { return el.classList.contains(c); })
        .map(function (c) { return ACTIVE[c]; });
    }

    function replay(groups) {
      if (REDUCED.matches) return; // animation.js already shows everything
      var items = [];
      groups.forEach(function (els, g) {
        els.forEach(function (el, j) {
          items.push({ el: el, delay: Math.min(g * COL_STEP + j * ITEM_STEP, MAX_DELAY) });
        });
      });
      // Snap to the hidden state without transitioning.
      items.forEach(function (it) {
        it.el.style.transition = 'none';
        activeClasses(it.el).forEach(function (c) { it.el.classList.remove(c); });
      });
      void panel.offsetWidth; // flush styles so the reveal transitions run
      items.forEach(function (it) {
        it.el.style.transition = '';
        it.el.style.transitionDelay = it.delay + 'ms';
      });
      // Styles were flushed above, so adding the classes now still transitions.
      items.forEach(function (it) {
        Object.keys(ACTIVE).forEach(function (c) {
          if (it.el.classList.contains(c)) it.el.classList.add(ACTIVE[c]);
        });
      });
      // Clear the stagger delay once the entrance is done, so hover
      // transitions (background, color) respond immediately.
      clearTimeout(replay.timer);
      replay.timer = setTimeout(function () {
        items.forEach(function (it) { it.el.style.transitionDelay = ''; });
      }, MAX_DELAY + 700);
    }

    // Rendered = not inside display:none (e.g. a closed mobile accordion).
    function rendered(el) { return el.getClientRects().length > 0; }

    function playPanelEntrance() {
      var groups = cols.map(function (col) {
        return $$(ANIM_SEL, col).filter(rendered);
      });
      var rest = $$(ANIM_SEL, panel).filter(function (el) {
        return !el.closest('.nc1-col') && rendered(el);
      });
      if (rest.length) groups.push(rest); // Sidebar CTA image + link
      replay(groups);
    }

    function openPanel(tabIndex) {
      clearTimeout(closeTimer);
      var wasOpen = isOpen;
      isOpen = true;
      panel.classList.add('nc1-open');
      nav.classList.add('nc1-menu-open');
      if (closeBtn) closeBtn.tabIndex = 0;
      if (typeof tabIndex === 'number') setActiveTab(tabIndex);
      if (MQ_MOBILE.matches) openMobileChrome();
      if (!wasOpen) playPanelEntrance(); // switching tabs while open doesn't replay
    }

    function closePanel() {
      clearTimeout(closeTimer);
      isOpen = false;
      panel.classList.remove('nc1-open');
      nav.classList.remove('nc1-menu-open');
      if (closeBtn) closeBtn.tabIndex = -1;
      setActiveTab(-1);
      closeMobileChrome();
    }

    function scheduleClose() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(closePanel, CLOSE_DELAY);
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('mouseenter', function () { if (!MQ_MOBILE.matches) openPanel(i); });
      tab.addEventListener('focus', function () {
        if (suppressFocusOpen) { suppressFocusOpen = false; return; }
        if (!MQ_MOBILE.matches) openPanel(i);
      });
      tab.addEventListener('click', function (e) {
        if (MQ_MOBILE.matches) return;
        // First tap (touch laptops/tablets in landscape) opens instead of navigating.
        if (!isOpen) { e.preventDefault(); openPanel(i); }
      });
    });

    // Hovering (or tabbing into) a category column activates that column and
    // its matching top link, so the tab underline follows the pointer.
    cols.forEach(function (col, i) {
      function activate() {
        if (MQ_MOBILE.matches || !isOpen) return;
        setActiveTab(i);
      }
      col.addEventListener('mouseenter', activate);
      col.addEventListener('focusin', activate);
    });

    nav.addEventListener('mouseleave', function () { if (!MQ_MOBILE.matches && isOpen) scheduleClose(); });
    nav.addEventListener('mouseenter', function () { clearTimeout(closeTimer); });

    // Close when keyboard focus leaves the nav entirely.
    nav.addEventListener('focusout', function (e) {
      if (MQ_MOBILE.matches) return;
      if (!nav.contains(e.relatedTarget)) scheduleClose();
    });

    document.addEventListener('click', function (e) {
      if (isOpen && !nav.contains(e.target)) closePanel();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isOpen) return;
      var activeIndex = tabs.findIndex(function (t) {
        var line = $('.nc1-tab-line', t);
        return line && line.classList.contains('nc1-active');
      });
      closePanel();
      if (MQ_MOBILE.matches && burger) burger.focus();
      else if (activeIndex > -1) {
        suppressFocusOpen = true;
        tabs[activeIndex].focus();
        suppressFocusOpen = false;
      }
    });

    // ---- mobile: burger + accordion ----------------------------------------
    function openMobileChrome() {
      burgerLines.forEach(function (l) { l.classList.add('nc1-open'); });
      if (burger) {
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Close menu');
      }
      document.documentElement.style.overflow = 'hidden';
      if (!cols.some(isColOpen)) setCol(0, true);
    }

    function closeMobileChrome() {
      burgerLines.forEach(function (l) { l.classList.remove('nc1-open'); });
      if (burger) {
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Open menu');
      }
      document.documentElement.style.overflow = '';
    }

    function isColOpen(col) {
      var links = $('.nc1-links', col);
      return !!links && links.classList.contains('nc1-open');
    }

    function setCol(index, open) {
      cols.forEach(function (col, i) {
        var on = i === index ? open : false;
        toggle($('.nc1-links', col), 'nc1-open', on);
        toggle($('.nc1-chev', col), 'nc1-open', on);
        var head = $('.nc1-col-head', col);
        if (head) head.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closePanel();
      });
    }

    if (burger) {
      burger.addEventListener('click', function (e) {
        e.preventDefault();
        if (isOpen) closePanel(); else openPanel();
      });
    }

    cols.forEach(function (col, i) {
      var head = $('.nc1-col-head', col);
      if (!head) return;
      head.addEventListener('click', function (e) {
        if (!MQ_MOBILE.matches) return; // desktop: heading links to the category page
        e.preventDefault();
        var opening = !isColOpen(col);
        setCol(i, opening);
        if (opening) replay([$$('.nc1-links .fade-in', col)]);
      });
    });

    // ---- breakpoint changes ------------------------------------------------
    function onBreakpointChange() {
      closePanel();
      setCol(-1, false);
      cols.forEach(function (col) {
        var head = $('.nc1-col-head', col);
        if (!head) return;
        if (MQ_MOBILE.matches) head.setAttribute('aria-expanded', 'false');
        else head.removeAttribute('aria-expanded');
      });
    }
    if (MQ_MOBILE.addEventListener) MQ_MOBILE.addEventListener('change', onBreakpointChange);
    else if (MQ_MOBILE.addListener) MQ_MOBILE.addListener(onBreakpointChange);
    onBreakpointChange();
  }

  function boot() { $$('.nc1-nav').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
