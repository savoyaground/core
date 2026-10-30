/* ==========================================================================
   Savoya site-wide scripts  (savoyaground/core → site.js)
   Loaded on every page from Site settings → Custom code → Head, with defer.

   Sections
     1. Tracking params  – save UTM / click ids from the URL; push to GTM dataLayer
     2. Book Now links   – carry tracking params (+ GA4 linker, HubSpot ids) to
                           core.savoya.net; add them as hidden fields to forms
     3. HubSpot tracking – load on first interaction or 3 s after load

   Stays inline in Site settings on purpose (other code expects them at once):
   Google Tag Manager, Squatch (Rewards pages call squatch.ready inline).

   Debug logging: add ?sv-debug=1 to any URL.
   ========================================================================== */
(function () {
  'use strict';
  if (window.SavoyaSite) return;
  window.SavoyaSite = true;

  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'msclkid', 'rdt_cid', 'li_fat_id'];
  var BOOK_NOW_SELECTOR = 'a[href*="core.savoya.net/reservations/create/retail"], #Book-Now, .book-now-link';
  var PARAM_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  var HUBSPOT_SRC = '//js-na2.hs-scripts.com/6205552.js';

  var query = new URLSearchParams(window.location.search);
  var DEBUG = query.get('sv-debug') === '1';
  function log() { if (DEBUG) console.log.apply(console, ['[site]'].concat([].slice.call(arguments))); }

  function getCookie(name) {
    var parts = ('; ' + document.cookie).split('; ' + name + '=');
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }


  /* ==========================================================================
     1. Tracking params
     A param in the URL is saved to sessionStorage and localStorage (with a
     timestamp). A param present but empty clears the saved value.
     ========================================================================== */
  PARAMS.forEach(function (param) {
    var value = query.get(param);
    if (value) {
      sessionStorage.setItem(param, value);
      try {
        localStorage.setItem(param, value);
        localStorage.setItem('_utm_saved_at', Date.now().toString());
      } catch (_) {}
      log('saved', param, value);
    } else if (query.has(param)) {
      sessionStorage.removeItem(param);
      try { localStorage.removeItem(param); } catch (_) {}
      log('cleared', param);
    }
  });

  // Freshest wins: URL, then localStorage (30 days), then sessionStorage
  function getTrackingParam(param) {
    if (query.get(param)) return query.get(param);
    try {
      var savedAt = parseInt(localStorage.getItem('_utm_saved_at') || '0', 10);
      if (savedAt && (Date.now() - savedAt) < PARAM_EXPIRY_MS) {
        var lsVal = localStorage.getItem(param);
        if (lsVal) return lsVal;
      }
    } catch (_) {}
    return sessionStorage.getItem(param);
  }

  function pushToDataLayer() {
    var data = {};
    PARAMS.forEach(function (param) {
      var value = query.get(param) || sessionStorage.getItem(param) || localStorage.getItem(param);
      if (value) data[param] = value;
    });
    if (Object.keys(data).length) {
      var dl = window.dataLayer = window.dataLayer || [];
      data.event = 'utm_params';
      dl.push(data);
      log('dataLayer', data);
    }
  }


  /* ==========================================================================
     2. Book Now links and forms
     ========================================================================== */

  // One value per tracking param, tracking params first, other params kept
  function cleanUrlParams(url) {
    var parsed = new URL(url);
    var params = new URLSearchParams();
    PARAMS.forEach(function (param) {
      var values = parsed.searchParams.getAll(param);
      if (values.length > 0) params.set(param, values[0]);
    });
    parsed.searchParams.forEach(function (value, key) {
      if (PARAMS.indexOf(key) === -1) params.set(key, value);
    });
    parsed.search = params.toString();
    return parsed.toString();
  }

  function decorateWithLinker(link) {
    if (typeof window.gtag === 'undefined') return;
    try { window.gtag('linker:decorate', link); } catch (_) {}
  }

  function updateBookNowLinks() {
    var links = document.querySelectorAll(BOOK_NOW_SELECTOR);
    if (!links.length) return;
    links.forEach(function (link) {
      try {
        var url = new URL(link.href || 'https://core.savoya.net/reservations/create/retail');
        var gclid = getCookie('_gcl_aw') || getTrackingParam('gclid');
        if (gclid) url.searchParams.set('gclid', gclid);
        PARAMS.forEach(function (param) {
          var value = getTrackingParam(param);
          if (value) url.searchParams.set(param, value);
        });
        link.href = url.toString();
      } catch (_) {}
    });
    links.forEach(decorateWithLinker);
  }

  function addParamsToForms() {
    document.querySelectorAll('form').forEach(function (form) {
      PARAMS.forEach(function (param) {
        var value = getTrackingParam(param);
        if (!value) return;
        var input = form.querySelector('input[name="' + param + '"]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = param;
          form.appendChild(input);
        }
        input.value = value;
      });
    });
  }

  // If anything rewrites a Book Now href, tidy its params again
  function watchBookNowLinks() {
    document.querySelectorAll(BOOK_NOW_SELECTOR).forEach(function (link) {
      new MutationObserver(function () {
        try {
          var cleaned = cleanUrlParams(link.href);
          if (link.href !== cleaned) {
            link.href = cleaned;
            decorateWithLinker(link);
          }
        } catch (_) {}
      }).observe(link, { attributes: true, attributeFilter: ['href'] });
    });
  }

  function waitForGtag(callback, maxAttempts) {
    var attempts = 0;
    maxAttempts = maxAttempts || 50;
    (function check() {
      attempts++;
      if (typeof window.gtag !== 'undefined') callback();
      else if (attempts < maxAttempts) setTimeout(check, 100);
    })();
  }

  function addHubSpotIdsToBookNowLinks() {
    var hstc = getCookie('__hstc');
    if (!hstc) return;
    var hssc = getCookie('__hssc');
    var hsfp = getCookie('__hsfp');
    document.querySelectorAll(BOOK_NOW_SELECTOR).forEach(function (link) {
      try {
        var url = new URL(link.href, window.location.origin);
        if (url.searchParams.has('__hstc')) return;
        url.searchParams.set('__hstc', hstc);
        if (hssc) url.searchParams.set('__hssc', hssc);
        if (hsfp) url.searchParams.set('__hsfp', hsfp);
        link.href = url.toString();
      } catch (_) {}
    });
  }

  // Clicks: decorate at the last moment and navigate with clean params
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest(BOOK_NOW_SELECTOR);
    if (!link) return;
    decorateWithLinker(link);
    var cleaned = cleanUrlParams(link.href);
    event.preventDefault();
    window.location.href = cleaned;
  }, true);

  window.addEventListener('popstate', function () {
    updateBookNowLinks();
    addParamsToForms();
  });


  /* ==========================================================================
     3. HubSpot tracking code
     Loads on the first mouse move / scroll / tap / key press, or 3 s after
     the page loads, so it stays out of the first paint.
     ========================================================================== */
  var hubspotLoaded = false;
  function loadHubSpot() {
    if (hubspotLoaded) return;
    hubspotLoaded = true;
    var s = document.createElement('script');
    s.id = 'hs-script-loader'; s.async = true; s.defer = true;
    s.src = HUBSPOT_SRC;
    document.head.appendChild(s);
  }
  ['pointermove', 'mousemove', 'scroll', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, loadHubSpot, { once: true, passive: true });
  });
  if (document.readyState === 'complete') setTimeout(loadHubSpot, 3000);
  else window.addEventListener('load', function () { setTimeout(loadHubSpot, 3000); });


  /* ---------- Start ---------- */

  onReady(function () {
    pushToDataLayer();
    updateBookNowLinks();
    addParamsToForms();
    watchBookNowLinks();
    waitForGtag(function () {
      document.querySelectorAll(BOOK_NOW_SELECTOR).forEach(decorateWithLinker);
    });
    setTimeout(addHubSpotIdsToBookNowLinks, 300);
  });
})();
