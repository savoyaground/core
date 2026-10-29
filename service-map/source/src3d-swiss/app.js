(function () {
  "use strict";

  /* ================= Data ================= */
  var BOOK = "https://core.savoya.net/reservations/create/retail";
  var SITE = "https://www.savoya.com";
  var REG = window.SVC_REGIONS;
  var MAPNAME = window.SVC_MAPNAME || {};
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cities = window.SVC_ROWS.map(function (r) {
    var airports = r[8] ? r[8].split(";").map(function (s) {
      var p = s.split("|");
      return { code: p[0], name: p[1], lat: p[2] ? +p[2] : null, lon: p[3] ? +p[3] : null, slug: p[4] || null };
    }) : [];
    return {
      name: r[0], region: r[1], country: r[2], state: r[3], slug: r[4], lat: r[5], lon: r[6], featured: !!r[7],
      airports: airports,
      nearby: r[9] ? r[9].split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [],
      label: r[0] + ", " + (r[3] || r[2])
    };
  });
  var bySlug = {};
  cities.forEach(function (c) { bySlug[c.slug] = c; });

  var countries = {};
  cities.forEach(function (c) {
    if (!countries[c.country]) countries[c.country] = { name: c.country, region: c.region, cities: [] };
    countries[c.country].cities.push(c);
  });
  Object.keys(countries).forEach(function (k) { countries[k].cities.sort(function (a, b) { return a.name.localeCompare(b.name); }); });

  var regionOrder = Object.keys(REG).map(function (name) {
    var cs = cities.filter(function (c) { return c.region === name; });
    var ks = Object.keys(countries).filter(function (k) { return countries[k].region === name; });
    return { name: name, cities: cs, countries: ks };
  }).filter(function (r) { return r.cities.length; })
    .sort(function (a, b) { return b.cities.length - a.cities.length; });
  var regionByName = {};
  regionOrder.forEach(function (r) { regionByName[r.name] = r; });

  var mapToCountry = {};
  Object.keys(countries).forEach(function (k) { mapToCountry[MAPNAME[k] || k] = k; });

  // Contiguous framing: Alaska and Hawaii stay on the map but don't stretch the US view
  function inFrame(c) { return !(c.country === "United States" && (c.state === "AK" || c.state === "HI")); }

  function countryAnchor(name) {
    if (name === "United States") return [-97.5, 38.5];
    if (anchorMemo[name]) return anchorMemo[name];
    var cs = countries[name].cities.filter(inFrame);
    var m = [d3.mean(cs, function (c) { return c.lon; }), d3.mean(cs, function (c) { return c.lat; })];
    var at = insideAnchor(name, m);
    if (F50 !== F110) anchorMemo[name] = at;   // keep it once the detailed coastlines are in (the rough ones put coastal pins at sea)
    return at;
  }
  // The average of a country's cities can land outside it (Canada's cities hug the US border, so the
  // average sits in Minnesota). Keep the pin on the country's own land, well clear of its border,
  // as close to that average as possible.
  var anchorMemo = {};
  function refreshAnchors() { // the detailed coastlines just arrived: re-seat the country pins on them
    anchorMemo = {};
    marks.forEach(function (m) { if (m.el.country) m.ll = countryAnchor(m.el.country); });
  }
  function insideAnchor(name, m) {
    var fs = F50.filter(function (f) { return f.svc === name; });
    if (!fs.length) return m;
    var inside = function (p) { return fs.some(function (f) { return d3.geoContains(f, p); }); };
    var deep = function (p, r) {   // the point and a ring of 8 points around it all on the country's land
      if (!inside(p)) return false;
      for (var a = 0; a < 8; a++) { var t = a * Math.PI / 4; if (!inside([p[0] + Math.cos(t) * r * 1.4, p[1] + Math.sin(t) * r])) return false; }
      return true;
    };
    var b = countryBox(name), w = b[0][0], s = b[0][1], e = b[1][0], n = b[1][1];
    var r = Math.max(0.4, Math.min(3, (n - s) / 6));
    if (deep(m, r)) return m;   // already well inside: leave it where it was
    var grid = [];   // try points nearest the average first and stop at the first one that is well inside
    for (var i = 0; i <= 30; i++) for (var j = 0; j <= 30; j++) {
      var p = [w + (e - w) * i / 30, s + (n - s) * j / 30];
      grid.push({ p: p, d: d3.geoDistance(p, m) });
    }
    grid.sort(function (a, b) { return a.d - b.d; });
    // narrow countries (Great Britain, Italy, Chile) can't fit the full margin, so ask for less, step by step
    var landed = grid.filter(function (g) { return inside(g.p); });
    for (var t = r; t >= r / 8; t /= 2) {
      for (var k = 0; k < landed.length; k++) if (deep(landed[k].p, t)) return landed[k].p;
    }
    return landed.length ? landed[0].p : m;
  }
  function padBox(w, s, e, n, pad, minLon, minLat) {
    var cx = (w + e) / 2, cy = (s + n) / 2;
    var dx = Math.max((e - w) * (1 + pad), minLon) / 2, dy = Math.max((n - s) * (1 + pad), minLat) / 2;
    return [[cx - dx, cy - dy], [cx + dx, cy + dy]];
  }
  function countryBox(name) {
    if (name === "United States") return [[-124.8, 24.4], [-66.9, 49.4]];   // the lower 48, edge to edge
    var cs = countries[name].cities.filter(inFrame);
    return padBox(d3.min(cs, lon), d3.min(cs, lat), d3.max(cs, lon), d3.max(cs, lat), 0.5, 7, 5);
  }
  function cityPoints(c) {
    var pts = [[c.lon, c.lat]];
    c.airports.forEach(function (a) { if (a.lat != null) pts.push([a.lon, a.lat]); });
    return pts;
  }
  function cityBox(c) {
    var pts = cityPoints(c);
    return padBox(d3.min(pts, f0), d3.min(pts, f1), d3.max(pts, f0), d3.max(pts, f1), 0.35, 0.7, 0.5);
  }
  function airportBox(c, a) {
    return padBox(Math.min(c.lon, a.lon), Math.min(c.lat, a.lat), Math.max(c.lon, a.lon), Math.max(c.lat, a.lat), 0.6, 0.3, 0.22);
  }
  function cityFrame(c) { // stay at country scale; never a deep city zoom
    var b = countryBox(c.country);
    if (c.lon < b[0][0] || c.lon > b[1][0] || c.lat < b[0][1] || c.lat > b[1][1]) b = padBox(c.lon, c.lat, c.lon, c.lat, 0, 16, 10);
    return b;
  }
  // The whole service area: the city, the surrounding towns we could place, and nearby airports.
  var NEAR_MAX = 30;   // most surrounding-town dots drawn at once; the pill carries the full count
  function reachLabel(n) { return n >= 100 ? Math.floor(n / 100) * 100 + "+" : n > NEAR_MAX ? Math.floor(n / 10) * 10 + "+" : String(n); }
  function areaPoints(c) {
    if (c._area) return c._area;
    var pts = [[c.lon, c.lat]];
    (c.near || []).forEach(function (t) { pts.push([t.lon, t.lat]); });
    c.airports.forEach(function (a) { if (a.lat != null && d3.geoDistance([c.lon, c.lat], [a.lon, a.lat]) < 0.025) pts.push([a.lon, a.lat]); });
    var hull = pts.length >= 3 ? d3.polygonHull(pts) : null;
    if (hull) { // ease the outline out a little past the outermost towns
      var cx = d3.mean(hull, f0), cy = d3.mean(hull, f1);
      hull = hull.map(function (p) { var dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * 0.06 + dx * 0.06, p[1] + dy / L * 0.045 + dy * 0.06]; });
    }
    var towns = (c.near || []).filter(function (t) { return d3.geoDistance([t.lon, t.lat], [c.lon, c.lat]) >= 0.0006; })
      .sort(function (a, b) { return d3.geoDistance([a.lon, a.lat], [c.lon, c.lat]) - d3.geoDistance([b.lon, b.lat], [c.lon, c.lat]); });
    var shown = towns;
    if (towns.length > NEAR_MAX) { // a spread from the closest town to the farthest, so the dots show the full reach
      shown = []; for (var i = 0; i < NEAR_MAX; i++) shown.push(towns[Math.round(i * (towns.length - 1) / (NEAR_MAX - 1))]);
    }
    c._area = { pts: pts, hull: hull, shown: shown };
    return c._area;
  }
  function areaBox(c) { // the final, closest framing: the service area beside the details pane
    var pts = areaPoints(c).pts;
    return padBox(d3.min(pts, f0), d3.min(pts, f1), d3.max(pts, f0), d3.max(pts, f1), 0.3, 0.45, 0.32);
  }
  function cityRadius(c) { // service ring, in degrees
    var r = 0.3;
    cityPoints(c).forEach(function (p) { r = Math.max(r, d3.geoDistance([c.lon, c.lat], p) * 180 / Math.PI + 0.06); });
    return Math.min(r, 0.95);
  }
  function lon(c) { return c.lon; } function lat(c) { return c.lat; }
  function f0(p) { return p[0]; } function f1(p) { return p[1]; }
  var PHONE_AT = { "Europe": [8, 60], "Middle East": [50, 20], "Asia": [112, 40], "Africa": [14, 0], "North America": [-104, 46] };
  var WORLD_BOX = [[-150, -50], [170, 70]];

  /* ================= Map geometry ================= */
  var NAME_REG = { "Somaliland": "Africa", "Kosovo": "Europe", "N. Cyprus": "Middle East", "Siachen Glacier": "Asia", "Indian Ocean Ter.": "Australia" };
  var hoverReg = null;
  function readTopo(id) { return JSON.parse(document.getElementById(id).textContent); }
  var t110 = readTopo("topo110"), t50 = readTopo("topo50"), tUS = readTopo("topoUS");
  function feats(t) {
    var list = [];
    topojson.feature(t, t.objects.countries).features.forEach(function (f) {
      if (f.properties.name === "Antarctica") return;
      // Savoya doesn't serve Alaska: split it off the United States so it isn't tinted or outlined as served
      if (f.properties.name === "United States of America" && f.geometry.type === "MultiPolygon") {
        var ak = [], rest = [];
        f.geometry.coordinates.forEach(function (poly) {
          var c = d3.geoCentroid({ type: "Polygon", coordinates: poly });
          ((c[1] > 50 && (c[0] < -129 || c[0] > 170)) ? ak : rest).push(poly);
        });
        if (ak.length) {
          list.push({ type: "Feature", id: f.id, properties: { name: "Alaska" }, geometry: { type: "MultiPolygon", coordinates: ak } });
          f = { type: "Feature", id: f.id, properties: f.properties, geometry: { type: "MultiPolygon", coordinates: rest } };
        }
      }
      list.push(f);
    });
    return list
      .map(function (f) {
        f.b = d3.geoBounds(f);
        f.c = d3.geoCentroid(f);
        f.r = Math.max(d3.geoDistance(f.c, f.b[0]), d3.geoDistance(f.c, f.b[1]), d3.geoDistance(f.c, [f.b[0][0], f.b[1][1]]), d3.geoDistance(f.c, [f.b[1][0], f.b[0][1]]));
        f.wraps = f.b[0][0] > f.b[1][0];
        f.svc = mapToCountry[f.properties.name] || null;
        f.reg = (window.SVC_CONT || {})[f.id] || NAME_REG[f.properties.name] || null;
        return f;
      });
  }
  var F110 = feats(t110), F50 = feats(t50);
  var usStates = topojson.mesh(tUS, tUS.objects.states, function (a, b) { return a !== b; });
  var graticule = d3.geoGraticule10();

  /* ================= Canvas + zoom ================= */
  var app = document.getElementById("app");
  var leftPanel = document.getElementById("leftPanel");
  var canvas = document.getElementById("map");
  var ctx = canvas.getContext("2d");
  // a light overlay for things that move on their own (cars, the city plane), so the globe underneath
  // only repaints when the camera moves
  var fxCanvas = document.createElement("canvas"); fxCanvas.className = "fxl"; fxCanvas.setAttribute("aria-hidden", "true");
  canvas.parentNode.insertBefore(fxCanvas, canvas.nextSibling);
  var fxctx = fxCanvas.getContext("2d"), fxDirty = false;
  // pause all motion while the map is scrolled out of view
  var onScreen = true;
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; if (onScreen) schedule(); }).observe(canvas);
  var markersEl = document.getElementById("markers");
  var W = 0, H = 0, dpr = 1;
  // 3D globe: orthographic projection. cur = the camera: centre lon/lat, scale k (px per radian = globe radius),
  // and the screen point (cx, cy) the globe is centred on.
  var proj = d3.geoOrthographic().clipAngle(90).precision(0.35);
  var path = d3.geoPath(proj, ctx), shapePath = d3.geoPath(proj), shapes = null;
  function shape(f) { // the country outline traced once per frame, then reused for fills and strokes
    var p = shapes && shapes.get(f);
    if (!p) {
      p = new Path2D(); var tr = shapePath.context(p);
      // close in, skip the islands and far ends of big countries that are off screen (Russia, Canada, Norway...)
      if (shapeView && f.geometry.type === "MultiPolygon" && cur.k > 600) {
        partsOf(f).forEach(function (q) { if (d3.geoDistance(q.c, shapeView.c) - q.r < shapeView.a) tr(q.g); });
      } else tr(f);
      if (shapes) shapes.set(f, p);
    }
    return p;
  }
  function partsOf(f) { // each piece of a country with its own bounding circle, worked out once
    return f.parts || (f.parts = f.geometry.coordinates.map(function (poly) {
      var g = { type: "Polygon", coordinates: poly }, b = d3.geoBounds(g), c = d3.geoCentroid(g);
      var r = Math.max(d3.geoDistance(c, b[0]), d3.geoDistance(c, b[1]), d3.geoDistance(c, [b[0][0], b[1][1]]), d3.geoDistance(c, [b[1][0], b[0][1]]));
      return { g: g, c: c, r: r + 0.01 };
    }));
  }
  var shapeView = null;
  function shapeOf(list) { var p = new Path2D(); list.forEach(function (f) { p.addPath(shape(f)); }); return p; }
  var cur = { lon: -30, lat: 24, k: 300, cx: 0, cy: 0 };
  var projKey = "";
  function syncProj() { // re-aiming the projection resets its caches, so only do it when the camera actually moved
    var key = cur.k + "," + cur.cx + "," + cur.cy + "," + cur.lon + "," + cur.lat;
    if (key === projKey) return;
    projKey = key;
    // close in, the detailed map is already dense enough that bending each edge along the globe adds nothing visible
    var prec = cur.k > 900 ? 0 : 0.35;
    if (proj.precision() !== prec) proj.precision(prec);
    proj.scale(cur.k).translate([cur.cx, cur.cy]).rotate([-cur.lon, -cur.lat]);
  }
  function P(ll) { // screen point, or null when the place is on the far side of the globe
    if (d3.geoDistance(ll, [cur.lon, cur.lat]) > 1.54) return null;
    syncProj(); return proj(ll);
  }
  var C = {};
  function readTokens() {
    var css = getComputedStyle(app);
    var tok = function (n) { return css.getPropertyValue(n).trim(); };
    C = {
      land: tok("--land"), served: tok("--land-served"), scope: tok("--land-scope"), active: tok("--land-active"),
      hover: tok("--land-hover"), green: tok("--land-green"), mintRGB: tok("--mint-rgb"), hoverA: tok("--hover-a") || "#C56129", hoverB: tok("--hover-b") || "#F5AD59", mintA: +tok("--mint-alpha") || 0.25,
      litRGB: tok("--lit-rgb"), gold: tok("--gold"),
      lit2RGB: tok("--lit-rgb") || "246, 203, 79", nearDot: tok("--near-dot"), nearText: tok("--near-text"), nearHalo: tok("--near-halo"), nearEdge: tok("--near-edge"), areaEdge: tok("--area-edge"),
      seaHi: tok("--sea-hi"), seaLo: tok("--sea-lo"), glowRGB: tok("--glow-rgb"), limbRGB: tok("--limb-rgb"), limbA: +tok("--limb-alpha") || 0.3,
      grid: tok("--map-grid"), servedEdge: tok("--map-served-edge"), border: tok("--map-border"), states: tok("--map-states"), focus: tok("--map-focus"), ring: tok("--map-ring"), dot: tok("--map-dot")
    };
  }
  // one look: the dark map (Light mode retired, Oct 27)
  app.setAttribute("data-map", "dark"); readTokens();

  var K_MAX = 60000, anim = null, spin = null, idleT = 0, lastInteract = 0;
  var kFitMemo = { t: 0, v: 0 };
  function kFit() { // the globe-fits-the-view scale; re-measured at most every 200ms (it reads layout)
    var now = performance.now(); if (now - kFitMemo.t < 200 && kFitMemo.v) return kFitMemo.v;
    var r = viewRect(); kFitMemo.t = now; return (kFitMemo.v = Math.min(r.w, r.h) / 2 * 0.94);
  }
  function stopAnim() { if (anim) { anim.stop(); anim = null; } if (spin) { spin.stop(); spin = null; } }
  var sel = { interrupt: function () { stopAnim(); flyToken++; } };
  function clampLat(v) { return Math.max(-80, Math.min(80, v)); }
  function rotateBy(dx, dy) {
    var deg = 180 / Math.PI / cur.k;
    cur.lon -= dx * deg; cur.lat = clampLat(cur.lat + dy * deg);
    if (cur.lon > 180) cur.lon -= 360; if (cur.lon < -180) cur.lon += 360;
  }
  function zoomAt(f, px, py) { // scale by f, keeping the place under the pointer still
    syncProj();
    var before = px != null ? proj.invert([px, py]) : null;
    cur.k = Math.max(kFit() * 0.9, Math.min(K_MAX, cur.k * f));
    if (before && isFinite(before[0])) {
      syncProj(); var after = proj.invert([px, py]);
      if (after && isFinite(after[0])) { cur.lon += before[0] - after[0]; cur.lat = clampLat(cur.lat + before[1] - after[1]); }
    }
    schedule();
  }
  var ptrs = {}, dragMoved = false, vel = [0, 0], lastMove = 0, pinch0 = 0;
  canvas.addEventListener("pointerdown", function (e) {
    stopAnim(); lastInteract = Date.now(); FX.netT0 = 0;
    ptrs[e.pointerId] = [e.clientX, e.clientY];
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    dragMoved = false; vel = [0, 0];
    var ids = Object.keys(ptrs);
    if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  canvas.addEventListener("pointermove", function (e) {
    var prev = ptrs[e.pointerId]; if (!prev) return;
    var ids = Object.keys(ptrs);
    if (ids.length === 2) {
      ptrs[e.pointerId] = [e.clientX, e.clientY];
      var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0) { var r = canvas.getBoundingClientRect(); zoomAt(d / pinch0, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
      pinch0 = d; dragMoved = true; return;
    }
    var dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    if (!dragMoved && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!dragMoved) { dragMoved = true; canvas.classList.add("is-dragging"); hideTip(); }
    ptrs[e.pointerId] = [e.clientX, e.clientY];
    rotateBy(dx, dy);
    var now = performance.now(), dt = Math.max(8, now - (lastMove || now - 16)); lastMove = now;
    vel = [dx / dt * 16, dy / dt * 16];
    lastInteract = Date.now(); FX.netT0 = 0; schedule();
  });
  function endPtr(e) {
    if (!ptrs[e.pointerId]) return;
    delete ptrs[e.pointerId]; pinch0 = 0;
    canvas.classList.remove("is-dragging");
    if (dragMoved && !reduced && Object.keys(ptrs).length === 0 && performance.now() - lastMove < 80 && Math.hypot(vel[0], vel[1]) > 1) {
      var v = vel.slice();                                  // momentum: the globe keeps turning and eases to a stop
      spin = d3.timer(function () {
        v[0] *= 0.94; v[1] *= 0.94; rotateBy(v[0], v[1]); schedule();
        if (Math.hypot(v[0], v[1]) < 0.15) { spin.stop(); spin = null; }
      });
    }
  }
  canvas.addEventListener("pointerup", endPtr);
  canvas.addEventListener("pointercancel", endPtr);
  // wheel zooms; zoomed all the way out, scrolling down hands off to the page (and back up returns to the map)
  function pageScrolls() { return document.documentElement.scrollHeight > window.innerHeight + 4; }
  function mapInView() { var r = app.getBoundingClientRect(); return r.top >= -2 && r.bottom <= window.innerHeight + 2; }
  function atGlobe() { return cur.k <= kFit() * 1.02; }
  canvas.addEventListener("wheel", function (e) {
    if (!e.ctrlKey && pageScrolls()) {
      if (!mapInView()) return;
      if (e.deltaY > 0 && atGlobe()) return;
    }
    e.preventDefault(); stopAnim(); lastInteract = Date.now(); FX.netT0 = 0;
    var r = canvas.getBoundingClientRect();
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  // a slow idle turn on the globe view, like Google Earth; any touch of the map stops it
  // world view: a steady west-to-east turn (the land slides left to right), easing in after any interaction
  // and slowing to a crawl while a region is hovered so the highlight stays readable
  var SPIN_DEG_S = 10;   // degrees per second, west to east like the real Earth
  function idleSpin() {
    if (reduced) return;
    var last = 0, v = 0;
    d3.timer(function (t) {
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      var on = !(anim || spin || !onScreen || document.hidden || Date.now() - lastInteract < 1800 || Object.keys(ptrs).length || cur.k > kFit() * 1.08);   // turns whenever you are out at globe scale
      var target = on ? (hoverReg ? 0.25 : 1) : 0;
      v += (target - v) * Math.min(1, dt * 1.6);          // ease the speed in and out
      if (!on) { if (v < 0.01) { v = 0; return; } if (anim || spin || Object.keys(ptrs).length) { v = 0; return; } }
      if (v < 0.002) return;
      cur.lon -= SPIN_DEG_S * v * dt; if (cur.lon < -180) cur.lon += 360; schedule();
    });
  }

  var raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame() {
    raf = 0; vrMemo = [null, null];
    vrMemo = [viewRectNow(false), viewRectNow(true)];   // measured before anything on the page is moved this frame
    draw(); place(); fxDraw();
    vrMemo = null;
    // zoomed back out to a whole globe from a continent: tuck the crowded country labels away
    var far = state.level === "region" && cur.k < kFit() * 1.3;
    if (far !== app.classList.contains("is-far")) app.classList.toggle("is-far", far);
  }

  function resize() {
    var r = app.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    fxCanvas.width = canvas.width; fxCanvas.height = canvas.height; FX.starLayer = null; kFitMemo.t = 0;
    var vr = viewRect(); cur.cx = vr.x + vr.w / 2; cur.cy = vr.y + vr.h / 2;
  }

  function visibleBounds() { // angular radius of what's on screen, around the camera centre
    return { c: [cur.lon, cur.lat], a: Math.min(Math.PI / 2, Math.hypot(W, H) / 2 / cur.k + 0.05) };
  }
  function isVisible(f, vb) {
    return d3.geoDistance(f.c, vb.c) - f.r < vb.a;
  }

  function landColor(f) {
    if (f === hoverFeat && f.svc) return C.hover;
    if (!f.svc) return C.land;
    if (state.country && f.svc === state.country) return C.active;
    if (state.level === "region" && countries[f.svc].region === state.region) return C.scope;
    if (state.level === "world") return C.scope;
    return C.served;
  }

  var regFade = {}, fading = 0, lastFade = 0;
  function fadeTick(now) {
    var dt = lastFade ? Math.min(64, now - lastFade) : 16; lastFade = now;
    var busy = false;
    regionOrder.forEach(function (r) {
      var target = state.level === "world" && hoverReg === r.name ? 1 : 0;
      var t = regFade[r.name] || 0;
      if (t !== target) {
        t = target > t ? Math.min(1, t + dt / 320) : Math.max(0, t - dt / 260);
        regFade[r.name] = t; busy = true;
      }
    });
    schedule();
    if (busy) fading = requestAnimationFrame(fadeTick); else { fading = 0; lastFade = 0; }
  }
  function kickFade() { if (!fading) { lastFade = 0; fading = requestAnimationFrame(fadeTick); } }

  /* ================= Flourishes: starfield, night lights, intro, route arcs, driver pulses ================= */
  var FX = { stars: [], introT0: 0, introDur: 2600, introFrom: null, introTo: null, parts: [], arcFor: null, arcT0: 0 };
  (function () { // a fixed, seeded sky so the stars never jump between frames
    var s = 7; function rnd() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }
    for (var i = 0; i < 320; i++) FX.stars.push({ u: rnd(), v: rnd(), r: rnd() < 0.08 ? 1.25 : 0.4 + rnd() * 0.55, a: 0.18 + rnd() * 0.55, ph: rnd() * 6.283, sp: 0.6 + rnd() * 1.6, warm: rnd() < 0.18 });
    for (i = 0; i < 180; i++) FX.parts.push({ a: rnd() * 6.283, r0: 1.5 + rnd() * 1.6, spin: 1.4 + rnd() * 1.8, d: rnd() * 0.35, sz: 0.6 + rnd() * 1.5 });
  })();
  var glowSprite = (function () { // one warm glow, stamped for every city at night
    var c = document.createElement("canvas"), n = 64; c.width = c.height = n;
    var g = c.getContext("2d"), rg = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    rg.addColorStop(0, "rgba(255,214,150,0.95)"); rg.addColorStop(0.18, "rgba(245,173,89,0.55)"); rg.addColorStop(0.5, "rgba(197,97,41,0.16)"); rg.addColorStop(1, "rgba(197,97,41,0)");
    g.fillStyle = rg; g.fillRect(0, 0, n, n); return c;
  })();
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function introU(now) { return FX.introT0 ? clamp01((now - FX.introT0) / FX.introDur) : 1; }
  function homeLon() { // the visitor's side of the world, from their time zone
    var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* ignore */ }
    if (/^America\//.test(tz)) return -82;
    if (/^Europe\/|^Atlantic\//.test(tz)) return 8;
    if (/Dubai|Riyadh|Qatar|Kuwait|Bahrain|Muscat|Tehran|Baghdad|Jerusalem|Tel_Aviv|Amman|Beirut/.test(tz)) return 48;
    if (/^Africa\//.test(tz)) return 20;
    if (/^Australia\/|^Pacific\/Auckland/.test(tz)) return 140;
    if (/^Asia\//.test(tz)) return 105;
    return WORLD_VIEW.lon;
  }
  function startIntro() {
    if (reduced) return;
    var t = boxTransform(WORLD_BOX), to = homeLon();
    FX.introFrom = { lon: to + 95, k: t.k * 0.42 }; FX.introTo = { lon: to, k: t.k };   // swings in west to east, matching the spin
    cur.lon = FX.introFrom.lon; cur.k = FX.introFrom.k;
    FX.introT0 = performance.now(); startNetwork(900); lastInteract = Date.now();
    app.classList.add("is-intro");
    var tm = d3.timer(function () {
      var u = introU(performance.now()), e = d3.easeCubicOut(clamp01((u - 0.12) / 0.88));
      if (Object.keys(ptrs).length || anim || state.level !== "world") { FX.introT0 = 0; app.classList.remove("is-intro"); tm.stop(); schedule(); return; }
      cur.lon = FX.introFrom.lon + (FX.introTo.lon - FX.introFrom.lon) * e;
      cur.k = FX.introFrom.k * Math.pow(FX.introTo.k / FX.introFrom.k, e);
      if (u > 0.55) app.classList.remove("is-intro");
      lastInteract = Date.now() - 1500;   // the idle spin picks up right after
      schedule();
      if (u >= 1) { FX.introT0 = 0; tm.stop(); }
    });
  }
  function starLayer() {
    if (FX.starLayer) return FX.starLayer;
    var c = document.createElement("canvas"); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var g = c.getContext("2d"); g.scale(dpr, dpr);
    FX.stars.forEach(function (s) {
      g.globalAlpha = s.a * 0.85; g.fillStyle = s.warm ? "#F5D3A6" : "#FFFFFF";
      g.beginPath(); g.arc(s.u * W, s.v * H, s.r, 0, 6.2832); g.fill();
    });
    return (FX.starLayer = c);
  }
  function drawStars(now, gx, gy, R0) {
    var fade = clamp01(2.2 - cur.k / kFit()) * (0.35 + 0.65 * introU(now)); if (fade <= 0) return;
    var L = starLayer(), off = ((cur.lon / 360 * 0.35) % 1 + 1) % 1 * W;   // a touch of parallax as the globe turns
    ctx.globalAlpha = fade;
    ctx.drawImage(L, 0, 0, L.width, L.height, off, 0, W, H);
    ctx.drawImage(L, 0, 0, L.width, L.height, off - W, 0, W, H);
    ctx.globalAlpha = 1;
  }
  function drawNightLights() {
    if (state.level !== "world") return;   // world view only: once you pick a continent the lights go off
    var z = cur.k / kFit(), a = clamp01(1.25 - (z - 1) / 5); if (a <= 0) return;
    var sz = 18;
    ctx.save(); ctx.globalAlpha = 0.42 * a;   // plain blending: cheaper than additive, and a touch fainter
    cities.forEach(function (c) {
      var p = P([c.lon, c.lat]); if (!p || p[0] < -30 || p[0] > W + 30 || p[1] < -30 || p[1] > H + 30) return;
      ctx.drawImage(glowSprite, p[0] - sz / 2, p[1] - sz / 2, sz, sz);
    });
    ctx.restore();
  }
  function curvePts(a, b, bend, n) { // a soft arc between two screen points
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    var cx = mx - dy / L * L * bend, cy = my + dx / L * L * bend, out = [];
    if (cy > my) { cx = mx + dy / L * L * bend; cy = my - dx / L * L * bend; }      // always bow upward
    for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]); }
    return out;
  }

  // top-view car: copper body, dark glass, nose up on a 10 x 18 grid
  var CAR_BODY = new Path2D("M3.2 1.2 Q5 0 6.8 1.2 Q8.2 2.4 8.4 5 L8.4 15 Q8.4 17.6 5 17.6 Q1.6 17.6 1.6 15 L1.6 5 Q1.8 2.4 3.2 1.2 Z");
  var CAR_GLASS = new Path2D("M2.8 5.6 Q5 4.6 7.2 5.6 L6.6 8.2 L3.4 8.2 Z M3.3 13 L6.7 13 L7.1 14.8 Q5 15.6 2.9 14.8 Z");
  function drawCar(x, y, ang) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); ctx.scale(0.85, 0.85); ctx.translate(-5, -9);
    ctx.shadowColor = "rgba(245,173,89,0.85)"; ctx.shadowBlur = 9;
    ctx.fillStyle = "#DD9058"; ctx.fill(CAR_BODY);
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(20,19,19,0.85)"; ctx.fill(CAR_GLASS);
    ctx.lineWidth = 0.6; ctx.strokeStyle = "rgba(255,230,200,0.55)"; ctx.stroke(CAR_BODY);
    ctx.restore();
  }

  // ---- street cars: up to 3 little cars driving the city's grid, squaring off every corner ----
  function seeded(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  function streetLoop(c, idx) { // a closed loop of right-angle legs on a north/east street grid, in lon/lat
    c._loops = c._loops || {};
    if (c._loops[idx]) return c._loops[idx];
    var b = areaBox(c), wDeg = (b[1][0] - b[0][0]) * Math.cos(c.lat * Math.PI / 180);
    var step = Math.max(0.004, Math.min(0.02, wDeg / 36)), sx = step / Math.cos(c.lat * Math.PI / 180), lim = 7;
    var rnd = seeded(c.slug + ":" + idx);
    var gx = Math.round((rnd() - 0.5) * 4), gy = Math.round((rnd() - 0.5) * 4), dir = Math.floor(rnd() * 4);
    var D = [[1, 0], [0, 1], [-1, 0], [0, -1]], pts = [[gx, gy]];
    for (var leg = 0; leg < 9; leg++) {
      var n = 1 + Math.floor(rnd() * 3);
      dir = (dir + (rnd() < 0.5 ? 1 : 3)) % 4;                 // always a sharp left or right
      var nx = gx + D[dir][0] * n, ny = gy + D[dir][1] * n;
      if (Math.abs(nx) > lim || Math.abs(ny) > lim) { dir = (dir + 2) % 4; nx = gx + D[dir][0] * n; ny = gy + D[dir][1] * n; }
      gx = nx; gy = ny; pts.push([gx, gy]);
    }
    if (gx !== pts[0][0]) pts.push([pts[0][0], gy]);            // square back home
    pts.push([pts[0][0], pts[0][1]]);
    var ll = pts.map(function (p) { return [c.lon + p[0] * sx, c.lat + p[1] * step]; });
    var cum = [0]; for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]));
    return (c._loops[idx] = { ll: ll, cum: cum, len: cum[cum.length - 1] });
  }
  function alongLoop(L, s) { // position (lon/lat) and leg index at distance s (in grid steps)
    s = ((s % L.len) + L.len) % L.len;
    var i = 1; while (i < L.cum.length - 1 && L.cum[i] < s) i++;
    var a = L.ll[i - 1], b = L.ll[i], f = (s - L.cum[i - 1]) / ((L.cum[i] - L.cum[i - 1]) || 1);
    return { ll: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], i: i, f: f };
  }
  function drawStreetCars(now, c, vis, mode) {
    var t0 = FX.arcT0 + 900;
    for (var k = 0; k < 3; k++) {
      var L = streetLoop(c, k), speed = 1.15 - k * 0.15;          // grid steps per second
      var appear = clamp01((now - t0 - k * 500) / 600); if (appear <= 0) continue;
      var s = (now - t0 - k * 500) / 1000 * speed + k * 2.3;
      // the route ahead, very faint (Planned route preview)
      if (mode === "route") {
        ctx.globalAlpha = vis * appear * 0.16; ctx.strokeStyle = "#DD9058"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
        ctx.beginPath(); L.ll.forEach(function (q, i) { var p = P(q); if (p) i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); ctx.setLineDash([]);
      }
      // a short fading trail behind the car, following the corners
      var prev = null;
      for (var b = 30; b >= 0; b--) {
        var q = alongLoop(L, s - b * 0.12), p = P(q.ll);
        if (prev && p) { ctx.globalAlpha = vis * appear * Math.pow(1 - b / 30, 1.6); ctx.strokeStyle = "#F5AD59"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
        prev = p;
      }
      var here = alongLoop(L, s), hp = P(here.ll); if (!hp) continue;
      var a0 = L.ll[here.i - 1], a1 = L.ll[here.i], pa = P(a0), pb = P(a1); if (!pa || !pb) continue;
      var ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]);
      var segLen = L.cum[here.i] - L.cum[here.i - 1];
      if (here.f * segLen < 0.12 && here.i > 1) { // snap through the corner quickly
        var pz = P(L.ll[here.i - 2]); if (pz) { var a2 = Math.atan2(pa[1] - pz[1], pa[0] - pz[0]), d = Math.atan2(Math.sin(ang - a2), Math.cos(ang - a2)); ang = a2 + d * (here.f * segLen / 0.12); }
      }
      ctx.globalAlpha = vis * appear; drawCar(hp[0], hp[1], ang);
    }
  }
  function lPts(a, b, i, n) { // two straight legs with one sharp corner
    var corner = i % 2 ? [a[0], b[1]] : [b[0], a[1]], out = [], l1 = Math.hypot(corner[0] - a[0], corner[1] - a[1]), l2 = Math.hypot(b[0] - corner[0], b[1] - corner[1]), T = l1 + l2 || 1;
    for (var k = 0; k <= n; k++) { var d = k / n * T; out.push(d <= l1 ? [a[0] + (corner[0] - a[0]) * d / (l1 || 1), a[1] + (corner[1] - a[1]) * d / (l1 || 1)] : [corner[0] + (b[0] - corner[0]) * (d - l1) / (l2 || 1), corner[1] + (b[1] - corner[1]) * (d - l1) / (l2 || 1)]); }
    return out;
  }
  // landmark badges on the continent labels (vector line art, copper on dark glass)
  var LANDMARK = {"North America": "<g fill='currentColor'><path d='M15.7 1c1 .9 1 2.1.1 2.8-.7-.6-.9-1.7-.1-2.8Z'/><path d='M15 3.9h1.5l-.5 1.1-.6 4.4-1.5-.3.8-4.1Z'/><path d='M9.2 5.3 8.4 4l1.5.5.3-1.6.7 1.5.8-1.4.3 1.6 1.3-.7-.6 1.5Z'/><circle cx='11.2' cy='6.6' r='1.2'/><path d='M9.6 8.1h3.3l1.1 2-.7 7.8H9.4l-.3-6-1.3-.3 1-1.5Z'/><path d='M7.6 10.4l1.6-.4.5 2.6-1.6.3Z'/><path d='M8.3 18.2h6.2v1.5H8.3zM7.3 19.9h8.2V22H7.3z'/></g>", "South America": "<g fill='currentColor'><circle cx='12' cy='4.3' r='1.35'/><path d='M10.7 6.1h2.6l.35 1.25 6.9.15v1.1l-6.95.45-.3 8.7h-2.6l-.3-8.7-6.95-.45V7.5l6.9-.15Z'/><path d='M9.6 17.6h4.8V20H9.6z'/></g><path d='M2.5 22c3.2-2.8 6-3.4 9.5-3.4s6.3.6 9.5 3.4' fill='none' stroke='currentColor' stroke-width='1.2' stroke-linecap='round'/>", "Europe": "<g fill='none' stroke='currentColor' stroke-width='1.25' stroke-linejoin='round' stroke-linecap='round'><path d='M12 1.5v2.3'/><path d='M10.9 3.8h2.2l.5 5h-3.2Z'/><path d='M9.6 8.8h4.8M10.4 8.8 8.9 13.6h6.2l-1.5-4.8'/><path d='M7.8 13.6h8.4'/><path d='M8.9 13.6 6 21.5h3c.6-2.7 1.6-4 3-4s2.4 1.3 3 4h3l-2.9-7.9'/></g>", "Asia": "<g fill='currentColor'><path d='M11.75 1.2h.5v2h-.5z'/><path d='M12 3.1c.3.9 1.2 1.3 1.9 2 1.1 1 1.6 2.3 1.4 3.6H8.7c-.2-1.3.3-2.6 1.4-3.6.7-.7 1.6-1.1 1.9-2Z'/><path fill-rule='evenodd' d='M7.4 9.2h9.2v8.6H7.4Zm3.2 8.6v-3.3c0-.9.6-1.6 1.4-1.6s1.4.7 1.4 1.6v3.3Z'/><path d='M7.7 9.2c0-1 .5-1.6 1.2-1.9.7.3 1.2.9 1.2 1.9ZM13.9 9.2c0-1 .5-1.6 1.2-1.9.7.3 1.2.9 1.2 1.9Z'/><path d='M4.1 7.6h1.2v10.2H4.1zM18.7 7.6h1.2v10.2h-1.2zM4 7.6l.7-1.4.7 1.4ZM18.6 7.6l.7-1.4.7 1.4Z'/><path d='M2.3 17.8h19.4v1.7H2.3z'/></g>", "Australia": "<g fill='currentColor'><path d='M2.8 16.8C3.6 11 6.6 7.8 10.2 6.8 9 10 8.7 13.4 9.2 16.8Z'/><path d='M8.6 16.8c.9-5.4 3.9-8.3 7.4-9.1-1.3 3-1.5 6.2-1 9.1Z' opacity='.85'/><path d='M14.4 16.8c.9-4.3 3.3-6.7 6.6-7.3-1.2 2.4-1.3 4.8-.8 7.3Z' opacity='.7'/><path d='M1.8 16.8h20.4v1.8H1.8z'/></g><path d='M3 21h6.5M12 21h9' fill='none' stroke='currentColor' stroke-width='1.1' stroke-linecap='round' opacity='.7'/>", "Africa": "<g fill='currentColor'><path d='M9 4.5 17 19H1Z'/><path d='M16.6 9.5 23 19H10.2Z' opacity='.6'/><path d='M1 20.2h22v1.2H1z'/></g>", "Middle East": "<g fill='currentColor'><path d='M11.65 .8h.7v3.1h.5v4h.6v4h.8v5h.8v4.4H8.95v-4.4h.8v-5h.8v-4h.6v-4h.5Z'/><path d='M7 21.6h10v.9H7z'/></g>"};

  // service-area sonar: the destination's radar rings move out to the perimeter, so the reach reads as the
  // whole area (cars go well past the metroplex), not just the city centre
  function drawAreaSonar(now, c, vis) {
    var A = areaPoints(c); if (!A.hull || reduced) return false;
    var pts = [], back = false;
    A.hull.forEach(function (ll) { var q = P(ll); if (!q) back = true; else pts.push(q); });
    if (back || pts.length < 3) return false;
    var cx = d3.mean(pts, function (p) { return p[0]; }), cy = d3.mean(pts, function (p) { return p[1]; });
    var line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5)).context(ctx);
    ctx.save(); ctx.lineJoin = "round";
    for (var k = 0; k < 3; k++) {   // three staggered waves: 6s each, 2s apart
      var u = ((now / 6000) + k / 3) % 1, e = d3.easeSinOut(u), s = 1 + 0.16 * e;   // 6s waves, gentle ease (no burst off the edge)
      var ring = pts.map(function (p) { return [cx + (p[0] - cx) * s, cy + (p[1] - cy) * s]; });
      ctx.globalAlpha = vis * 0.8 * (1 - u) * (1 - u);
      ctx.strokeStyle = "rgba(" + C.lit2RGB + ",1)"; ctx.lineWidth = 1.5 - u;
      ctx.beginPath(); line(ring); ctx.stroke();
    }
    // soft glow hugging the perimeter, breathing with the waves
    var b = 0.5 + 0.5 * Math.sin(now / 6000 * Math.PI * 2);
    ctx.globalAlpha = vis * (0.18 + 0.14 * b); ctx.strokeStyle = "rgba(" + C.lit2RGB + ",1)"; ctx.lineWidth = 6; ctx.filter = "blur(4px)";
    ctx.beginPath(); line(pts); ctx.stroke(); ctx.filter = "none";
    ctx.restore();
    return true;
  }
  function drawRoutesAndPulses(now) {
    var sonarOff = function () { if (FX.sonarOn) { FX.sonarOn = false; app.classList.remove("has-area-sonar"); } };
    var c = state.city; if (!c) { FX.arcFor = null; sonarOff(); return; }
    if (FX.arcFor !== c) { FX.arcFor = c; FX.arcT0 = now; }
    var kArea = boxTransform(areaBox(c)).k, vis = clamp01((cur.k / kArea - 0.25) / 0.3); if (vis <= 0) { sonarOff(); return; }
    var sonarOn = drawAreaSonar(now, c, vis);
    if (sonarOn !== FX.sonarOn) { FX.sonarOn = sonarOn; app.classList.toggle("has-area-sonar", sonarOn); }
    var cp = P([c.lon, c.lat]); if (!cp) return;
    // land the lines on the destination light itself (its DOM marker can sit a few px off the raw point)
    var cr = canvas.getBoundingClientRect();
    marks.some(function (m) {
      if (m.ll[0] !== c.lon || m.ll[1] !== c.lat) return false;
      var core = m.el.querySelector(".r-core"); if (!core) return false;
      var r = core.getBoundingClientRect(); if (!r.width) return false;
      cp = [r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top]; return true;
    });
    var mode = window.SVM_CAR_MODE || "lshape";   // chosen Oct 27: airport runs with one sharp corner
    if (mode === "grid" || mode === "route") { ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; drawStreetCars(now, c, vis, mode); ctx.restore(); return; }
    // copper route arcs: each nearby airport draws a line in to the city
    var aps = c.airports.filter(function (a) { return a.lat != null && d3.geoDistance([c.lon, c.lat], [a.lon, a.lat]) < 0.025; }).slice(0, 3)
      .sort(function (a, b) { return d3.geoDistance([c.lon, c.lat], [b.lon, b.lat]) - d3.geoDistance([c.lon, c.lat], [a.lon, a.lat]); })
      .slice(0, 1);   // one car (Oct 28, keep it calm): the longest run among the main airports, so it reads clear of the city marker
    ctx.save(); ctx.lineCap = "round";
    aps.forEach(function (ap, i) {
      var ppt = P([ap.lon, ap.lat]); if (!ppt || Math.hypot(ppt[0] - cp[0], ppt[1] - cp[1]) < 14) return;
      var pts = mode === "lshape" ? lPts(ppt, cp, i, 48) : curvePts(ppt, cp, 0.22, 48);
      var prog = reduced ? 1 : d3.easeCubicInOut(clamp01((now - FX.arcT0 - 400 - i * 600) / 2800)); if (prog <= 0) return;
      var m = Math.max(1, Math.round(pts.length * prog));
      var g = ctx.createLinearGradient(ppt[0], ppt[1], cp[0], cp[1]);
      g.addColorStop(0, "rgba(221,144,88,0.12)"); g.addColorStop(1, "rgba(245,173,89,0.7)");
      ctx.globalAlpha = vis; ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.shadowColor = "rgba(197,97,41,0.8)"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var k = 1; k < m; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
      // a little black car (top view) rides the arc: it leads the line in, then keeps making the run slowly
      var cf = prog < 1 ? prog : (reduced ? 1 : ((now - FX.arcT0 - 400 - i * 600 - 2800) / 1000 / (12 + i * 2.5)) % 1);   // an unhurried run
      var ca = prog < 1 ? 1 : Math.min(1, cf / 0.12, (1 - cf) / 0.12);
      var ci = Math.min(pts.length - 2, Math.round(cf * (pts.length - 1))), q0 = pts[ci], q1 = pts[ci + 1];
      ctx.shadowBlur = 0; ctx.globalAlpha = vis * ca;
      drawCar(q0[0], q0[1], Math.atan2(q1[1] - q0[1], q1[0] - q0[0]));
    });
    ctx.shadowBlur = 0;
    // driver pulses retired (Oct 27): the cars on the route arcs carry the motion now
    if (false) {
      var A = areaPoints(c), towns = A.shown.filter(function (t, i) { return i % 2 === 0; }).slice(0, 14);
      var pv = clamp01((cur.k / kArea - 0.45) / 0.35) * clamp01((now - FX.arcT0 - 1200) / 800);
      if (pv > 0) towns.forEach(function (t, i) {
        var tp = P([t.lon, t.lat]); if (!tp) return;
        var len = Math.hypot(tp[0] - cp[0], tp[1] - cp[1]); if (len < 18) return;
        var pts = curvePts(cp, tp, (i % 2 ? 1 : -1) * 0.08, 40);
        var period = 2.2 + len / 90, ph = ((now / 1000 + i * 0.73) % (period * 2)) / period;   // there and back
        var f = ph < 1 ? d3.easeSinInOut(ph) : d3.easeSinInOut(2 - ph);
        // faint road under the car
        ctx.globalAlpha = 0.10 * pv; ctx.strokeStyle = "#DD9058"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(function (q) { ctx.lineTo(q[0], q[1]); }); ctx.stroke();
        for (var s = 0; s < 6; s++) { // the car and its short tail
          var ff = clamp01(f + (ph < 1 ? -1 : 1) * s * 0.012), q = pts[Math.round(ff * 40)];
          ctx.globalAlpha = pv * (s ? 0.5 * (1 - s / 6) : 1);
          ctx.fillStyle = s ? "#C56129" : "#F5AD59";
          ctx.beginPath(); ctx.arc(q[0], q[1], s ? 1.6 - s * 0.18 : 2.1, 0, 6.2832); ctx.fill();
        }
      });
    }
    ctx.restore();
  }
  function drawIntro(now, gx, gy, R0) {
    if (!FX.introT0) return;
    var u = introU(now); if (u >= 1) return;
    // the sphere surfaces out of the dark
    ctx.globalAlpha = Math.pow(1 - clamp01((u - 0.15) / 0.6), 1.6);
    ctx.fillStyle = "#060607"; ctx.beginPath(); ctx.arc(gx, gy, R0 * 1.25, 0, 6.2832); ctx.fill();
    // gold particles swirl in and settle on the rim
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    FX.parts.forEach(function (p) {
      var t = clamp01((u - p.d) / 0.6), e = d3.easeCubicOut(t);
      var r = R0 * (p.r0 + (1 - p.r0) * e), ang = p.a + p.spin * (1 - e);
      var al = t <= 0 ? 0 : Math.sin(Math.PI * Math.min(1, t * 1.05)) * 0.9 * (1 - clamp01((u - 0.8) / 0.2));
      if (al <= 0) return;
      ctx.globalAlpha = al; ctx.fillStyle = p.sz > 1.6 ? "#F5D3A6" : "#F5AD59";
      ctx.beginPath(); ctx.arc(gx + Math.cos(ang) * r, gy + Math.sin(ang) * r, p.sz, 0, 6.2832); ctx.fill();
    });
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // two little jets circling the globe at world level; on load they spiral in from deep space,
  // and the moment they reach the globe its copper-to-gold halo blooms
  // the same plane glyph the airport chips use (16px grid, nose up)
  var JET_PATH = new Path2D("M9.5 6.2 14 8.6v1.3l-4.5-1.2v2.7l1.3 1v1.1L8.6 13l-2.2.5v-1.1l1.3-1V8.7L3.2 9.9V8.6l4.5-2.4V3.1c0-.6.4-1.1.9-1.1s.9.5.9 1.1v3.1Z");
  // routes are held in the camera's frame (rings around the near face of the globe), so the jets never slip
  // behind the globe and vanish; the land still turns under them
  var JETS = [
    { rho: 56, tilt: 18, lap: 6.5, th0: 30, dir: 1 },
    { rho: 40, tilt: -26, lap: 7.2, th0: 200, dir: -1 }
  ];
  function overLand(ll) {
    return F110.some(function (f) {
      if (!f.wraps && (ll[0] < f.b[0][0] || ll[0] > f.b[1][0] || ll[1] < f.b[0][1] || ll[1] > f.b[1][1])) return false;
      return d3.geoContains(f, ll);
    });
  }
  function jetXY(p, th, alt) {
    var r = p.rho * Math.PI / 180, a = th * Math.PI / 180, t = p.tilt * Math.PI / 180;
    var x = Math.sin(r) * Math.cos(a), y = Math.sin(r) * Math.sin(a), z = Math.cos(r);
    var y2 = y * Math.cos(t) - z * Math.sin(t);           // lean the ring so it reads as a path over the sphere
    return { x: cur.cx + cur.k * alt * x, y: cur.cy - cur.k * alt * y2, vis: true };
  }
  function haloBloom(now) { return FX.bloomT0 ? Math.exp(-Math.max(0, now - FX.bloomT0) / 1100) * clamp01((now - FX.bloomT0) / 160) : 0; }
  function drawJets(now) {
    var fade = clamp01(1.6 - cur.k / kFit()); if (fade <= 0 || (state.level !== "world" && !FX.introT0)) return;
    if (!FX.jetT0) return;
    var u = introU(now), e = d3.easeCubicOut(clamp01(u / 0.8));
    var alt = 1.07 + (FX.introT0 ? 0.75 * (1 - e) : 0);
    if (FX.introT0 && u >= 0.8 && !FX.bloomT0) FX.bloomT0 = now;   // they've reached the world
    ctx.save(); ctx.lineCap = "round";
    JETS.forEach(function (p, i) {
      // one lap per jet; near the end of the lap each one waits until it's over land and then fades down into it
      if (p.runFor !== FX.jetT0) { p.runFor = FX.jetT0; p.endT = 0; }
      var pr = (now - FX.jetT0 - i * 450) / 1000 / p.lap;
      if (pr <= 0) return;
      if (!p.endT && pr >= 0.85) {
        var g = jetXY(p, p.th0 + p.dir * pr * 360, 1), ll = proj.invert([g.x, g.y]);
        if (pr >= 1.7 || (ll && overLand(ll))) p.endT = now;
      }
      var land = p.endT ? clamp01((now - p.endT) / 900) : 0;        // 0 = flying, 1 = touched down
      var drain = p.endT ? clamp01((now - p.endT - 500) / 900) : 0;  // the trail fades after it
      if (drain >= 1) return;
      var head = pr, jetA = Math.min(1, pr / 0.06) * (1 - land);
      var th = p.th0 + p.dir * head * 360;
      var alt2 = alt - 0.07 * d3.easeCubicIn(land);                     // descend onto the surface as it fades
      var prev = null;
      for (var s = 34; s >= 0; s--) { // fading trail
        var back = 1.6 + s * 1.5; if (back > head * 360) { prev = null; continue; }   // no trail before take-off
        var a2 = 1 - s / 34, q = jetXY(p, th - p.dir * back, alt2);
        if (prev) {
          ctx.globalAlpha = fade * a2 * a2 * 0.9 * Math.min(1, pr / 0.06) * (1 - drain);
          ctx.strokeStyle = s < 8 ? "#F5AD59" : "#C56129"; ctx.lineWidth = 0.6 + a2 * 1.4;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
        prev = q;
      }
      var hd = jetXY(p, th, alt2), nx = jetXY(p, th + p.dir, alt2);
      if (land >= 1) return;
      ctx.globalAlpha = fade * jetA;
      var sc = 1.35 * (1 - 0.35 * land);
      ctx.translate(hd.x, hd.y); ctx.rotate(Math.atan2(nx.y - hd.y, nx.x - hd.x) + Math.PI / 2); ctx.scale(sc, sc); ctx.translate(-8.6, -7.8);
      ctx.shadowColor = "rgba(245,173,89,0.9)"; ctx.shadowBlur = 10;
      ctx.fillStyle = "#F7E3C6"; ctx.fill(JET_PATH);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  // city: when someone picks a city, one small plane flies in from the west and lands on it
  function drawCityHop(now) {
    var c = state.city; if (!c || FX.hopCity !== c || !FX.hopT0) return;
    var dur = 3200, u = (now - FX.hopT0) / dur; if (u <= 0 || u > 1.25) return;
    if (!FX.hop || FX.hop.for !== FX.hopT0) {
      var b = [c.lon, c.lat], span = Math.max(1.2, Math.min(9, 240 / cur.k * 180 / Math.PI));   // about 240px of approach on screen
      var a = [b[0] - span, b[1] - span * 0.32];
      FX.hop = { for: FX.hopT0, a: a, b: b, gi: d3.geoInterpolate(a, b) };
    }
    var H = FX.hop, pa = P(H.a), pb = P(H.b); if (!pa || !pb) return;
    var L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), lift = Math.min(90, L * 0.18);
    function at(t) { var q = P(H.gi(t)); return q ? [q[0], q[1] - Math.sin(Math.PI * t) * lift] : null; }
    var head = d3.easeSinInOut(Math.min(1, u)), land = clamp01((u - 0.9) / 0.1), drain = clamp01((u - 1) / 0.25);
    ctx.save(); ctx.lineCap = "round";
    var prev = null, N = 40;
    for (var s = N; s >= 0; s--) { // fading trail behind the plane
      var tt = head - s * 0.012; if (tt < 0) { prev = null; continue; }
      var q = at(tt), a2 = 1 - s / N;
      if (prev && q) { ctx.globalAlpha = a2 * a2 * 0.85 * (1 - drain); ctx.strokeStyle = s < 10 ? "#F5AD59" : "#C56129"; ctx.lineWidth = 0.6 + a2 * 1.4; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      prev = q;
    }
    if (land < 1) {
      var hp = at(head), np = at(Math.min(1, head + 0.01)) || hp, pp = at(Math.max(0, head - 0.01)) || hp;
      var ang = Math.atan2(np[1] - pp[1], np[0] - pp[0]), sc = 1.35 * (1 - 0.35 * land);
      ctx.globalAlpha = Math.min(1, u / 0.06) * (1 - land);
      ctx.translate(hp[0], hp[1]); ctx.rotate(ang + Math.PI / 2); ctx.scale(sc, sc); ctx.translate(-8.6, -7.8);
      ctx.shadowColor = "rgba(245,173,89,0.9)"; ctx.shadowBlur = 10; ctx.fillStyle = "#F7E3C6"; ctx.fill(JET_PATH);
    }
    ctx.restore();
  }

  // network lines: as the globe turns, each continent's hub fires thin copper lines out to its cities
  // (plus one to the next hub), once per visit to the world view
  var HUBS = [
    { region: "North America", ll: [-96.8, 32.78] },   // Dallas, home base
    { region: "South America", ll: [-46.63, -23.55] },
    { region: "Europe", ll: [-0.13, 51.5] },
    { region: "Africa", ll: [28.05, -26.2] },
    { region: "Middle East", ll: [55.27, 25.2] },
    { region: "Asia", ll: [103.8, 1.35] },
    { region: "Australia", ll: [151.2, -33.87] }
  ];
  function hubTargets(h, i) {
    if (h.targets) return h.targets;
    var grid = {}, out = [], rnd = seeded("hub" + i);
    cities.filter(function (c) { return c.region === h.region && d3.geoDistance(h.ll, [c.lon, c.lat]) > 0.02; })
      .sort(function (a, b) { return d3.geoDistance(h.ll, [b.lon, b.lat]) - d3.geoDistance(h.ll, [a.lon, a.lat]); })
      .forEach(function (c) { var k = Math.round(c.lon / 4) + ":" + Math.round(c.lat / 4); if (!grid[k]) { grid[k] = 1; out.push([c.lon, c.lat]); } });
    out = out.slice(0, 22);
    var next = HUBS[(i + 1) % HUBS.length].ll; out.push(next);                 // stitch the continents together
    h.targets = out.map(function (ll) { return { ll: ll, delay: rnd() * 600, d: d3.geoDistance(h.ll, ll), gi: d3.geoInterpolate(h.ll, ll) }; });
    return h.targets;
  }
  function lift3(ll, alt) { // screen point above the surface (and whether it's on the near side)
    var q = d3.geoRotation([-cur.lon, -cur.lat])(ll), l = q[0] * Math.PI / 180, ph = q[1] * Math.PI / 180;
    var x = Math.cos(ph) * Math.sin(l), y = Math.sin(ph), z = Math.cos(ph) * Math.cos(l);
    return [cur.cx + cur.k * alt * x, cur.cy - cur.k * alt * y, z > 0 || (x * x + y * y) * alt * alt > 1];
  }
  function startNetwork(delay) { FX.netT0 = performance.now() + (delay || 0); FX.netWall = Date.now(); }
  // intro network: random city-to-city routes across the world (no single hub), e.g. Paris to New York,
  // Berlin to Mexico City; only routes whose ends face the viewer when the intro settles
  var NET_PAIRS = [["paris-france", "new-york-city-ny"], ["berlin-germany", "mexico-city-mexico"], ["london-united-kingdom", "dubai-united-arab-emirates"],
    ["tokyo-japan", "los-angeles-ca"], ["sao-paulo-brazil", "miami-fl"], ["toronto-canada", "london-united-kingdom"], ["rome-italy", "chicago-il"],
    ["singapore-singapore", "sydney-australia"], ["madrid-spain", "bogota-colombia"], ["black-car-service-zurich-switzerland", "boston-ma"], ["dubai-united-arab-emirates", "singapore-singapore"],
    ["san-francisco-ca", "vancouver-canada"], ["cancun-mexico", "dallas-fort-worth-tx"], ["amsterdam-netherlands", "washington-d-c"], ["madrid-spain", "miami-fl"]];
  function netTargets() {
    if (FX.net) return FX.net;
    var view = [homeLon(), 22], rnd = seeded("net-routes"), out = [], used = {};
    var facing = function (c) { return c && d3.geoDistance(view, [c.lon, c.lat]) < 1.45; };
    function add(a, b) {
      if (!a || !b || a === b) return;
      var k = a.slug < b.slug ? a.slug + "|" + b.slug : b.slug + "|" + a.slug; if (used[k]) return;
      var A = [a.lon, a.lat], B = [b.lon, b.lat], d = d3.geoDistance(A, B); if (d < 0.12) return;   // skip short hops
      used[k] = 1; out.push({ a: A, b: B, d: d, gi: d3.geoInterpolate(A, B), delay: rnd() * 700 });
    }
    NET_PAIRS.forEach(function (p) { var a = bySlug[p[0]], b = bySlug[p[1]]; if (facing(a) && facing(b)) add(a, b); });
    var pool = cities.filter(facing);
    for (var n = 0; n < 400 && out.length < 26 && pool.length > 1; n++) {   // fill with random long routes between different regions
      var a = pool[Math.floor(rnd() * pool.length)], b = pool[Math.floor(rnd() * pool.length)];
      if (a.region !== b.region || d3.geoDistance([a.lon, a.lat], [b.lon, b.lat]) > 0.5) add(a, b);
    }
    return (FX.net = out);
  }
  // intro only: hairlines draw from A to B with a dot running along each, then it all fades.
  // Any touch of the globe ends it at once; it never replays.
  function drawIntroNetwork(now) {
    if (!FX.netT0 || now < FX.netT0) return;
    if (state.level !== "world") { FX.netT0 = 0; return; }   // drag, wheel or pinch clears FX.netT0 directly
    var el = now - FX.netT0; if (el > 3800) { FX.netT0 = 0; return; }
    var end = 1 - clamp01((el - 2900) / 900);
    ctx.save(); ctx.lineCap = "round";
    netTargets().forEach(function (tg) {
      var t = el - tg.delay; if (t <= 0) return;
      var draw = d3.easeCubicOut(clamp01(t / (380 + tg.d * 160)));             // the line draws out from A
      var travel = d3.easeSinInOut(clamp01((t - 250) / (900 + tg.d * 300)));    // the dot runs A to B along it
      var lift = 0.02 + tg.d * 0.07, N = 32, prev = null;
      var a0 = lift3(tg.a, 1); if (a0[2]) { ctx.globalAlpha = end * 0.9; ctx.fillStyle = "#F5D3A6"; ctx.beginPath(); ctx.arc(a0[0], a0[1], 1.4, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 0.55 * end; ctx.strokeStyle = "#DD9058"; ctx.lineWidth = 1; ctx.beginPath();
      for (var k = 0; k <= N; k++) {
        var u = draw * k / N, p = lift3(tg.gi(u), 1 + Math.sin(Math.PI * u) * lift);
        if (p[2]) { if (prev && prev[2]) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
        prev = p;
      }
      ctx.stroke();
      if (travel > 0) {
        var dp = lift3(tg.gi(travel), 1 + Math.sin(Math.PI * travel) * lift);
        if (dp[2]) { ctx.globalAlpha = end; ctx.fillStyle = "#F5D3A6"; ctx.beginPath(); ctx.arc(dp[0], dp[1], 1.7, 0, 6.2832); ctx.fill(); }
      }
    });
    ctx.restore();
  }
  // the overlay pass: clears and redraws only the moving pieces
  function fxDraw() {
    var now = performance.now(), c = state.city;
    var hopOn = c && FX.hopCity === c && now - FX.hopT0 < 4200;
    var carsOn = c && cur.k > kFit() * 2 && cur.k / boxTransform(areaBox(c)).k > 0.25;
    var netOn = !!FX.netT0;
    if (!carsOn && FX.sonarOn) { FX.sonarOn = false; app.classList.remove("has-area-sonar"); }
    var live = hopOn || carsOn || netOn;
    if (!live && !fxDirty) return;
    var main = ctx; ctx = fxctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (live) { syncProj(); if (c) drawRoutesAndPulses(now); drawIntroNetwork(now); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx = main;
    fxDirty = !!live;
  }
  // keeps frames coming while something is alive on screen (twinkle, pulses, arcs, intro)
  function ambient() {
    var lastFx = 0;
    d3.timer(function (t) {
      if (document.hidden || !onScreen) return;
      if (FX.introT0 && !reduced) schedule();
      if (t - lastFx > 33) { lastFx = t; fxDraw(); }
    });
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    syncProj();
    var vb = visibleBounds();
    var F = cur.k > 900 ? F50 : F110;

    // the globe: atmosphere glow, sea with a soft light from the upper left (no lat/long grid, Oct 27 feedback)
    var gx = cur.cx, gy = cur.cy, R0 = cur.k, now = performance.now();
    drawStars(now, gx, gy, R0);
    if (R0 < Math.hypot(W, H) * 1.5) {
      // the brand gradient halo (copper into gold); it blooms when the jets arrive on load
      var bl = haloBloom(now), ha = 0.22 * (1 + 1.3 * bl), hr = 1.22 + 0.06 * bl;
      var halo = ctx.createRadialGradient(gx, gy, R0 * 0.96, gx, gy, R0 * hr);
      halo.addColorStop(0, "rgba(197,97,41," + Math.min(1, ha) + ")");
      halo.addColorStop(0.4, "rgba(245,173,89," + Math.min(1, ha * 0.55) + ")");
      halo.addColorStop(1, "rgba(245,173,89,0)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(gx, gy, R0 * hr, 0, 6.2832); ctx.fill();
    }
    var sea = ctx.createRadialGradient(gx - R0 * 0.35, gy - R0 * 0.4, R0 * 0.05, gx, gy, R0);
    sea.addColorStop(0, C.seaHi); sea.addColorStop(1, C.seaLo);
    ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = sea; ctx.fill();

    shapes = new Map(); shapeView = vb;
    var groups = {};
    var vis = [];
    F.forEach(function (f) {
      if (!isVisible(f, vb)) return;
      vis.push(f);
      var col = landColor(f);
      (groups[col] = groups[col] || []).push(f);
    });
    Object.keys(groups).forEach(function (col) {
      ctx.fillStyle = col; ctx.fill(shapeOf(groups[col]));
    });
    // continent hover: light green wash that eases in
    Object.keys(regFade).forEach(function (rn) {
      var t = regFade[rn]; if (!t) return;
      var e = t * t;                       // ease-in
      var rf = vis.filter(function (f) { return f.reg === rn; }); if (!rf.length) return;
      var bb = path.bounds({ type: "FeatureCollection", features: rf });
      // brand gold gradient (copper to gold, 135deg) at the same see-through strength the green wash had
      var gg = ctx.createLinearGradient(bb[0][0], bb[0][1], bb[1][0], bb[1][1]);
      gg.addColorStop(0, C.hoverA); gg.addColorStop(1, C.hoverB);
      ctx.globalAlpha = C.mintA * e; ctx.fillStyle = gg; ctx.fill(shapeOf(rf)); ctx.globalAlpha = 1;
    });
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.9; ctx.stroke(shapeOf(vis));

    // faint edge on every country Savoya serves, so the tint reads against the water
    ctx.strokeStyle = C.servedEdge; ctx.lineWidth = 0.8; ctx.stroke(shapeOf(vis.filter(function (f) { return f.svc; })));
    // gold edge on the focused country
    if (state.country) {
      var fc = F.filter(function (f) { return f.svc === state.country; });
      ctx.strokeStyle = C.focus; ctx.lineWidth = 1.2; ctx.stroke(shapeOf(fc.filter(function (f) { return vis.indexOf(f) >= 0; })));
    }
    // state lines once the US is close
    if (cur.k > 500 && d3.geoDistance([cur.lon, cur.lat], [-97, 38]) < 0.75) {
      ctx.beginPath(); path(usStates);
      ctx.strokeStyle = C.states; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // service area: a soft outline around the city and every surrounding town we can place
    nearDrawn = [];
    if (state.city && areaPoints(state.city).hull) {
      var ca = state.city, A = areaPoints(ca), hp = [], back = false;
      A.hull.forEach(function (ll) { var q = P(ll); if (!q) back = true; else hp.push(q); });
      if (!back && hp.length >= 3) {
        var line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5)).context(ctx);
        ctx.beginPath(); line(hp);
        ctx.fillStyle = "rgba(" + C.litRGB + ",0.05)"; ctx.fill();
        ctx.setLineDash([2, 5]); ctx.strokeStyle = C.areaEdge; ctx.lineWidth = 1.1; ctx.stroke(); ctx.setLineDash([]);
      }
      // surrounding towns: faint white points once the camera is in close
      var kArea = boxTransform(areaBox(ca)).k, show = Math.max(0, Math.min(1, (cur.k / kArea - 0.45) / 0.35));
      if (show > 0) {
        ctx.globalAlpha = show;
        A.shown.forEach(function (t) {
          var q = P([t.lon, t.lat]); if (!q || q[0] < -6 || q[0] > W + 6 || q[1] < -6 || q[1] > H + 6) return;
          ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, 6.2832);
          ctx.fillStyle = C.nearDot; ctx.fill();
          if (C.nearEdge) { ctx.lineWidth = 0.8; ctx.strokeStyle = C.nearEdge; ctx.stroke(); }
          nearDrawn.push({ x: q[0], y: q[1], t: t });
        });
        // town names: tiny uppercase, to the right of each dot; skip any that would overlap
        ctx.font = "8px Silkscreen, " + getComputedStyle(app).fontFamily; ctx.textBaseline = "middle"; ctx.textAlign = "left";
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0.9px";
        var boxes = [], cr = canvas.getBoundingClientRect(), mk = document.getElementById("markers");
        if (mk) Array.prototype.forEach.call(mk.children, function (m) { // keep clear of airport chips, the radar and the city name
          if (m.hidden) return;
          var cn = m.querySelector(".cn-in");
          (cn ? [cn] : [m].concat(Array.prototype.slice.call(m.querySelectorAll("*")))).forEach(function (e) {
            var r = e.getBoundingClientRect();
            if (r.width > 1 && r.height > 1 && r.width < 400) boxes.push([r.left - cr.left - 3, r.top - cr.top - 3, r.right - cr.left + 3, r.bottom - cr.top + 3]);
          });
        });
        var dots = nearDrawn.map(function (d) { return [d.x - 2.5, d.y - 2.5, d.x + 2.5, d.y + 2.5, d]; });
        nearDrawn.forEach(function (d) {
          var s = d.t.name.toUpperCase(), w = ctx.measureText(s).width;
          var hit = function (b) {
            if (b[0] < 4 || b[2] > W - 4) return true;
            for (var i = 0; i < boxes.length; i++) { var o = boxes[i]; if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return true; }
            for (i = 0; i < dots.length; i++) { o = dots[i]; if (o[4] !== d && b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return true; }
            return false;
          };
          var tx = d.x + 7, b = [d.x + 5, d.y - 6, d.x + 9 + w, d.y + 6];
          if (hit(b)) { tx = d.x - 7 - w; b = [d.x - 9 - w, d.y - 6, d.x - 5, d.y + 6]; if (hit(b)) return; } // right first, else left
          boxes.push(b);
          if (C.nearHalo) { ctx.lineJoin = "round"; ctx.lineWidth = 2; ctx.strokeStyle = C.nearHalo; ctx.strokeText(s, tx, d.y + 0.5); }
          ctx.fillStyle = C.nearText; ctx.fillText(s, tx, d.y + 0.5);
        });
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
        ctx.globalAlpha = 1;
        // chips are positioned after the canvas paints, so settle the names with one more pass once the camera rests
        var sig = [cur.lon, cur.lat, cur.k, W].map(function (v) { return v.toFixed(4); }).join();
        if (sig !== labelSig) { labelSig = sig; clearTimeout(labelT); labelT = setTimeout(schedule, 140); }
      }
      var nTot = (ca.nearby || []).length;
      if (show > 0 && nTot && !back && hp.length >= 3) {
        var by = d3.max(hp, function (p) { return p[1]; }), bx = (d3.min(hp, function (p) { return p[0]; }) + d3.max(hp, function (p) { return p[0]; })) / 2;
        pillAt(ca, nTot, bx, Math.min(by + 16, H - 70), show);
      } else pillAt(null);
    } else pillAt(null);
    // service ring around the destination (only where we have no towns to outline)
    if (state.city && !areaPoints(state.city).hull) {
      var c = state.city, circle = d3.geoCircle().center([c.lon, c.lat]).radius(cityRadius(c)).precision(2)();
      ctx.beginPath(); path(circle);
      var cpt = P([c.lon, c.lat]) || [gx, gy];
      var g = ctx.createRadialGradient(cpt[0], cpt[1], 0, cpt[0], cpt[1], Math.max(40, cur.k * cityRadius(c) * Math.PI / 180 * 1.2));
      g.addColorStop(0, "rgba(" + C.litRGB + ",0.10)"); g.addColorStop(1, "rgba(" + C.litRGB + ",0.02)");
      ctx.fillStyle = g; ctx.fill();
      ctx.setLineDash([3, 5]); ctx.strokeStyle = C.ring; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    }
    // shade toward the edge of the globe so it reads as a sphere
    if (R0 < Math.hypot(W, H) * 1.5) {
      var limb = ctx.createRadialGradient(gx, gy, R0 * 0.55, gx, gy, R0);
      limb.addColorStop(0, "rgba(" + C.limbRGB + ",0)"); limb.addColorStop(1, "rgba(" + C.limbRGB + "," + C.limbA + ")");
      ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = limb; ctx.fill();
    }
    drawNightLights();
    // every served city as a faint point (live markers sit on top where they apply)
    ctx.fillStyle = C.dot; ctx.beginPath();
    var dr = state.level === "world" ? 1.6 : 2.1;
    cities.forEach(function (c) {
      if (domCities[c.slug]) return;
      var p = P([c.lon, c.lat]);
      if (!p || p[0] < -10 || p[0] > W + 10 || p[1] < -10 || p[1] > H + 10) return;
      ctx.moveTo(p[0] + dr, p[1]); ctx.arc(p[0], p[1], dr, 0, 6.2832);
    });
    ctx.fill();
    drawIntro(now, gx, gy, R0);
    // planes retired (Oct 27, keep it clean and light): drawJets / drawCountryHop are no longer called
  }

  /* ================= Framing ================= */
  var mqPhone = window.matchMedia("(max-width: 860px)");
  var vrMemo = null;
  function viewRect(forDock) { // inside a frame the panels can't move, so measure them once and reuse it
    if (!vrMemo) return viewRectNow(forDock);
    var i = forDock ? 1 : 0;
    return vrMemo[i] || (vrMemo[i] = viewRectNow(forDock));
  }
  function viewRectNow(forDock) {
    var topbar = document.querySelector(".topbar"), browse = document.getElementById("browse"), sheet = document.getElementById("sheet");
    var open = app.classList.contains("sheet-open");
    if (mqPhone.matches) {
      var top = topbar.getBoundingClientRect().bottom + 16;
      var bottom = open ? sheet.offsetHeight + 20 : browse.offsetHeight + 20;
      var rp = { x: 16, y: top, w: Math.max(80, W - 32), h: Math.max(80, H - top - bottom) };
      return forDock ? rp : reserve(rp);
    }
    var left = leftPanel.getBoundingClientRect().right + 32;
    var right = (open ? sheet.offsetWidth : 0) + 72;
    var rd = { x: left, y: 32, w: Math.max(120, W - left - right), h: Math.max(120, H - 64) };
    return forDock ? rd : reserve(rd);
  }
  function reserve(r) { // the city card now floats over the city, so no space is held back
    return r;
    var dh = (document.getElementById("dock").offsetHeight || 120) + 24;
    return { x: r.x, y: r.y, w: r.w, h: Math.max(80, r.h - dh) };
  }
  var WORLD_VIEW = { lon: -30, lat: 24 };
  function boxTransform(box) { // camera that frames a lon/lat box on the globe
    var r = viewRect(), fit = kFit();
    if (box === WORLD_BOX) return { lon: WORLD_VIEW.lon, lat: WORLD_VIEW.lat, k: fit, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
    var w = box[0][0], s = box[0][1], e = box[1][0], n = box[1][1];
    var lat = (s + n) / 2, lon = (w + e) / 2, rad = Math.PI / 180;
    var dLon = Math.max(0.004, (e - w) * rad * Math.cos(lat * rad)), dLat = Math.max(0.004, (n - s) * rad);
    var k = Math.max(fit, Math.min(r.w / dLon, r.h / dLat, K_MAX));
    return { lon: lon, lat: lat, k: k, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
  }
  function flyTo(t, dur, done, my) { // arc between places: pull back to see the globe, swing over, settle in
    stopAnim();
    var a = { lon: cur.lon, lat: cur.lat, k: cur.k, cx: cur.cx, cy: cur.cy };
    var gi = d3.geoInterpolate([a.lon, a.lat], [t.lon, t.lat]), dist = d3.geoDistance([a.lon, a.lat], [t.lon, t.lat]);
    var lk0 = Math.log(a.k), lk1 = Math.log(t.k), fit = kFit();
    var lift = Math.min(1, dist / 1.2);                     // how far we pull back mid-flight
    var lkMid = Math.log(fit * 1.05);
    anim = d3.timer(function (el) {
      var u = Math.min(1, el / dur), e = d3.easeCubicInOut(u);
      var c = gi(e); cur.lon = c[0]; cur.lat = c[1];
      var lk = lk0 + (lk1 - lk0) * e;
      var bump = Math.sin(Math.PI * u) * lift;
      cur.k = Math.exp(lk + (Math.min(lk, lkMid) - lk) * bump);
      cur.cx = a.cx + (t.cx - a.cx) * e; cur.cy = a.cy + (t.cy - a.cy) * e;
      schedule();
      if (u >= 1) { anim.stop(); anim = null; if (my === flyToken && done) done(); }
    });
  }
  function flyDuration(t) {
    var dist = d3.geoDistance([cur.lon, cur.lat], [t.lon, t.lat]), dz = Math.abs(Math.log(t.k / cur.k));
    return Math.max(650, Math.min(2600, 500 + dist * 900 + dz * 260));
  }
  var flyToken = 0;
  function inView(ll) {
    var p = P(ll), r = viewRect();
    return p && p[0] > r.x + 24 && p[0] < r.x + r.w - 24 && p[1] > r.y + 24 && p[1] < r.y + r.h - 24;
  }
  function fly(box, done, fast, instant) {
    var t = boxTransform(box), my = ++flyToken;
    stopAnim();
    if (reduced || instant || !W) { cur.lon = t.lon; cur.lat = t.lat; cur.k = t.k; cur.cx = t.cx; cur.cy = t.cy; schedule(); if (done) done(); return; }
    flyTo(t, fast ? 600 : flyDuration(t), done, my);
  }

  /* ================= State ================= */
  var state = { level: "world", region: null, country: null, city: null, airport: null, via: null };
  var live = document.getElementById("live");
  function say(s) { live.textContent = s; }

  function goWorld() {
    closeSheet(true);
    state = { level: "world", region: null, country: null, city: null, airport: null, via: null };
    render(); setHash();
    fly(WORLD_BOX);
    say("Showing all regions");
  }
  function goRegion(name) {
    closeSheet(true);
    state = { level: "region", region: name, country: null, city: null, airport: null, via: null };
    render(); setHash();
    fly(REG[name].box);
    say("Showing " + name + ", " + regionByName[name].countries.length + " countries");
  }
  function goCountry(name) {
    closeSheet(true);
    state = { level: "country", region: countries[name].region, country: name, city: null, airport: null, via: null };
    render(); setHash();
    fly(countryBox(name));
    say("Showing " + name + ", " + countries[name].cities.length + " service areas");
  }
  function goCity(c, opts) {
    opts = opts || {};
    var same = state.city === c, prevCountry = state.country, prevLevel = state.level;
    state = { level: "city", region: c.region, country: c.country, city: c, airport: opts.airport || null, via: opts.via || null };
    if (!opts.keepSheet) closeSheet(true);
    render(!same);
    setHash();
    var a = state.airport;
    var pt = a && a.lat != null ? [a.lon, a.lat] : [c.lon, c.lat];
    var sheetWasOpen = app.classList.contains("sheet-open");
    if (opts.openSheet) openSheet(true);
    var arrive = function () { popDest(); };
    if (opts.openSheet && !(same && sheetWasOpen)) { fly(areaBox(c), arrive, false, opts.instant); }
    else if (!opts.instant && prevCountry === c.country && (prevLevel === "country" || prevLevel === "city") && inView(pt)) {
      sel.interrupt(); setTimeout(arrive, 30);   // already framed: no camera move at all
    } else fly(cityFrame(c), arrive, false, opts.instant);
    say(a ? a.code + ", " + a.name + ", served from " + c.label : "Showing " + c.label);
  }
  function up() {
    if (app.classList.contains("sheet-open")) return closeSheet();
    if (state.level === "city" && state.airport) return goCity(state.city);
    if (state.level === "city") return goCountry(state.country);
    if (state.level === "country") return goRegion(state.region);
    if (state.level === "region") return goWorld();
  }
  function slugify(s) { return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function tokenFor() {
    var s = state, t = "";
    if (s.level === "region") t = "region-" + slugify(s.region);
    else if (s.level === "country") t = slugify(s.country);
    else if (s.level === "city") {
      t = s.city.slug + (s.airport ? "." + s.airport.code.toLowerCase() : "");
      if (app.classList.contains("sheet-open")) t += ".details";
    }
    return t;
  }
  var applying = false;
  function syncHash() {
    var t = tokenFor(), now = (location.hash || "").replace(/^#/, "");
    if (t === now) return;
    var url = t ? "#" + t : location.pathname + location.search;
    try { if (applying) history.replaceState(null, "", url); else history.pushState(null, "", url); } catch (e) { /* frame may refuse */ }
  }
  function setHash() { syncHash(); }
  function applyToken(tok, instant) {
    tok = (tok || "").replace(/^#/, "").toLowerCase();
    if (tok === tokenFor()) return true;
    applying = true;
    var ok = true;
    try {
      if (!tok) goWorld();
      else if (tok.indexOf("region-") === 0) {
        var rn = regionOrder.filter(function (r) { return slugify(r.name) === tok.slice(7); })[0];
        if (rn) goRegion(rn.name); else ok = false;
      } else {
        var parts = tok.split("."), details = parts[parts.length - 1] === "details";
        if (details) parts.pop();
        var c = bySlug[parts[0]];
        var k = Object.keys(countries).filter(function (n) { return slugify(n) === parts[0]; })[0];
        if (c) {
          var ap = parts[1] ? c.airports.filter(function (a) { return a.code.toLowerCase() === parts[1]; })[0] : null;
          goCity(c, { airport: ap || null, openSheet: details, instant: instant });
        } else if (k) goCountry(k);
        else ok = false;
      }
    } finally { applying = false; }
    return ok;
  }
  window.addEventListener("popstate", function () { applyToken(location.hash); });
  window.addEventListener("hashchange", function () { applyToken(location.hash); });
  var LINK_BASE = /(^|\.)savoya\.com$/.test(location.hostname) ? location.origin + location.pathname : SITE + "/service-areas";
  function linkFor() { var t = tokenFor(); return LINK_BASE + (t ? "#" + t : ""); }
  function copyLink(btn, forced) {
    var url = forced || linkFor(), label = btn.querySelector("span");
    var done = function (txt) { label.textContent = txt; setTimeout(function () { label.textContent = "Copy link"; }, 1800); };
    try {
      navigator.clipboard.writeText(url).then(function () { done("Link copied"); }, function () { fallback(); });
    } catch (e) { fallback(); }
    function fallback() {
      var box = btn.parentNode.querySelector(".linkbox");
      if (!box) { box = el("input", "linkbox"); box.readOnly = true; box.setAttribute("aria-label", "Link to this view"); btn.parentNode.appendChild(box); }
      box.value = url; box.focus(); box.select(); done("Select and copy");
    }
  }
  var LINK_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.1-2.1a3 3 0 0 0-4.2-4.2l-.9.9"/><path d="M9.5 6.5a3 3 0 0 0-4.2 0L3.2 8.6a3 3 0 0 0 4.2 4.2l.9-.9"/></svg>';

  /* ================= Markers ================= */
  var marks = [], domCities = {};
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); }
  function addMark(node, lonlat, z) {
    var m = el("div", "mk mk-enter"); m.appendChild(node);
    m.addEventListener("animationend", function () { schedule(); }, { once: true });   // re-place town names once chips settle
    if (z) m.style.zIndex = z;
    markersEl.appendChild(m);
    marks.push({ el: m, ll: lonlat });
    return m;
  }
  function radar(c, cls) {
    var b = el("button", "radar " + (cls || ""), '<span class="r-ring"></span><span class="r-ring"></span><span class="r-flash"></span><span class="r-core"></span><span class="r-label">' + esc(c.label) + "</span>");
    b.type = "button"; b.setAttribute("aria-label", c.label);
    return b;
  }
  var PLANE = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9.5 6.2 14 8.6v1.3l-4.5-1.2v2.7l1.3 1v1.1L8.6 13l-2.2.5v-1.1l1.3-1V8.7L3.2 9.9V8.6l4.5-2.4V3.1c0-.6.4-1.1.9-1.1s.9.5.9 1.1v3.1Z"/></svg>';
  var destEl = null, dock = document.getElementById("dock");
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hoverCard = document.getElementById("hovercard"), hoverCity = null, hoverT = 0;
  // Place a card beside the dot it belongs to, measured from the dot on screen,
  // and keep it inside the open part of the map (clear of the left panel and the details pane).
  function anchor(card, dotEl) {
    if (card.hidden || !dotEl || !dotEl.isConnected) return;
    var cw = card.offsetWidth, ch = card.offsetHeight;
    if (!cw) return;                                   // hidden by CSS right now; placed again when shown
    var ar = app.getBoundingClientRect(), dr = dotEl.getBoundingClientRect();
    var px = dr.left + dr.width / 2 - ar.left, py = dr.top + dr.height / 2 - ar.top;
    var offMap = px < 0 || py < 0 || px > ar.width || py > ar.height || (dotEl.closest(".mk") && dotEl.closest(".mk").hasAttribute("data-off"));
    card.style.visibility = offMap ? "hidden" : "";
    if (offMap) return;
    var minX = 8, maxX = ar.width - 8;
    if (!mqPhone.matches) {
      var lp = leftPanel.getBoundingClientRect();
      if (py > lp.top - ar.top && py < lp.bottom - ar.top + 40) minX = lp.right - ar.left + 8;
      if (app.classList.contains("sheet-open")) maxX = sheet.getBoundingClientRect().left - ar.left - 8;
    }
    var gap = 22, side;
    if (px + gap + cw <= maxX) side = "right";
    else if (px - gap - cw >= minX) side = "left";
    else side = "below";
    card.classList.toggle("side-left", side === "left");
    card.classList.toggle("side-below", side === "below");
    var y = side === "below" ? py : Math.max(ch / 2 + 8, Math.min(ar.height - ch / 2 - 8, py));
    var x = px;
    if (side === "below") x = Math.max(minX + cw / 2, Math.min(maxX - cw / 2, px));
    card.style.setProperty("--ay", Math.max(-ch / 2 + 12, Math.min(ch / 2 - 12, py - y)) + "px");
    card.style.setProperty("--ax", (px - x) + "px");
    card.style.left = x + "px";
    card.style.top = y + "px";
  }
  function destLL() { var s = state; return s.airport && s.airport.lat != null ? [s.airport.lon, s.airport.lat] : [s.city.lon, s.city.lat]; }
  function placeDock() {
    if (state.level === "city") anchor(dock, destEl);
    if (hoverCity) { cityClose(hoverCard, hoverCity); anchor(hoverCard, hoverEl); }
  }
  // Airport pills for a city card: first three airports (or the chosen one), then "+N".
  function addPills(co, c, chosen, onPick, onMore) {
    co.insertBefore(makePills(c, chosen, onPick, onMore), co.querySelector(".c-meta"));
  }
  function makePills(c, chosen, onPick, onMore) {
    var top3 = c.airports.slice(0, 3);
    if (chosen && top3.indexOf(chosen) < 0) top3 = top3.slice(0, 2).concat([chosen]);
    var more = c.airports.length - top3.length;
    var box = el("div", "c-aps");
    box.setAttribute("role", "group"); box.setAttribute("aria-label", c.name + " airports");
    top3.forEach(function (a) {
      var b = el("button", "ap-chip" + (chosen === a ? " is-on" : ""), "<i>" + PLANE + "</i><span>" + esc(a.code) + "</span>");
      b.type = "button"; b.title = a.name; b.setAttribute("aria-label", a.code + ", " + a.name);
      b.addEventListener("click", function () { onPick(a); });
      box.appendChild(b);
    });
    if (more > 0) {
      var mb = el("button", "ap-chip ap-more", "+" + more);
      mb.type = "button"; mb.setAttribute("aria-label", "See all " + c.airports.length + " airports");
      mb.addEventListener("click", onMore);
      box.appendChild(mb);
    }
    return box;
  }
  // At city zoom the airports are on the map itself, so the card drops its pills.
  function cityClose(card, c) {
    if (!c) return;
    var px = cur.k * cityRadius(c) * Math.PI / 180;
    card.classList.toggle("is-close", px > 110);
  }
  // City photo from the CMS thumbnail, stored at 288px so it stays sharp at 3x for every size used here (48 to 96px).
  var THUMBS = window.SVC_THUMBS || {};
  function thumbImg(c, size, cls) {
    var src = THUMBS[c.slug];
    return src ? '<img class="' + cls + '" src="' + src + '" width="' + size + '" height="' + size + '" alt="" decoding="async">' : '';
  }
  // Surrounding-cities line: city icon + the words fading in letter by letter, left to right
  var CITY_ICON = '<svg class="c-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M1.5 14.5h13M3 14.5V7.5l4-2v9M7 14.5V2.5l5.5 2.2v9.8M9.2 6.6h1.6M9.2 8.8h1.6M9.2 11h1.6M4.6 9.2h.8M4.6 11.4h.8"/></svg>';
  function metaHtml(html, cls, animate) {
    var t = document.createElement("div"); t.innerHTML = html;
    var txt = t.textContent, body;
    if (animate && !reduced) {
      body = '<span class="c-chars" aria-label="' + esc(txt) + '">' + Array.prototype.map.call(txt, function (ch, i) {
        return '<span aria-hidden="true" style="--i:' + i + '">' + (ch === " " ? "&nbsp;" : esc(ch)) + "</span>";
      }).join("") + "</span>";
    } else body = "<span>" + esc(txt) + "</span>";
    return '<div class="c-meta' + (cls ? " " + cls : "") + '">' + CITY_ICON + body + "</div>";
  }
  function cardHtml(name, meta, cta, metaClose, c) {
    return '<button class="c-x" type="button" aria-label="Close"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3l8 8M11 3 3 11"/></svg></button><div class="c-head">' + (c ? thumbImg(c, 48, "c-thumb") : '') + '<div class="c-name">' + esc(name) + '</div></div>' + metaHtml(meta, "", true) +
      (metaClose ? metaHtml(metaClose, "c-meta-close", false) : '') + '<button class="c-go" type="button">' + cta +
      '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"/></svg></button>' +
      '<button class="copy" type="button" aria-label="Copy a link to this city">' + LINK_ICON + "<span>Copy link</span></button>";
  }
  var hoverEl = null, apRow = null, cityName = null;
  // Where dots overlap (Baltimore / Washington, Miami / Boca Raton), the one nearest the pointer wins.
  function nearestDot(x, y) {
    var best = null, bd = 18 * 18;
    markersEl.querySelectorAll(".radar:not(.is-dest)").forEach(function (el) {
      if (!el._city || el.parentNode.classList.contains("is-out")) return;
      var r = el.getBoundingClientRect(), dx = r.left - x, dy = r.top - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = el; }
    });
    return best;
  }
  function showHover(c, dotEl) {
    hoverEl = dotEl;
    clearTimeout(hoverT);
    if (app.classList.contains("sheet-open") && state.city === c) return;
    hoverCity = c;
    var co = el("div", "callout is-hover");
    co.innerHTML = cardHtml(c.label, c.nearby.length + " surrounding cities", "View service details",
      c.airports.length + " airports and FBOs · " + c.nearby.length + " surrounding cities", c);
    addPills(co, c, null, function (a) { hideHover(); goCity(c, { airport: a, openSheet: true }); },
      function () { hideHover(); goCity(c, { openSheet: true }); });
    co.querySelector(".c-go").addEventListener("click", function () { hideHover(); goCity(c, { openSheet: true }); });
    co.querySelector(".c-x").addEventListener("click", function () { hideHover(); });
    var cp = co.querySelector(".copy");
    cp.addEventListener("click", function () { copyLink(cp, LINK_BASE + "#" + c.slug); });
    hoverCard.textContent = ""; hoverCard.appendChild(co); hoverCard.hidden = false;
    anchor(hoverCard, hoverEl);
  }
  function hideHover(delayed) {
    clearTimeout(hoverT);
    var go = function () { hoverCard.hidden = true; hoverCard.textContent = ""; hoverCity = null; };
    if (delayed) hoverT = setTimeout(go, 380); else go();
  }
  hoverCard.addEventListener("mouseover", function () { clearTimeout(hoverT); });
  hoverCard.addEventListener("mouseout", function (e) { if (!hoverCard.contains(e.relatedTarget)) hideHover(true); });

  // country level: as the globe is dragged, cities of whatever other country comes into view pop in as
  // live markers, and fade back out when their country leaves the view
  var roam = {}, ROAM_MAX = 36;
  function roamRadar(c) {
    var r = radar(c, ""); r._city = c;
    r.addEventListener("click", function (e) { var n = nearestDot(e.clientX, e.clientY) || r; hideHover(); goCity(n._city, { openSheet: true }); });
    if (canHover) {
      r.addEventListener("mousemove", function (e) { var n = nearestDot(e.clientX, e.clientY) || r; if (hoverCity !== n._city) showHover(n._city, n); else clearTimeout(hoverT); });
      r.addEventListener("mouseleave", function () { hideHover(true); });
    }
    return r;
  }
  function updateRoam() {
    var s = state;
    if (s.level !== "country" && s.level !== "city") return;
    var vr = viewRect(), cx = vr.x + vr.w / 2, cy = vr.y + vr.h / 2, pad = 24, want = [];
    cities.forEach(function (c) {
      if (c === s.city || c.country === s.country) return;      // already on the map from buildMarkers
      if (s.level === "city" && d3.geoDistance([c.lon, c.lat], [s.city.lon, s.city.lat]) <= 0.12) return;
      var p = P([c.lon, c.lat]);
      if (!p || p[0] < pad || p[0] > W - pad || p[1] < pad || p[1] > H - pad) return;
      want.push({ c: c, d: (p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy) });
    });
    want.sort(function (a, b) { return a.d - b.d; });
    var keep = {};
    want.slice(0, ROAM_MAX).forEach(function (w) { keep[w.c.slug] = w.c; });
    Object.keys(roam).forEach(function (slug) {   // fade out the ones that left
      var m = roam[slug]; if (keep[slug] || m.leaving) return;
      m.leaving = true; m.el.classList.add("is-leaving"); delete domCities[slug];
      setTimeout(function () { if (roam[slug] !== m) return; delete roam[slug]; var i = marks.indexOf(m); if (i >= 0) marks.splice(i, 1); if (m.el.parentNode) m.el.parentNode.removeChild(m.el); }, 380);
    });
    Object.keys(keep).forEach(function (slug) {     // pop in the ones that arrived
      var m = roam[slug];
      if (m && m.leaving) { m.leaving = false; m.el.classList.remove("is-leaving"); domCities[slug] = true; return; }
      if (m) return;
      var c = keep[slug]; addMark(roamRadar(c), [c.lon, c.lat], 1);
      m = marks[marks.length - 1]; m.roam = true; m.el.classList.add("is-roam"); roam[slug] = m; domCities[slug] = true;
    });
  }
  function buildMarkers(fresh) {
    hideHover(); apRow = null; cityName = null;
    markersEl.textContent = ""; marks = []; domCities = {}; roam = {}; destEl = null; dock.hidden = true; dock.textContent = "";
    var s = state;
    if (s.level === "world") {
      regionOrder.forEach(function (r) {
        var lm = LANDMARK[r.name], lead = lm ? '<span class="lm is-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + lm + "</svg></span>" : '<span class="dot"></span>';
        var b = el("button", "chip" + (lm ? " has-lm" : "") + (mqPhone.matches ? " is-small" : ""), lead + esc(r.name) + ' <span class="n">' + r.cities.length + "</span>");
        b.type = "button"; b.setAttribute("aria-label", r.name + ", " + r.cities.length + " service areas");
        b.addEventListener("click", function () { goRegion(r.name); });
        if (canHover) {
          b.addEventListener("mouseenter", function () { hoverReg = r.name; kickFade(); });
          b.addEventListener("mouseleave", function () { hoverReg = null; kickFade(); });
        }
        addMark(b, (mqPhone.matches && PHONE_AT[r.name]) || REG[r.name].at, 2);
      });
    } else if (s.level === "region") {
      regionByName[s.region].countries.forEach(function (k) {
        var n = countries[k].cities.length;
        var b = el("button", "chip is-small", '<span class="dot"></span>' + esc(k) + ' <span class="n">' + n + "</span>");
        b.type = "button"; b.setAttribute("aria-label", k + ", " + n + (n === 1 ? " service area" : " service areas"));
        b.addEventListener("click", function () { goCountry(k); });
        var cm = addMark(b, countryAnchor(k), 2); cm.weight = countries[k].cities.length; cm.chip = true; cm.country = k;
      });
    } else {
      var list = s.level === "country" ? countries[s.country].cities : cities;
      var many = list.length > (mqPhone.matches ? 5 : 12);
      list.forEach(function (c) {
        if (s.city === c) return;
        if (s.level === "city" && c.country !== s.country && d3.geoDistance([c.lon, c.lat], [s.city.lon, s.city.lat]) > 0.12) return;
        var r = radar(c, (!many || (c.featured && !mqPhone.matches)) && s.level === "country" ? "show-label" : "");
        r._city = c;
        r.addEventListener("click", function (e) {
          var n = nearestDot(e.clientX, e.clientY) || r;
          hideHover(); goCity(n._city, { openSheet: true });
        });
        if (canHover) {
          r.addEventListener("mousemove", function (e) {
            var n = nearestDot(e.clientX, e.clientY) || r;
            if (hoverCity !== n._city) showHover(n._city, n); else clearTimeout(hoverT);
          });
          r.addEventListener("mouseleave", function () { hideHover(true); });
        }
        addMark(r, [c.lon, c.lat], 1);
        domCities[c.slug] = true;
      });
      if (s.level === "city") {
        var c = s.city;
        c.airports.forEach(function (a) {
          if (a.lat == null) return;
          var b = el("button", "ap" + (s.airport === a ? " is-on" : ""), "<i>" + PLANE + "</i><span>" + esc(a.code) + "</span>");
          b.type = "button"; b.setAttribute("aria-label", a.code + ", " + a.name);
          b.addEventListener("click", function () { goCity(c, { airport: a, keepSheet: true, openSheet: true }); });
          var mk = addMark(b, [a.lon, a.lat], s.airport === a ? 4 : 2);
          marks[marks.length - 1].ap = true; marks[marks.length - 1].on = s.airport === a;
        });
        var at = s.airport && s.airport.lat != null ? [s.airport.lon, s.airport.lat] : [c.lon, c.lat];
        destEl = radar(c, "is-dest" + (fresh && !reduced ? " is-waiting" : ""));
        destEl.setAttribute("aria-label", "Open service details for " + c.label);
        var destDot = destEl;
        var closerNeighbour = function (e) {
          var n = nearestDot(e.clientX, e.clientY); if (!n) return null;
          var d = destDot.getBoundingClientRect(), nr = n.getBoundingClientRect();
          var dd = Math.pow(d.left - e.clientX, 2) + Math.pow(d.top - e.clientY, 2);
          var dn = Math.pow(nr.left - e.clientX, 2) + Math.pow(nr.top - e.clientY, 2);
          return dn < dd ? n : null;
        };
        destEl.addEventListener("click", function (e) {
          var n = closerNeighbour(e);
          if (n) { hideHover(); goCity(n._city, { openSheet: true }); } else openSheet();
        });
        if (canHover) {
          destEl.addEventListener("mousemove", function (e) {
            var n = closerNeighbour(e);
            if (n) { if (hoverCity !== n._city) showHover(n._city, n); else clearTimeout(hoverT); }
            else if (hoverCity) hideHover(true);
          });
          destEl.addEventListener("mouseleave", function () { if (hoverCity) hideHover(true); });
        }
        if (!s.airport) { addMark(destEl, at, 3); domCities[c.slug] = true; }
        else { addMark(destEl, [c.lon, c.lat], 3); domCities[c.slug] = true; }
        apRow = makePills(c, s.airport, function (a) { goCity(c, { airport: a, keepSheet: true, openSheet: true }); }, function () { openSheet(); });
        apRow.className = "ap-row";
        addMark(apRow, [c.lon, c.lat], 5);
        // the selected city's name printed faintly on the map above it (desktop), behind the dots
        cityName = el("div", "city-name", '<span class="cn-in">' + esc(c.name) + (c.country !== "United States" ? "<small>" + esc(c.country) + "</small>" : "") + "</span>");
        cityName.setAttribute("aria-hidden", "true");
        addMark(cityName, [c.lon, c.lat]);
        (function (n) { requestAnimationFrame(function () {   // long names shrink to fit about 300px
          var w = n.scrollWidth; if (w > 300) n.style.fontSize = Math.max(14, 22 * 300 / w).toFixed(1) + "px";
        }); })(cityName);
        var co = el("div", "callout");
        var name = s.airport ? s.airport.code + " · " + s.airport.name : c.label;
        var via = s.via ? esc(s.via) + " is covered from " + esc(c.label) + ". " : "";
        var meta = s.airport ? esc("Served by Savoya " + c.label) : via + c.nearby.length + " surrounding cities";
        var metaClose = s.airport ? meta : via + c.airports.length + " airports and FBOs · " + c.nearby.length + " surrounding cities";
        co.innerHTML = cardHtml(name, meta, "View service details", metaClose, c);
        addPills(co, c, s.airport, function (a) { goCity(c, { airport: a, keepSheet: true, openSheet: true }); }, function () { openSheet(); });
        co.querySelector(".c-go").addEventListener("click", function () { openSheet(); });
        co.querySelector(".c-x").addEventListener("click", function () { dock.hidden = true; dock.textContent = ""; place(); });
        var cpy = co.querySelector(".copy");
        cpy.addEventListener("click", function () { copyLink(cpy); });
        dock.textContent = ""; dock.appendChild(co); dock.hidden = false; placeDock();
      }
    }
    place();
  }
  function popDest() {
    if (!destEl) return;
    destEl.classList.remove("is-waiting");
    destEl.classList.remove("is-pop"); void destEl.offsetWidth; destEl.classList.add("is-pop");
  }
  // Country and city zoom: a city dot and its name show only while it sits inside the open part of the map
  // (an inner frame clear of the panels and the screen edge). Dragging a dot past that frame fades it out;
  // bringing it back in fades it in. Names are kept apart so they never stack: bigger cities win a clash.
  function frameCities() {
    var lvl = state.level;
    if (lvl !== "country" && lvl !== "city") return;
    var vr = viewRect(true), inset = mqPhone.matches ? 12 : 28;
    var x0 = vr.x + inset, x1 = vr.x + vr.w - inset, y0 = vr.y + inset, y1 = vr.y + vr.h - inset;
    var cx = vr.x + vr.w / 2, cy = vr.y + vr.h / 2, inside = [], kept = [];
    marks.forEach(function (m) {
      var r = m.el.firstChild;
      if (m.ap || !r || !r._city || !r.classList.contains("radar") || r.classList.contains("is-dest")) return;
      var on = !!m.p && !m.el.hasAttribute("data-off") && !m.leaving && m.p[0] > x0 && m.p[0] < x1 && m.p[1] > y0 && m.p[1] < y1;
      m.el.classList.toggle("is-out", !on);
      if (on) inside.push(m); else r.classList.remove("show-label");
    });
    // keep clear of the destination dot, its printed name and its card
    if (lvl === "city") {
      var dp = P([state.city.lon, state.city.lat]);
      if (dp) kept.push([dp[0] - 30, dp[1] - 30, dp[0] + 30, dp[1] + 30]);
      marks.forEach(function (m) { if (m.ap && m.p && !m.el.classList.contains("is-hid")) kept.push([m.p[0] - 14, m.p[1] - 14, m.p[0] + 70, m.p[1] + 14]); });
      var ar = app.getBoundingClientRect();
      [dock, cityName].forEach(function (n) {
        if (!n || n.hidden || !n.isConnected || n.classList.contains("is-off")) return;
        var b = n.getBoundingClientRect(); if (b.width) kept.push([b.left - ar.left, b.top - ar.top, b.right - ar.left, b.bottom - ar.top]);
      });
    }
    inside.sort(function (a, b) {
      var ca = a.el.firstChild._city, cb = b.el.firstChild._city;
      return (cb.featured ? 1 : 0) - (ca.featured ? 1 : 0) || cb.airports.length - ca.airports.length ||
        ((a.p[0] - cx) * (a.p[0] - cx) + (a.p[1] - cy) * (a.p[1] - cy)) - ((b.p[0] - cx) * (b.p[0] - cx) + (b.p[1] - cy) * (b.p[1] - cy));
    });
    inside.forEach(function (m) {
      var r = m.el.firstChild;
      if (!m.lw) { var l = r.querySelector(".r-label"); m.lw = (l && l.offsetWidth) || 90; }
      var bx = [m.p[0] - 8, m.p[1] - 12, m.p[0] + 14 + m.lw, m.p[1] + 12];
      var fits = bx[2] < x1 + inset && !kept.some(function (o) { return bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1]; });
      r.classList.toggle("show-label", fits);
      kept.push(fits ? bx : [m.p[0] - 8, m.p[1] - 8, m.p[0] + 8, m.p[1] + 8]);
    });
  }
  function place() {
    syncProj();
    updateRoam();
    marks.forEach(function (m) {
      var p = P(m.ll);
      var off = !p || p[0] < -200 || p[0] > W + 200 || p[1] < -200 || p[1] > H + 200;
      if (off) { m.el.setAttribute("data-off", ""); return; }
      m.el.removeAttribute("data-off");
      m.el.style.transform = "translate3d(" + p[0].toFixed(1) + "px," + p[1].toFixed(1) + "px,0)";
      m.p = p;
    });
    // many cities on screen at once (the US at country scale): smaller, quieter dots so they stay distinct
    var onScreen = 0;
    marks.forEach(function (m) { if (m.p && !m.ap && m.el.firstChild && m.el.firstChild.classList.contains("radar") && m.p[0] > 0 && m.p[0] < W && m.p[1] > 0 && m.p[1] < H) onScreen++; });
    markersEl.classList.toggle("is-dense", onScreen * 1e5 / Math.max(1, W * H) > 3.5);
    placeDock();
    frameCities();
    // country labels: when they crowd (Europe, or any region on a phone) the busiest countries keep their label
    if (state.level === "region") {
      var kept = [];
      marks.filter(function (m) { return m.el.chip && m.p && !m.el.hasAttribute("data-off"); }).sort(function (a, b) { return b.el.weight - a.el.weight; }).forEach(function (m) {
        if (!m.w) { m.w = m.el.offsetWidth || 90; m.h = m.el.offsetHeight || 28; }
        var bx = [m.p[0] - 12, m.p[1] - m.h / 2 - 2, m.p[0] + m.w - 8, m.p[1] + m.h / 2 + 2];
        var clash = kept.some(function (o) { return bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1]; });
        m.el.classList.toggle("is-hid", clash);
        if (!clash) kept.push(bx);
      });
    }
    // airports only show once there is room for them next to the city
    if (state.level === "city") {
      var c = state.city, cp = P([c.lon, c.lat]) || [-9999, -9999], shown = [];
      marks.forEach(function (m) { if (m.ap && m.on && m.p) shown.push(m.p); });
      marks.forEach(function (m) {
        if (!m.ap || !m.p) return;
        var near = function (q, w, h) { return Math.abs(m.p[0] - q[0]) < w && Math.abs(m.p[1] - q[1]) < h; };
        var clash = !m.on && (near(cp, 40, 30) || shown.some(function (q) { return near(q, 64, 28); }));
        m.el.classList.toggle("is-hid", clash);
        if (!clash && !m.on) shown.push(m.p);
      });
      // once the airports are visible on the map itself, the card drops its pills
      var pins = marks.filter(function (m) { return m.ap && m.p; });
      var visiblePins = pins.filter(function (m) { return !m.el.classList.contains("is-hid"); }).length;
      var zoomedIn = pins.length > 0 && visiblePins >= Math.min(2, pins.length);
      // the printed name stays as you zoom in, all the way; it fades only when zoomed back out past country scale
      if (cityName) cityName.classList.toggle("is-off", cur.k < boxTransform(cityFrame(c)).k * 0.6);
      dock.classList.toggle("is-close", zoomedIn);
      // pills sit in the card; when the card is out of view (details open or card closed) they show under the dot instead
      if (apRow) {
        var cardOut = dock.hidden || app.classList.contains("sheet-open");
        apRow.hidden = zoomedIn || !cardOut;
        if (!apRow.hidden) {
          apRow.style.setProperty("--dx", "0px");
          var rr = apRow.getBoundingClientRect(), ar = app.getBoundingClientRect();
          var minX = ar.left + 8, maxX = ar.right - 8;
          if (!mqPhone.matches) {
            minX = leftPanel.getBoundingClientRect().right + 8;
            if (app.classList.contains("sheet-open")) maxX = sheet.getBoundingClientRect().left - 8;
          }
          var dx = rr.left < minX ? minX - rr.left : (rr.right > maxX ? maxX - rr.right : 0);
          if (dx) apRow.style.setProperty("--dx", dx.toFixed(1) + "px");
        }
      }
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); document.getElementById("q").focus(); }
  });

  /* ---- site button glow (duplicated from core/buttons.js): pointer light + constant-speed comet ---- */
  (function () {
    var SEL = ".glow-grad, .glow-key", HEAD = 0.97 * 360, STEPS = 64, made = {}, styleEl = null;
    function track(e) {
      var btn = e.target.closest && e.target.closest(SEL); if (!btn) return;
      var r = btn.getBoundingClientRect(), sx = btn.offsetWidth / r.width || 1, sy = btn.offsetHeight / r.height || 1;
      btn.style.setProperty("--mx", (e.clientX - r.left) * sx + "px"); btn.style.setProperty("--my", (e.clientY - r.top) * sy + "px");
      fit(btn);
    }
    function angleAt(x, y) { return (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360; }
    function pointAt(d, w, h) {
      var P = 2 * (w + h), hw = w / 2, hh = h / 2; d = ((d % P) + P) % P;
      if (d < hw) return [d, -hh]; d -= hw; if (d < h) return [hw, -hh + d]; d -= h; if (d < w) return [hw - d, hh]; d -= w; if (d < h) return [-hw, hh - d]; d -= h; return [-hw + d, -hh];
    }
    function build(ratio) {
      var name = "glow-orbit-" + Math.round(ratio * 10); if (made[name]) return name;
      var w = ratio, h = 1, P = 2 * (w + h), start = (h / 2) * Math.tan((HEAD - 360) * Math.PI / 180), frames = [], prev = null, turn = 0;
      for (var i = 0; i <= STEPS; i++) {
        var a; if (i === 0) a = HEAD; else if (i === STEPS) a = HEAD + 360 - turn; else { var p = pointAt(start + P * i / STEPS, w, h); a = angleAt(p[0], p[1]); }
        if (prev !== null && a < prev - 180) turn += 360; prev = a;
        frames.push((i * 100 / STEPS).toFixed(4) + "%{--glow-angle:" + (a + turn - HEAD).toFixed(3) + "deg}");
      }
      if (!styleEl) { styleEl = document.getElementById("glow-orbit-keyframes") || document.createElement("style"); styleEl.id = "glow-orbit-keyframes"; if (!styleEl.parentNode) document.head.appendChild(styleEl); }
      styleEl.appendChild(document.createTextNode("@keyframes " + name + "{" + frames.join("") + "}")); made[name] = true; return name;
    }
    function fit(btn) {
      var w = btn.offsetWidth, h = btn.offsetHeight; if (!w || !h) return;
      var name = build(Math.min(12, Math.max(1, Math.round((w / h) * 10) / 10)));
      if (btn.style.getPropertyValue("--orbit-anim") !== name) btn.style.setProperty("--orbit-anim", name);
    }
    document.addEventListener("pointermove", track, { passive: true });
    document.addEventListener("pointerdown", track, { passive: true });
    // footer links carry data-glow (build-safe markup); give them the glow classes once the sheet renders
    new MutationObserver(function () {
      Array.prototype.forEach.call(document.querySelectorAll("[data-glow]"), function (el) { el.classList.add(el.getAttribute("data-glow") === "key" ? "glow-key" : "glow-grad"); el.removeAttribute("data-glow"); });
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", function (e) { var b = e.target.closest && e.target.closest(SEL); if (b) fit(b); });
  })();
  /* ================= Browse panel ================= */
  var topCrumbs = document.getElementById("topCrumbs");
  var crumbs = document.getElementById("crumbs"), list = document.getElementById("list");
  var bTitle = document.getElementById("bTitleText"), bCount = document.getElementById("bCount");
  var ICON_NEXT = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m5 3 4 4-4 4"/></svg>';

  function row(title, sub, right, onClick, cls) {
    var li = el("li"), b = el("button", "row " + (cls || ""));
    b.type = "button";
    b.innerHTML = "<span><b>" + esc(title) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + '</span><span class="cnt">' + (right || "") + ICON_NEXT + "</span>";
    b.addEventListener("click", onClick);
    li.appendChild(b); list.appendChild(li);
    return b;
  }
  function renderPanel() {
    var s = state;
    // breadcrumbs
    crumbs.textContent = "";
    var trail = [["World", goWorld]];
    if (s.region) trail.push([s.region, function () { goRegion(s.region); }]);
    if (s.country) trail.push([s.country, function () { goCountry(s.country); }]);
    if (s.city) trail.push([s.city.name, function () { goCity(s.city); }]);
    if (s.airport) trail.push([s.airport.code, null]);
    trail.forEach(function (t, i) {
      var li = el("li"), b = el("button", null, esc(t[0]));
      b.type = "button";
      if (i === trail.length - 1) b.setAttribute("aria-current", "location");
      else b.addEventListener("click", t[1]);
      li.appendChild(b); crumbs.appendChild(li);
    });
    if (topCrumbs) { // the same trail, duplicated top left over the map
      topCrumbs.textContent = "";
      trail.forEach(function (t, i) {
        var li = el("li"), b = el("button", null, esc(t[0]));
        b.type = "button";
        if (i === trail.length - 1) b.setAttribute("aria-current", "location");
        else b.addEventListener("click", t[1]);
        li.appendChild(b); topCrumbs.appendChild(li);
      });
    }

    list.textContent = ""; list.scrollTop = 0;
    if (s.level === "world") {
      bTitle.textContent = "Choose a region";
      bCount.textContent = "";   // the headline carries "300+ markets"
      regionOrder.forEach(function (r) {
        row(r.name.replace("North America", "N. America").replace("South America", "S. America"), "", String(r.cities.length), function () { goRegion(r.name); });
      });
    } else if (s.level === "region") {
      var r = regionByName[s.region];
      bTitle.textContent = s.region;
      bCount.textContent = r.countries.length + " countries";
      r.countries.slice().sort(function (a, b) { return countries[b].cities.length - countries[a].cities.length || a.localeCompare(b); })
        .forEach(function (k) {
          var n = countries[k].cities.length;
          row(k, countries[k].cities.slice(0, 3).map(function (c) { return c.name; }).join(", ") + (n > 3 ? " and more" : ""), n, function () { goCountry(k); });
        });
    } else if (s.level === "country") {
      var cs = countries[s.country].cities;
      bTitle.textContent = s.country;
      bCount.textContent = cs.length + (cs.length === 1 ? " service area" : " service areas");
      cs.forEach(function (c) {
        row(c.label, c.airports.slice(0, 3).map(function (a) { return a.code; }).join(" · "), "", function () { goCity(c, { openSheet: true }); });
      });
    } else {
      var c = s.city;
      bTitle.textContent = c.label;
      bCount.textContent = c.airports.length + " airports";
      row("View service details", "Airports, coverage and booking", "", function () { openSheet(); }, "is-primary glow-grad");
      var hasPins = c.airports.some(function (a) { return a.lat != null; });
      if (hasPins) {
        var sub = el("li", "sub", "Narrow to an airport"); list.appendChild(sub);
        c.airports.forEach(function (a) {
          if (a.lat == null) return;
          var li = el("li"), b = el("button", "row is-ap" + (s.airport === a ? " is-on" : ""));
          b.type = "button";
          b.innerHTML = '<span class="code">' + PLANE + esc(a.code) + "</span><span><b>" + esc(a.name) + "</b></span><span class=\"cnt\">" + ICON_NEXT + "</span>";
          b.addEventListener("click", function () { goCity(c, { airport: a }); });
          li.appendChild(b); list.appendChild(li);
        });
      }
    }
  }
  function render(fresh) {
    renderPanel(); buildMarkers(fresh !== false);
    popular.hidden = state.level !== "world";
    resetBtn.hidden = state.level === "world";
    var wasWorld = app.classList.contains("at-world");
    app.classList.toggle("at-world", state.level === "world");
    if (state.level === "world" && !wasWorld) playIcons();
    browse.classList.toggle("is-world", state.level === "world");
    app.style.setProperty("--drawer-h", browse.offsetHeight + "px");
    schedule();
  }
  var browse = document.getElementById("browse"), bToggle = document.getElementById("bToggle");
  bToggle.addEventListener("click", function () {
    var open = browse.classList.toggle("is-open");
    bToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* ================= Reset + Lordicon slots ================= */
  var resetBtn = document.getElementById("reset");
  resetBtn.addEventListener("click", goWorld);
  // Lordicon animations (play once). JSON is inlined as window.SVC_LORD = { globe, tower } when available;
  // until then a line-drawn stand-in plays its draw-in once.
  var lordAnims = {};
  function playIcons() {
    ["globe", "tower"].forEach(function (k) {
      var slot = document.getElementById("ico-" + k);
      if (!slot) return;
      var data = window.SVC_LORD && window.SVC_LORD[k];
      if (data && window.lottie) {
        if (!lordAnims[k]) {
          slot.textContent = "";
          lordAnims[k] = lottie.loadAnimation({ container: slot, renderer: "svg", loop: false, autoplay: false, animationData: data });
        }
        lordAnims[k].goToAndStop(0, true);
        if (!reduced) lordAnims[k].play(); else lordAnims[k].goToAndStop(lordAnims[k].totalFrames - 1, true);
      } else {
        slot.classList.remove("is-play"); void slot.offsetWidth; slot.classList.add("is-play");
      }
    });
  }
  ["globe", "tower"].forEach(function (k) {
    var slot = document.getElementById("ico-" + k);
    if (slot && slot.parentNode) slot.parentNode.addEventListener("mouseenter", function () {
      if (lordAnims[k] && lordAnims[k].isPaused) { lordAnims[k].goToAndPlay(0, true); }
      else if (!lordAnims[k]) { slot.classList.remove("is-play"); void slot.offsetWidth; slot.classList.add("is-play"); }
    });
  });

  /* ================= Popular airports ================= */
  // Main airport of each featured service area on savoya.com/service-areas.
  // Thumbs are runway plans drawn from each airport's real layout: [heading, length, side offset, along offset]
  var POPULAR = [
    ["new-york-city-ny", "JFK", [[44, .85, -.62, -.1], [44, .62, -.3, .2], [134, 1, .1, .25], [134, .75, .42, .05]]],
    ["los-angeles-ca", "LAX", [[69, .82, -.62, -.05], [69, .95, -.42, .05], [69, 1, .42, 0], [69, .9, .62, .08]]],
    ["london-united-kingdom", "LHR", [[90, 1, -.42, 0], [90, .97, .42, -.04]]],
    ["paris-france", "CDG", [[87, .95, -.6, -.08], [87, .7, -.42, .12], [87, .8, .42, .1], [87, 1, .6, -.05]]],
    ["dubai-united-arab-emirates", "DXB", [[120, 1, -.25, 0], [120, .98, .25, .02]]],
    ["miami-fl", "MIA", [[87, .82, -.45, .1], [87, .65, -.3, -.15], [87, .58, .42, .1], [117, .7, .05, .05]]]
  ].map(function (p) {
    var c = bySlug[p[0]];
    return { city: c, airport: c.airports.filter(function (a) { return a.code === p[1]; })[0], runways: p[2] };
  });
  function runwaySvg(p) {
    var cx = 60, cy = 40, S = 46, out = "";
    p.runways.forEach(function (r) {
      var ang = r[0] - 90, len = r[1] * S * 2, w = 4.2;
      var rad = ang * Math.PI / 180, nx = -Math.sin(rad), ny = Math.cos(rad);
      var x = cx + nx * r[2] * 22 + Math.cos(rad) * r[3] * 22, y = cy + ny * r[2] * 22 + Math.sin(rad) * r[3] * 22;
      out += '<g transform="translate(' + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + ang + ')">' +
        '<rect x="' + (-len / 2).toFixed(1) + '" y="' + (-w / 2) + '" width="' + len.toFixed(1) + '" height="' + w + '" rx="0.6" fill="var(--rw)"/>' +
        '<line x1="' + (-len / 2 + 6).toFixed(1) + '" x2="' + (len / 2 - 6).toFixed(1) + '" y1="0" y2="0" stroke="var(--rw-line)" stroke-width="0.5" stroke-dasharray="2.5 2.5"/>' +
        '<rect x="' + (-len / 2 + 1).toFixed(1) + '" y="-1.4" width="2" height="2.8" fill="var(--rw-line)"/>' +
        '<rect x="' + (len / 2 - 3).toFixed(1) + '" y="-1.4" width="2" height="2.8" fill="var(--rw-line)"/></g>';
    });
    return '<svg class="rw" viewBox="0 0 120 80" aria-hidden="true"><defs><radialGradient id="g' + p.airport.code + '" cx="50%" cy="45%" r="70%">' +
      '<stop offset="0" stop-color="var(--thumb-hi)"/><stop offset="1" stop-color="var(--thumb-lo)"/></radialGradient></defs>' +
      '<rect width="120" height="80" fill="url(#g' + p.airport.code + ')"/>' +
      '<path d="M0 20h120M0 40h120M0 60h120M30 0v80M60 0v80M90 0v80" stroke="var(--thumb-grid)" stroke-width="0.5"/>' + out +
      '<text x="6" y="74" class="rw-code">' + p.airport.code + "</text></svg>";
  }
  var popular = document.getElementById("popular"), popList = document.getElementById("popList");
  POPULAR.forEach(function (p) {
    var li = el("li"), b = el("button", "pop");
    b.type = "button";
    b.setAttribute("aria-label", p.airport.name + ", " + p.city.label + ". Opens service details");
    b.innerHTML = '<span class="thumb">' + (THUMBS[p.city.slug] ? '<img src="' + THUMBS[p.city.slug] + '" width="84" height="56" alt="" decoding="async">' : runwaySvg(p)) + '</span><span class="pt"><b>' + esc(p.airport.name) + "</b><small><em>" +
      esc(p.airport.code) + "</em>" + esc(p.city.label.replace(/,.*$/, "")) + "</small></span>";
    b.addEventListener("click", function () {
      if (mqPhone.matches) browse.classList.remove("is-open");
      goCity(p.city, { airport: p.airport, openSheet: true });
    });
    li.appendChild(b); popList.appendChild(li);
  });

  /* ================= Canvas hover + click ================= */
  var hoverFeat = null, tip = document.getElementById("tip"), nearDrawn = [];
  var pillEl = document.getElementById("areaPill"), pillFor = null, labelSig = "", labelT = 0;
  function pillAt(c, n, x, y, a) {
    if (!pillEl) return;
    if (!c) { if (!pillEl.hidden) pillEl.hidden = true; pillFor = null; return; }
    if (pillFor !== c) { pillFor = c; pillEl.innerHTML = CITY_ICON + "<b>" + reachLabel(n) + "</b> surrounding cities"; }
    pillEl.hidden = false;
    pillEl.style.opacity = a;
    pillEl.style.transform = "translate(" + Math.round(x - pillEl.offsetWidth / 2) + "px," + Math.round(y) + "px)";
  }
  function featAt(px, py) {
    syncProj();
    if (Math.hypot(px - cur.cx, py - cur.cy) > cur.k) return null;   // off the globe, in space
    var ll = proj.invert([px, py]);
    if (!ll || !isFinite(ll[0])) return null;
    var hit = null;
    for (var i = 0; i < F50.length; i++) {
      var f = F50[i];
      if (!f.wraps && (ll[0] < f.b[0][0] || ll[0] > f.b[1][0] || ll[1] < f.b[0][1] || ll[1] > f.b[1][1])) continue;
      if (d3.geoContains(f, ll)) { hit = f; if (f.svc) break; }
    }
    return hit;
  }
  function hideTip() { tip.hidden = true; }
  // over open ocean a green "Drag" disc replaces the hand cursor (mouse only)
  var dragCur = document.getElementById("dragCur"), oceanOn = false, dragHeld = false;
  function setOcean(on) {
    if (on === oceanOn) return; oceanOn = on;
    canvas.classList.toggle("is-ocean", on); dragCur.classList.toggle("is-on", on);
  }
  function moveCur(x, y) { dragCur.style.transform = "translate(" + x + "px," + y + "px)"; }
  canvas.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") { dragHeld = true; dragCur.classList.add("is-down"); } });
  window.addEventListener("pointerup", function () { if (dragHeld) { dragHeld = false; dragCur.classList.remove("is-down"); } });
  canvas.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    moveCur(x, y);
    if (canvas.classList.contains("is-dragging")) return;
    var nt = null, nd = 64;
    nearDrawn.forEach(function (d) { var dd = (d.x - x) * (d.x - x) + (d.y - y) * (d.y - y); if (dd < nd) { nd = dd; nt = d; } });
    if (nt) {
      setOcean(false); canvas.classList.remove("is-pointer");
      tip.innerHTML = esc(nt.t.name) + "<small>" + esc(state.city.name) + " service area</small>";
      tip.hidden = false;
      tip.style.transform = "translate(" + Math.min(nt.x + 12, W - tip.offsetWidth - 8) + "px," + (nt.y + 12) + "px)";
      return;
    }
    syncProj();
    var nc = cityNear(x, y, 22), ncm = nc && markOf(nc);
    if (nc && !(ncm && ncm.el.classList.contains("is-out"))) {   // a faint city dot: it's clickable, so say so
      setOcean(false); canvas.classList.add("is-pointer");
      tip.innerHTML = esc(nc.label) + "<small>View service area</small>";
      tip.hidden = false;
      tip.style.transform = "translate(" + Math.min(x + 14, W - tip.offsetWidth - 8) + "px," + (y + 16) + "px)";
      return;
    }
    var f = featAt(x, y);
    setOcean(!f);
    if (f !== hoverFeat) { hoverFeat = f; schedule(); }
    if (state.level === "world") {
      var rg = f && f.reg && regionByName[f.reg] ? f.reg : null;
      if (rg !== hoverReg) { hoverReg = rg; kickFade(); }
      canvas.classList.toggle("is-pointer", !!rg);
      if (!rg) return hideTip();
      tip.innerHTML = esc(rg) + "<small>" + regionByName[rg].cities.length + " featured markets</small>";
      tip.hidden = false;
      tip.style.transform = "translate(" + Math.min(x + 14, W - tip.offsetWidth - 8) + "px," + (y + 16) + "px)";
      return;
    }
    canvas.classList.toggle("is-pointer", !!(f && f.svc));
    if (!f || (state.level === "city" && f.svc === state.country)) return hideTip();
    var n = f.svc ? countries[f.svc].cities.length : 0;
    tip.innerHTML = esc(f.svc || f.properties.name) + "<small>" + (n ? n + (n === 1 ? " service area" : " service areas") : "Request service") + "</small>";
    tip.hidden = false;
    var tx = Math.min(x + 14, W - tip.offsetWidth - 8);
    tip.style.transform = "translate(" + tx + "px," + (y + 16) + "px)";
  });
  canvas.addEventListener("pointerleave", function () { hoverFeat = null; hoverReg = null; hideTip(); kickFade(); if (!dragHeld) setOcean(false); });
  // Country and city zoom: a click that lands just beside a city (the faint dots that have no live marker,
  // or a near miss on a live one) goes to that city instead of falling through to the country underneath,
  // which used to fly the map off to a neighbouring country or region.
  function cityNear(x, y, rad) {
    if (state.level !== "country" && state.level !== "city") return null;
    var best = null, bd = rad * rad;
    cities.forEach(function (c) {
      if (state.level === "city" && c === state.city) return;
      var p = P([c.lon, c.lat]); if (!p) return;
      var d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  }
  function markOf(c) { // the city's live marker, if it has one
    for (var i = 0; i < marks.length; i++) { var r = marks[i].el.firstChild; if (r && r._city === c) return marks[i]; }
    return null;
  }
  canvas.addEventListener("click", function (e) {
    if (dragMoved) return;
    var r = canvas.getBoundingClientRect();
    syncProj();
    var cx0 = e.clientX - r.left, cy0 = e.clientY - r.top;
    if (state.level === "city" && nearDrawn.some(function (d) { return Math.hypot(d.x - cx0, d.y - cy0) < 10; })) return;   // a surrounding town
    var near = cityNear(cx0, cy0, 22);
    if (near) {
      var nm = markOf(near);
      if (nm && nm.el.classList.contains("is-out")) return;   // faded out at the edge of the map: ignore, don't jump away
      hideHover(); return goCity(near, { openSheet: true });
    }
    var f = featAt(e.clientX - r.left, e.clientY - r.top);
    if (!f) return;
    if (state.level === "world" && f.reg && regionByName[f.reg]) return goRegion(f.reg);
    if (!f.svc) return toast(f.properties.name);
    var k = f.svc, reg = countries[k].region;
    if (state.level === "world") return goRegion(reg);
    if (state.level === "region" && reg !== state.region) return goRegion(reg);
    if (k !== state.country) return goCountry(k);
    if (state.level === "country" && countries[k].cities.length === 1) return goCity(countries[k].cities[0], { openSheet: true });
  });

  var toastEl = document.getElementById("toast"), toastTimer;
  function toast(country) {
    toastEl.innerHTML = "<span>Savoya doesn't list a service area in " + esc(country) + " yet.</span>" +
      '<a href="' + SITE + '/service-areas" data-req="" target="_blank" rel="noopener">Request a city</a>' +
      '<button type="button" aria-label="Dismiss">✕</button>';
    toastEl.hidden = false;
    toastEl.querySelector("button").onclick = function () { toastEl.hidden = true; };
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, 5200);
  }

  /* ================= Sheet ================= */
  var sheet = document.getElementById("sheet");
  var STATS = [["61%", "of Fortune 100 companies"], ["99.5%", "of trips executed without issue"], ["300+", "service areas across six continents"], ["7,200+", "chauffeurs on the platform"]];
  var lastFocus = null, lastSheetKey = null;
  function openSheet(noReframe) { kFitMemo.t = 0;
    var c = state.city; if (!c) return;
    var a = state.airport;
    var place = c.name;
    var linked = c.airports.length;
    var pinned = c.airports.filter(function (x) { return x.lat != null; }).length;
    var apRows = c.airports.map(function (x) {
      var link = x.slug && c.slug === "houston-tx" ? '<a href="' + SITE + "/airport/" + x.slug + '" target="_blank" rel="noopener" aria-label="' + esc(x.name) + ' airport page">Page ↗</a>' : "";
      var pin = x.lat != null ? '<button class="pin" type="button" data-ap="' + esc(x.code) + '" aria-label="Show ' + esc(x.code) + ' on the map">Map</button>' : "";
      return '<li class="' + (a === x ? "is-on" : "") + '"><span class="code">' + PLANE + esc(x.code) + '</span><span class="nm">' + esc(x.name) + '</span><span class="acts">' + pin + link + "</span></li>";
    }).join("");
    var towns = c.nearby.map(function (t) { return '<span class="' + (state.via === t ? "is-on" : "") + '">' + esc(t) + "</span>"; }).join("");
    sheet.innerHTML =
      '<div class="sh-scroll">' +
      '<header class="sh-head">' +
        '<button class="sh-close" type="button" aria-label="Close service details"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 2l10 10M12 2 2 12"/></svg></button>' +
        '<p class="overline">Service area · ' + esc(c.region) + "</p>" +
        '<div class="sh-link"><button class="copy" type="button">' + LINK_ICON + "<span>Copy link</span></button></div>" +
        '<div class="sh-title">' + thumbImg(c, 72, "sh-thumb") + '<h2 id="shTitle">' + esc(c.label) + "</h2></div>" +
        '<p class="lede">Luxury black car and chauffeur service in ' + esc(c.label) + ". Elevated black car service anywhere you need it.</p>" +
        (state.via ? '<p class="sh-via"><i></i>' + esc(state.via) + " is part of the " + esc(place) + " service area</p>" : "") +
        (a ? '<p class="sh-via"><i></i>Showing ' + esc(a.code) + ", " + esc(a.name) + "</p>" : "") +
        '<div class="sh-facts"><div><b>' + linked + '</b><span>Airports and FBOs</span></div><div><b>' + c.nearby.length +
        '</b><span>Surrounding cities</span></div><div><b>24/7</b><span>Concierge support</span></div></div>' +
      "</header>" +
      '<section class="sh-sec" aria-labelledby="secCover"><h3 id="secCover">Getting around ' + esc(place) + "</h3>" +
        '<div class="tabs" role="tablist">' +
          '<button type="button" role="tab" id="tabAp" aria-controls="panAp" aria-selected="true">Airports<span class="n">' + linked + "</span></button>" +
          '<button type="button" role="tab" id="tabTw" aria-controls="panTw" aria-selected="false">Surrounding cities<span class="n">' + c.nearby.length + "</span></button>" +
        "</div>" +
        '<ul class="ap-list" id="panAp" role="tabpanel" aria-labelledby="tabAp">' + apRows + "</ul>" +
        '<div class="towns" id="panTw" role="tabpanel" aria-labelledby="tabTw" hidden>' + towns + "</div>" +
      "</section>" +
      '<section class="sh-sec"><h3>The Savoya difference</h3><p>Savoya redefines private black car service, blending unparalleled luxury with innovative technology and exceptional 24/7 customer service, even in the heart of ' + esc(place) +
        ". Our platform makes booking and managing chauffeur service effortless, offering peace of mind with real-time updates. Each chauffeur undergoes rigorous vetting for maximum safety and discretion.</p></section>" +
      '<section class="sh-sec"><h3>Local expertise and knowledge</h3><p>Savoya’s chauffeurs are more than drivers, <strong>we are trusted local experts</strong>. With deep knowledge of the area’s routes, traffic patterns and key venues, they ensure every ride is efficient and stress-free, whether you’re heading to a high-profile meeting, airport or exclusive event.</p></section>' +
      '<section class="sh-sec"><h3>Savoya worldwide</h3><div class="stats">' + STATS.map(function (s) { return "<div><b>" + s[0] + "</b><span>" + s[1] + "</span></div>"; }).join("") + "</div>" +
        '<figure class="quote"><blockquote>“Savoya is the best in the business. I have never had a single issue in the four years that I’ve used their services.”</blockquote><figcaption><b>Carly Veazey</b>, Executive Assistant, Zillow Group</figcaption></figure></section>' +
      "</div>" +
      '<footer class="sh-foot"><a class="btn btn-primary" data-glow="grad" href="' + BOOK + '" target="_blank" rel="noopener">Book Now</a>' +
      '<a class="btn btn-ghost" data-glow="key" href="' + SITE + "/service-areas/" + c.slug + '" target="_blank" rel="noopener">Learn more<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/></svg></a></footer>';

    sheet.querySelector(".sh-close").addEventListener("click", function () { closeSheet(); });
    var cb = sheet.querySelector(".sh-link .copy");
    cb.addEventListener("click", function () { copyLink(cb); });
    var tabs = sheet.querySelectorAll('[role="tab"]');
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (o) { o.setAttribute("aria-selected", o === t ? "true" : "false"); });
        sheet.querySelector("#panAp").hidden = t.id !== "tabAp";
        sheet.querySelector("#panTw").hidden = t.id !== "tabTw";
      });
    });
    if (state.via) tabs[1].click();
    sheet.querySelectorAll("[data-ap]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ap = c.airports.filter(function (x) { return x.code === b.getAttribute("data-ap"); })[0];
        goCity(c, { airport: ap, keepSheet: true }); openSheet();
      });
    });
    sheet.insertAdjacentHTML("beforeend", '<div class="sweep" aria-hidden="true"></div>');
    var wasOpen = app.classList.contains("sheet-open");
    var key = c.slug + (a ? "." + a.code : "");
    if (wasOpen && lastSheetKey && key !== lastSheetKey) {
      var sw = sheet.querySelector(".sweep");
      requestAnimationFrame(function () { sw.classList.add("run"); });
    }
    lastSheetKey = key;
    if (!wasOpen) lastFocus = document.activeElement;
    app.classList.add("sheet-open");
    requestAnimationFrame(function () { schedule(); });
    syncHash();
    sheet.querySelector(".sh-scroll").scrollTop = 0;
    if (!wasOpen) {
      setTimeout(function () { sheet.focus({ preventScroll: true }); }, 60);
      if (noReframe !== true) { if (state.level === "city") fly(areaBox(c)); else reframe(); }
    }
    var on = sheet.querySelector(".ap-list li.is-on");
    if (on) on.scrollIntoView({ block: "center" });
  }
  function closeSheet(silent) { kFitMemo.t = 0;
    if (!app.classList.contains("sheet-open")) return;
    app.classList.remove("sheet-open");
    requestAnimationFrame(function () { place(); });
    setTimeout(function () { place(); }, 560);
    if (!silent) syncHash();
    if (!silent) {
      reframe();
      if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }
  }
  function reframe() { // pan (never zoom) so the destination stays clear of the sheet
    if (state.level !== "city") return;
    var a = state.airport, c = state.city;
    var ll = a && a.lat != null ? [a.lon, a.lat] : [c.lon, c.lat];
    if (inView(ll)) return;
    var r = viewRect(), my = ++flyToken;
    flyTo({ lon: ll[0], lat: ll[1], k: cur.k, cx: r.x + r.w / 2, cy: r.y + r.h / 2 }, reduced ? 1 : 520, null, my);
  }

  /* ================= Search ================= */
  var q = document.getElementById("q"), results = document.getElementById("results"), qclear = document.getElementById("qclear");
  var US_STATES = { AL:"alabama",AK:"alaska",AZ:"arizona",AR:"arkansas",CA:"california",CO:"colorado",CT:"connecticut",DE:"delaware",DC:"district of columbia",FL:"florida",GA:"georgia",HI:"hawaii",ID:"idaho",IL:"illinois",IN:"indiana",IA:"iowa",KS:"kansas",KY:"kentucky",LA:"louisiana",ME:"maine",MD:"maryland",MA:"massachusetts",MI:"michigan",MN:"minnesota",MS:"mississippi",MO:"missouri",MT:"montana",NE:"nebraska",NV:"nevada",NH:"new hampshire",NJ:"new jersey",NM:"new mexico",NY:"new york",NC:"north carolina",ND:"north dakota",OH:"ohio",OK:"oklahoma",OR:"oregon",PA:"pennsylvania",RI:"rhode island",SC:"south carolina",SD:"south dakota",TN:"tennessee",TX:"texas",UT:"utah",VT:"vermont",VA:"virginia",WA:"washington",WV:"west virginia",WI:"wisconsin",WY:"wyoming" };
  function stateIn(raw) {
    var t = raw.trim().toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ");
    var last = t.split(" ").pop().toUpperCase();
    if (US_STATES[last] && t.indexOf(" ") > 0) return last;
    for (var k in US_STATES) if (t.length > US_STATES[k].length && t.slice(-US_STATES[k].length - 1) === " " + US_STATES[k]) return k;
    return null;
  }
  function norm(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  var index = [];
  cities.forEach(function (c) {
    index.push({ type: "city", key: norm(c.name + " " + (c.state || "") + " " + c.country), main: norm(c.name), c: c });
    c.airports.forEach(function (a) { index.push({ type: "airport", key: norm(a.code + " " + a.name), main: norm(a.code), c: c, a: a }); });
    c.nearby.forEach(function (t) {
      if (norm(t) === norm(c.name)) return;
      index.push({ type: "town", key: norm(t), main: norm(t), c: c, t: t });
    });
  });
  var hits = [], activeIdx = -1;
  var PIN = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 12.5S2.5 8.4 2.5 5.5a4.5 4.5 0 0 1 9 0c0 2.9-4.5 7-4.5 7Z"/><circle cx="7" cy="5.5" r="1.5"/></svg>';
  function hl(text, qn) {
    var i = norm(text).indexOf(qn);
    if (i < 0 || !qn) return esc(text);
    return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + qn.length)) + "</mark>" + esc(text.slice(i + qn.length));
  }
  function search() {
    var raw = q.value.trim(), qn = norm(raw);
    qclear.hidden = !raw;
    if (!qn) { closeResults(); return; }
    var scored = [];
    index.forEach(function (it) {
      var s = -1;
      if (it.main === qn) s = 100;
      else if (it.main.indexOf(qn) === 0) s = 80;
      else if (it.key.split(/[\s,/-]+/).some(function (w) { return w.indexOf(qn) === 0; })) s = 60;
      else if (it.key.indexOf(qn) >= 0) s = 40;
      if (s < 0) return;
      if (it.type === "city") s += 12; else if (it.type === "airport" && qn.length === 3) s += 8; else if (it.type === "town") s -= 6;
      if (it.c.featured) s += 2;
      scored.push({ it: it, s: s });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    var seen = {}; hits = [];
    scored.forEach(function (x) {
      var k = x.it.type + x.it.c.slug + (x.it.a ? x.it.a.code : "") + (x.it.t || "");
      if (seen[k] || hits.length >= 8) return;
      if (x.it.type === "town" && seen["city" + x.it.c.slug] && hits.length > 4) return;
      seen[k] = 1; hits.push(x.it);
    });
    results.textContent = "";
    app.classList.toggle("no-match", !hits.length);
    if (!hits.length) {
      // nearby service areas when the query names a US state (e.g. "Lakewood FL")
      var st = stateIn(raw), near = st ? cities.filter(function (c) { return c.state === st; }) : [];
      var li = el("li", "empty");
      li.innerHTML = '<div class="sweep" aria-hidden="true"></div>' +
        '<span class="nm-ico" aria-hidden="true">' + PIN + '</span>' +
        '<p class="nm-title">We don\u2019t list \u201C' + esc(raw) + '\u201D yet</p>' +
        '<p class="nm-body">Savoya often covers nearby towns and private FBOs that aren\u2019t listed here. Tell us where you\u2019re headed and the team will confirm coverage.</p>' +
        (near.length ? '<p class="nm-near-l">Nearby service areas</p><div class="nm-near"></div>' : '') +
        '<a class="nm-cta" href="' + SITE + '/service-areas" data-req="' + esc(raw) + '" target="_blank" rel="noopener">Request this city<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"/></svg></a>';
      if (near.length) {
        var box = li.querySelector(".nm-near");
        // areas whose surrounding towns start with the typed place come first; show 6, the rest on demand
        var head = raw.replace(/,.*$/, "").replace(/\s+[A-Za-z]{2}\.?$/, "").trim().toLowerCase();
        var lists = function (c) { return head && c.nearby.some(function (t) { return t.toLowerCase().indexOf(head) === 0; }) ? 0 : 1; };
        near = near.slice().sort(function (a, b) { return lists(a) - lists(b) || a.label.localeCompare(b.label); });
        near.forEach(function (c, i) {
          var b = el("button", "nm-city", PIN + esc(c.label)); b.type = "button";
          if (i >= 6) b.hidden = true;
          b.addEventListener("mousedown", function (e) { e.preventDefault(); q.value = c.label; closeResults(); q.blur(); goCity(c, { openSheet: true }); });
          box.appendChild(b);
        });
        if (near.length > 6) {
          var more = el("button", "nm-city nm-more", "+" + (near.length - 6) + " more in " + esc(st)); more.type = "button";
          more.addEventListener("mousedown", function (e) {
            e.preventDefault(); box.querySelectorAll("[hidden]").forEach(function (x) { x.hidden = false; }); more.remove();
          });
          box.appendChild(more);
        }
      }
      li.addEventListener("mousedown", function (e) { if (!e.target.closest("a, button")) e.preventDefault(); });
      li.addEventListener("mouseenter", function () {
        var sw = li.querySelector(".sweep"); sw.classList.remove("run"); void sw.offsetWidth; sw.classList.add("run");
      });
      results.appendChild(li);
    }
    hits.forEach(function (it, i) {
      var li = el("li"); li.id = "opt" + i; li.setAttribute("role", "option");
      var icon, title, sub;
      if (it.type === "city") { icon = PIN; title = hl(it.c.label, qn); sub = it.c.country === "United States" ? "United States · " + it.c.region : it.c.region; }
      else if (it.type === "airport") { icon = esc(it.a.code); li.className = "is-ap"; title = hl(it.a.name, qn); sub = "Airport · served from " + esc(it.c.label); }
      else { icon = PIN; title = hl(it.t, qn); sub = "Covered from " + esc(it.c.label); }
      li.innerHTML = '<span class="ri">' + icon + '</span><span class="rt"><b>' + title + "</b><small>" + sub + "</small></span>";
      li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(i); });
      results.appendChild(li);
    });
    results.hidden = false; q.setAttribute("aria-expanded", "true");
    setActive(hits.length ? 0 : -1);
  }
  function setActive(i) {
    activeIdx = i;
    Array.prototype.forEach.call(results.querySelectorAll('[role="option"]'), function (li, j) { li.setAttribute("aria-selected", j === i ? "true" : "false"); });
    if (i >= 0) { q.setAttribute("aria-activedescendant", "opt" + i); var a = document.getElementById("opt" + i); if (a) a.scrollIntoView({ block: "nearest" }); }
    else q.removeAttribute("aria-activedescendant");
  }
  function closeResults() { app.classList.remove("no-match"); results.hidden = true; q.setAttribute("aria-expanded", "false"); q.removeAttribute("aria-activedescendant"); }
  function choose(i) {
    var it = hits[i]; if (!it) return;
    q.value = it.type === "airport" ? it.a.code + " · " + it.c.label : it.type === "town" ? it.t + " · " + it.c.label : it.c.label;
    closeResults(); q.blur();
    if (mqPhone.matches) browse.classList.remove("is-open");
    if (it.type === "airport") goCity(it.c, { airport: it.a, openSheet: true });
    else if (it.type === "town") goCity(it.c, { via: it.t, openSheet: true });
    else goCity(it.c, { openSheet: true });
  }
  q.addEventListener("input", search);
  q.addEventListener("focus", function () { if (q.value.trim()) search(); });
  q.addEventListener("blur", function () { setTimeout(closeResults, 120); });
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!results.hidden && hits.length) setActive((activeIdx + 1) % hits.length); else search(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hits.length) setActive((activeIdx - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (activeIdx >= 0) choose(activeIdx); }
    else if (e.key === "Escape") { if (!results.hidden) { e.stopPropagation(); closeResults(); } }
  });
  qclear.addEventListener("click", function () { q.value = ""; qclear.hidden = true; closeResults(); q.focus(); });

  /* ================= Controls ================= */
  function zoomBy(f) {
    var my = ++flyToken;
    flyTo({ lon: cur.lon, lat: cur.lat, k: Math.max(kFit(), Math.min(K_MAX, cur.k * f)), cx: cur.cx, cy: cur.cy }, reduced ? 1 : 350, null, my);
  }
  document.getElementById("zin").addEventListener("click", function () { zoomBy(1.8); });
  document.getElementById("zout").addEventListener("click", function () { zoomBy(1 / 1.8); });
  document.getElementById("zworld").addEventListener("click", goWorld);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && reqOpen) { e.preventDefault(); closeRequest(); return; }
    if (e.key === "Escape" && document.activeElement !== q) up();
  });

  /* ================= Request a city: HubSpot form over the faded map ================= */
  // Same form as the old Service Area Request section (portal 6205552), so leads route as before.
  var HS = { region: "na1", portalId: "6205552", formId: "08508ff5-ccef-49a0-be79-2905169a696b", src: "https://js.hsforms.net/forms/embed/v2.js" };
  var req = document.getElementById("req"), reqForm = document.getElementById("reqForm"), reqOpen = false, reqMade = false, reqText = "", reqT = 0, reqBack = null;
  function hsScript(done) {
    if (window.hbspt && window.hbspt.forms) return done();
    var s = document.querySelector('script[src="' + HS.src + '"]');
    if (!s) { s = document.createElement("script"); s.src = HS.src; s.async = true; document.head.appendChild(s); }
    s.addEventListener("load", function () { done(); });
    s.addEventListener("error", function () { reqForm.innerHTML = '<p class="req-err">The form could not load. <a href="' + SITE + '/contact">Contact the team</a> and they will confirm coverage.</p>'; });
  }
  function reqFill() { // put the searched place in "Service Area Needed"
    if (!reqText) return;
    var fr = reqForm.querySelector("iframe"), doc = fr ? fr.contentDocument : document, m;
    try { m = doc && doc.querySelector('[name="message"]'); } catch (e) { m = null; }
    if (!m || m.value) return;
    m.value = reqText;
    m.dispatchEvent(new Event("input", { bubbles: true })); m.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function openRequest(text, from) {
    reqText = (text || "").trim(); reqBack = from || document.activeElement;
    closeResults(); hideHover();
    clearTimeout(reqT); req.hidden = false; reqOpen = true;
    requestAnimationFrame(function () { app.classList.add("req-open"); });
    if (!reqMade) {
      reqMade = true;
      hsScript(function () {
        window.hbspt.forms.create({ region: HS.region, portalId: HS.portalId, formId: HS.formId, target: "#" + reqForm.id,
          onFormReady: function () { setTimeout(reqFill, 60); } });
      });
    } else reqFill();
    setTimeout(function () { req.querySelector(".req-x").focus(); }, 60);
  }
  function closeRequest() {
    if (!reqOpen) return;
    reqOpen = false; app.classList.remove("req-open");
    reqT = setTimeout(function () { req.hidden = true; }, reduced ? 0 : 360);
    if (reqBack && reqBack.focus && reqBack.isConnected) reqBack.focus();
  }
  req.querySelector(".req-x").addEventListener("click", closeRequest);
  req.addEventListener("click", function (e) { if (e.target === req) closeRequest(); });
  app.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-req]");
    if (!a) return;
    e.preventDefault(); openRequest(a.getAttribute("data-req"), q);
  });

  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      resize(); placeDock();
      var s = state, box = s.level === "world" ? WORLD_BOX : s.level === "region" ? REG[s.region].box : s.level === "country" ? countryBox(s.country) :
        cityFrame(s.city);
      sel.interrupt(); var t = boxTransform(box);
      if (s.level === "world") { cur.k = t.k; } cur.cx = t.cx; cur.cy = t.cy; schedule();
    }, 120);
  });

  /* ================= Boot ================= */
  resize();
  render(false);
  (function () { var t = boxTransform(WORLD_BOX); cur.lon = t.lon; cur.lat = t.lat; cur.k = t.k; cur.cx = t.cx; cur.cy = t.cy; schedule(); })();
  idleSpin();
  ambient();

  var hadHash = location.hash.length > 1;
  if (location.hash.length > 1) applyToken(location.hash, true);
  if (!hadHash) startIntro();

  // test hook for the prototype review
  window.__svc = { goCity: function (s, o) { goCity(bySlug[s], o); }, goRegion: goRegion, goCountry: goCountry, goWorld: goWorld, openSheet: openSheet, state: function () { return state; },
    zoomOn: function (f) { zoomBy(f); }, cur: function () { return cur; } };
})();
