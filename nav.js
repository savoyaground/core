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
