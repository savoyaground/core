/*!
 * Savoya Nav Concept 01 — V2 (alternate version of nav.js)
 * Same behavior as nav.js, plus:
 *   - Flush columns: no padding around the active column's black panel; the
 *     thumbnail sits flush with the column edges (square bottom corners); title + links indent 12px
 *     only while the column is active (matches Figma "V2: Hover State").
 *   - Pixel arrows: chevrons built from crisp 1px squares (link arrows,
 *     hover arrow, mobile accordion chevrons).
 *   - Hover click: a short, quiet light-switch "tap" when hovering a nav item.
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
      N + '.nc1-thumb{border-bottom-left-radius:0;border-bottom-right-radius:0;}' +
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
  // A short light-switch tap (70ms mono WAV, embedded so there's no extra file
  // to host). Decoded once, then played through Web Audio for instant response.
  var CLICK_WAV = 'data:audio/wav;base64,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/f8JAAcAAAD1/+//8v8AAAkAFAAYABsAEwAIAAAA+v/1/+n/4P/g/+b/8f/4//b/9f/5/wMADAARAA8AAwD0/+v/5//o/+//+v8AAAQAAQD///P/6v/p//L/AAAKABAACQD+//P/9f/+/wQABQACAPz/9//z//L/8v/2////CgAPAAwACAAHAAUAAwABAAEAAwAEAAQAAwADAAMABAAIAAoABQD5/+v/6v/z/wAACQAOAAwACQAGAAUAAAD6/+//6P/n/+n/7P/z//v/AQAFAAoACgAAAPT/7P/p/+j/6P/u//z/CQAPAA8ACQABAPr/9v/2//n//v8AAP//+P/0//b//f8FAAkACAAFAAcADQAXABsAFAAGAPr/9P/z//L/8f/1//3/BQAMABAAEgATABQAEgAMAAcABAACAP//+f/z//D/8//8/wcADwASAA8ACQADAAEAAAD7//T/8P/y//b/+//+/wAAAAD9//v/+v/5//f/+f/7/wAABAAHAAUAAQD+//3//v/+//3//v8BAAUABQAAAPz/+f/6//7/AQAGAAkACwAKAAcABAAAAP3/+v/7////AQAGAAsADgAKAAMA///9//3//v//////AAAEAAgACAAEAAAA/f/+/wAAAAAAAP7//v8AAAAAAAAAAAAAAAABAAEAAQAAAAAAAAAAAP///v/9//3//v8AAAAAAAD/////AAD///////8AAAEAAQAAAP//AAAAAAAAAAAAAAAAAAABAAIAAgABAAAAAAAAAAAAAAAAAP////8AAAEAAwAEAAQAAwACAAEAAQABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAQACAAIAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  var CLICK_VOLUME = 0.35; // 0-1; keep it subtle
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
