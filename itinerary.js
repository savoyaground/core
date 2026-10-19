/* =========================================================
   ITINERARY RAIL — Travel Advisors hero
   Pairs with itinerary.css. Auto-starts every ol[data-itinerary] on the page.

   Sequence: the line grows from the first stop to each next stop; on arrival the
   stop lights yellow with a halo and emits one sonar ring. Lit stops stay lit.

   Options (attributes on the ol):
     data-itinerary-loop        replay after a short hold
     data-itinerary-start="load" start on page load instead of when scrolled into view

   Adding stops: add another li.itin-stop. If stops are added after load,
   call el.savoyaItinerary.refresh().
   ========================================================= */
(function () {
  "use strict";

  var DWELL = 900;        // ms the line rests at each stop
  var START_DELAY = 450;  // ms before the first stop lights
  var RING_MS = 1700;     // keep in sync with .itin-ring animation
  var LOOP_HOLD = 2600;   // ms the finished state holds before a loop restarts
  var TRAVEL_BASE = 700, TRAVEL_PER_PX = 9, TRAVEL_MIN = 1000, TRAVEL_MAX = 2000;

  var easeInOutSine = function (x) { return -(Math.cos(Math.PI * x) - 1) / 2; };
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduced = function () { return !!(mq && mq.matches); };

  function Itinerary(list, opts) {
    this.list = list;
    this.opts = opts || {};
    this.loop = !!this.opts.loop;
    this.t = 0;
    this.playing = false;
    this.done = false;
    this.lit = [];
    this._raf = null;
    this._last = 0;
    this._loopTimer = null;

    // li wrappers keep the <ol> valid; they hold no content and take no layout space
    this.track = document.createElement("li");
    this.track.className = "itin-track";
    this.track.setAttribute("aria-hidden", "true");
    this.line = document.createElement("li");
    this.line.className = "itin-progress";
    this.line.setAttribute("aria-hidden", "true");
    list.insertBefore(this.line, list.firstChild);
    list.insertBefore(this.track, list.firstChild);

    this.measure();
    this.render();

    var self = this;
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self.measure(); self.render(); });
      this._ro.observe(list);
    } else {
      window.addEventListener("resize", function () { self.measure(); self.render(); });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { self.measure(); self.render(); });
    }
  }

  Itinerary.prototype.stops = function () {
    return Array.prototype.slice.call(this.list.querySelectorAll(".itin-stop"));
  };

  // Layout offsets, not bounding rects, so lit-dot scaling and entering rows don't skew positions.
  Itinerary.prototype.measure = function () {
    this.centers = this.stops().map(function (s) {
      var rail = s.querySelector(".itin-rail");
      return rail.offsetTop + rail.offsetHeight / 2;
    });
    this.arrive = [];
    var t = START_DELAY;
    for (var i = 0; i < this.centers.length; i++) {
      if (i > 0) {
        var dist = this.centers[i] - this.centers[i - 1];
        t += DWELL + Math.min(TRAVEL_MAX, Math.max(TRAVEL_MIN, TRAVEL_BASE + dist * TRAVEL_PER_PX));
      }
      this.arrive.push(t);
    }
    this.total = t + RING_MS;
    var c = this.centers;
    var first = c[0] || 0, last = c[c.length - 1] || 0;
    this.track.style.top = this.line.style.top = first + "px";
    this.track.style.height = (last - first) + "px";
  };

  Itinerary.prototype.lineLength = function (t) {
    var c = this.centers, a = this.arrive;
    if (!c.length || t < a[0]) return 0;
    for (var i = 1; i < c.length; i++) {
      var segStart = a[i - 1] + DWELL;
      if (t < segStart) return c[i - 1] - c[0];
      if (t < a[i]) return (c[i - 1] - c[0]) + easeInOutSine((t - segStart) / (a[i] - segStart)) * (c[i] - c[i - 1]);
    }
    return c[c.length - 1] - c[0];
  };

  Itinerary.prototype.render = function () {
    var full = (this.centers[this.centers.length - 1] || 0) - (this.centers[0] || 0);
    var len = this.lineLength(this.t);
    this.line.style.height = len + "px";
    this.line.style.setProperty("--itin-tip", this.playing && len > 0 && len < full ? 1 : 0);
    var stops = this.stops(), count = 0;
    for (var i = 0; i < stops.length; i++) {
      if (this.t >= this.arrive[i]) {
        count++;
        if (!this.lit[i]) this.light(stops[i], i);
      }
    }
    if (this.opts.onProgress) this.opts.onProgress(count, stops.length, Math.min(1, this.t / this.total));
  };

  Itinerary.prototype.light = function (stop, i) {
    this.lit[i] = true;
    stop.classList.add("is-lit");
    if (reduced()) return;
    var ring = document.createElement("span");
    ring.className = "itin-ring";
    ring.setAttribute("aria-hidden", "true");
    ring.addEventListener("animationend", function () { ring.remove(); });
    stop.querySelector(".itin-rail").appendChild(ring);
  };

  Itinerary.prototype.tick = function (now) {
    if (!this.playing) return;
    this.t += Math.min(64, now - this._last); // cap the step so a background tab doesn't jump ahead
    this._last = now;
    var self = this;
    if (this.t >= this.total) {
      this.t = this.total;
      this.playing = false;
      this.done = true;
      this.render();
      this._emit("done");
      if (this.loop) this._loopTimer = setTimeout(function () { self.replay(); }, LOOP_HOLD);
      return;
    }
    this.render();
    this._raf = requestAnimationFrame(function (n) { self.tick(n); });
  };

  Itinerary.prototype._emit = function (state) {
    if (this.opts.onState) this.opts.onState(state);
  };

  Itinerary.prototype.play = function () {
    if (reduced()) { this.finish(); return; }
    if (this.playing) return;
    if (this.done) { this.replay(); return; }
    this.playing = true;
    this.list.classList.remove("is-paused");
    var self = this;
    this._raf = requestAnimationFrame(function (n) { self._last = n; self.tick(n); });
    this._emit("playing");
  };

  Itinerary.prototype.pause = function () {
    this.playing = false;
    cancelAnimationFrame(this._raf);
    this.list.classList.add("is-paused");
    this.render();
    this._emit("paused");
  };

  Itinerary.prototype.reset = function () {
    clearTimeout(this._loopTimer);
    cancelAnimationFrame(this._raf);
    this.playing = false;
    this.done = false;
    this.t = 0;
    this.lit = [];
    this.list.classList.remove("is-paused");
    Array.prototype.forEach.call(this.list.querySelectorAll(".itin-ring"), function (r) { r.remove(); });
    this.stops().forEach(function (s) { s.classList.remove("is-lit"); });
    this.measure();
    this.render();
  };

  Itinerary.prototype.replay = function () {
    this.reset();
    var self = this;
    requestAnimationFrame(function () { self.play(); }); // let dots fade back to muted first
  };

  Itinerary.prototype.finish = function () {
    clearTimeout(this._loopTimer);
    cancelAnimationFrame(this._raf);
    this.measure();
    this.t = this.total;
    this.playing = false;
    this.done = true;
    this.render();
    this._emit("done");
  };

  // Call after adding or removing stops; the timeline extends and play continues.
  Itinerary.prototype.refresh = function () {
    this.measure();
    if (this.done && !reduced()) { this.done = false; this.play(); }
    else this.render();
  };

  window.SavoyaItinerary = Itinerary;

  function init(list) {
    if (list.savoyaItinerary) return list.savoyaItinerary;
    var itin = new Itinerary(list, { loop: list.hasAttribute("data-itinerary-loop") });
    list.savoyaItinerary = itin;
    var start = function () { reduced() ? itin.finish() : itin.play(); };
    if (list.getAttribute("data-itinerary-start") === "load" || !("IntersectionObserver" in window)) {
      start();
    } else {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); start(); }
      }, { threshold: 0.4 });
      io.observe(list);
    }
    return itin;
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll("ol[data-itinerary], ul[data-itinerary]"), init);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
})();
