/*!
 * redirects.js — Savoya
 *
 * Loaded site-wide from webflow/site-footer.html via jsDelivr (full commit hash).
 *
 * Why: Chrome can show returning visitors a cached copy of a page that has since been
 * retired and 301-redirected. This asks Webflow (skipping every cache) whether the current
 * URL now redirects, and if so sends the visitor to the live destination.
 *
 * Runs at most once per page per browser session (plus on back/forward restores).
 * Only helps copies cached after this script went live.
 */
(function () {
  var KEY = 'svy-fresh:' + location.pathname;

  function check(force) {
    try {
      if (!force && sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch (e) { /* storage blocked: still run */ }

    fetch(location.pathname + location.search, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'follow',
      credentials: 'same-origin'
    }).then(function (res) {
      var here = location.origin + location.pathname;
      var there = res.url.split('#')[0].split('?')[0];
      // URL now redirects somewhere else: go there
      if (res.redirected && there !== here) location.replace(res.url + location.hash);
    }).catch(function () {
      // Off-site redirect (blocked by CORS): one revalidating reload. Skip if offline.
      if (!navigator.onLine) return;
      try {
        if (sessionStorage.getItem(KEY + ':r')) return;
        sessionStorage.setItem(KEY + ':r', '1');
      } catch (e) { return; }
      location.reload();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { check(false); });
  } else {
    check(false);
  }

  // Page restored from Chrome's back/forward cache
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) check(true);
  });
})();
