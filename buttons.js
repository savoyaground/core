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

/* ========================================
   GOLD GLOW BUTTONS: CONSTANT-SPEED COMET
   A plain spin moves the comet at a steady angle, which on a wide button
   makes it crawl along the long edges and whip around the ends. This
   builds an orbit matched to each button's width and height so the head
   travels the edge at one steady speed. Without this script the comet
   falls back to the plain spin.
   ======================================== */
(function () {
  var SELECTOR = '.glow-btn-dark, .glow-btn-light';
  var HEAD = 0.97 * 360; /* where the head sits in the ring gradient, in degrees */
  var STEPS = 64;
  var made = {};
  var styleEl = null;

  /* Angle of a point from the center: 0deg is up, increasing clockwise */
  function angleAt(x, y) {
    return (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
  }

  /* Point on the edge, a distance d clockwise from top center */
  function pointAt(d, w, h) {
    var P = 2 * (w + h), hw = w / 2, hh = h / 2;
    d = ((d % P) + P) % P;
    if (d < hw) return [d, -hh];
    d -= hw; if (d < h) return [hw, -hh + d];
    d -= h;  if (d < w) return [hw - d, hh];
    d -= w;  if (d < h) return [-hw, hh - d];
    d -= h;  return [-hw + d, -hh];
  }

  function build(ratio) {
    var name = 'glow-orbit-' + Math.round(ratio * 10);
    if (made[name]) return name;
    var w = ratio, h = 1, P = 2 * (w + h);
    /* Start where the head sits at --glow-angle 0 (on the top edge) */
    var start = (h / 2) * Math.tan((HEAD - 360) * Math.PI / 180);
    var frames = [], prev = null, turn = 0;
    for (var i = 0; i <= STEPS; i++) {
      var a;
      if (i === 0) a = HEAD;
      else if (i === STEPS) a = HEAD + 360 - turn;
      else { var p = pointAt(start + P * i / STEPS, w, h); a = angleAt(p[0], p[1]); }
      if (prev !== null && a < prev - 180) turn += 360;
      prev = a;
      frames.push((i * 100 / STEPS).toFixed(4) + '%{--glow-angle:' + (a + turn - HEAD).toFixed(3) + 'deg}');
    }
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'glow-orbit-keyframes';
      document.head.appendChild(styleEl);
    }
    styleEl.appendChild(document.createTextNode('@keyframes ' + name + '{' + frames.join('') + '}'));
    made[name] = true;
    return name;
  }

  function fit(btn) {
    var w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    var ratio = Math.min(12, Math.max(1, Math.round((w / h) * 10) / 10));
    var name = build(ratio);
    if (btn.style.getPropertyValue('--orbit-anim') !== name) {
      btn.style.setProperty('--orbit-anim', name);
    }
  }

  function init() {
    var btns = document.querySelectorAll(SELECTOR);
    var ro = 'ResizeObserver' in window
      ? new ResizeObserver(function (entries) { entries.forEach(function (e) { fit(e.target); }); })
      : null;
    btns.forEach(function (btn) {
      fit(btn);
      if (ro) ro.observe(btn);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
