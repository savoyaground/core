/*!
 * Savoya Nav Concept 01 — V2 (alternate version of nav.js)
 * Same behavior as nav.js, plus:
 *   - Flush columns: no padding around the active column's black panel; the
 *     thumbnail sits flush with the column edges (bottom corners square only while active); title + links indent 12px
 *     only while the column is active (matches Figma "V2: Hover State").
 *   - Pixel arrows: chevrons built from crisp 1px squares (link arrows,
 *     hover arrow, mobile accordion chevrons).
 *   - Hover click: a soft, faint "paper tick" when hovering a nav item.
 *     Browsers only allow sound after the visitor has clicked/tapped/typed on
 *     the page once, so the very first hovers before any click are silent.
 *     Mute with data-nc1-sound="off" on .nc1-nav.
 *
 * V2 styles are injected by this file and scoped to .nc1-nav.nc1-v2, so the
 * Webflow (V1) styles are untouched. Swap the script tag to switch versions.
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
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('nc1-v2-styles')) return;
    var style = document.createElement('style');
    style.id = 'nc1-v2-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---- hover click sound ---------------------------------------------------
  // A soft "paper tick" (6ms filtered-noise click, embedded so there's no
  // extra file to host). Decoded once, then played through Web Audio for instant response.
  var CLICK_WAV = 'data:audio/wav;base64,UklGRjQCAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRACAACTUpGxRfG75d7osvXNukTs2utvfWk+ygtI+b7msdbf6RwOQgXOI4UK0gW7LG8b3vXk8PQC7yuWAGDwCQnc5dLonQaTCk4AUQiSwrH8O+yh2nn9IxNCBM/yPwFeBSIfUhpCDBIU2f/s7M3+tQX7+5DwP/yh26b+oAn88Cr/6vdiC9fvn/TSCjgXIvR2+osGjAAbFSP+EQVj+WAN8gUn/23wCgvFC6MKIgysBCv5QvTE87AFjPZH+OP7qwEoBqj6svPx/QsKmQouBn0A6wET/zcEiPws//H+ewLbAWEN0gp5CED1Q/fJ9zX+KPQOAWcFTPye+l77pP+0A0wKBAN4A/YApQUhA+0DZPuZ+yX6ugG7AYX+Af2Q/x393Pvb/+EGYQFG/q37x/rA/34CNQFXAbkAcwCN/NX90v+3/hj/qf6m/2oCwwCHAC4CPwLiA2P9SgAa/8b/MwH+AfoBXADiAWz/vf71/4f+3gFfAYcCyv9L/pj+j/9h/kD/Nf8iAS//ZQD+/jz+af4v/qf/HwG4AOoAzwGxABwAdv8h/tX/bv4HABwABQFVAHf/EACg/8X/AgD7//D/gv/S/7v+tP97/9oAXgGN/xgAJQCn/1kADgBF/9L/HABXAMH/bQCwAN7/yf8HAOv/2gB6AMr/pP/p/+sARQAaACkA+f+zAPH/EwDu/wUAfv9AAPH/4P+U/5P//f8=';
  var CLICK_VOLUME = 0.50; // 0-1; keep it subtle
  var ctx = null;
  var clickBuf = null;
  var lastClick = 0;

  function loadClick() {
    if (clickBuf || !ctx || loadClick.busy) return;
    loadClick.busy = true;
    var raw = atob(CLICK_WAV.split(',')[1]);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    var done = function (buf) { clickBuf = buf; };
    var p = ctx.decodeAudioData(bytes.buffer, done, function () {});
    if (p && p.then) p.then(done, function () {});
  }

  function unlockAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    loadClick();
  }

  function playClick() {
    if (!ctx || ctx.state !== 'running' || !clickBuf) return;
    var now = performance.now();
    if (now - lastClick < 60) return; // don't machine-gun when sweeping the list
    lastClick = now;
    var src = ctx.createBufferSource();
    var gain = ctx.createGain();
    src.buffer = clickBuf;
    src.playbackRate.value = 0.97 + Math.random() * 0.06; // tiny variation so repeats feel natural
    gain.gain.value = CLICK_VOLUME;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  function initV2(nav) {
    nav.classList.add('nc1-v2');
    addPixelArrows(nav);
    if (nav.getAttribute('data-nc1-sound') === 'off') return;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    Array.prototype.forEach.call(nav.querySelectorAll('.nc1-panel .nc1-link'), function (link) {
      link.addEventListener('mouseenter', function () { if (fine.matches) playClick(); });
    });
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, unlockAudio, { passive: true, capture: true });
  });

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

    function setActiveTab(index) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
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
      if (typeof tabIndex === 'number') setActiveTab(tabIndex);
      if (MQ_MOBILE.matches) openMobileChrome();
      if (!wasOpen) playPanelEntrance(); // switching tabs while open doesn't replay
    }

    function closePanel() {
      clearTimeout(closeTimer);
      isOpen = false;
      panel.classList.remove('nc1-open');
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
