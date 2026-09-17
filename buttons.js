/* ========================================
   GOLD GLOW BUTTONS: POINTER GLOW
   Moves the inner glow of .glow-btn-dark, .glow-btn-light, and
   .glow-btn-primary to follow the pointer. One listener on the document,
   so it works on every page and on duplicated pages with no Webflow
   interactions.
   ======================================== */
(function () {
  var SELECTOR = '.glow-btn-dark, .glow-btn-light, .glow-btn-primary';
  function track(e) {
    var btn = e.target.closest && e.target.closest(SELECTOR);
    if (!btn) return;
    var r = btn.getBoundingClientRect();
    /* Convert to the button's unscaled size, since hover scales it up */
    var sx = btn.offsetWidth / r.width || 1;
    var sy = btn.offsetHeight / r.height || 1;
    btn.style.setProperty('--mx', (e.clientX - r.left) * sx + 'px');
    btn.style.setProperty('--my', (e.clientY - r.top) * sy + 'px');
  }
  document.addEventListener('pointermove', track, { passive: true });
  document.addEventListener('pointerdown', track, { passive: true });
})();
