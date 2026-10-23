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
    var cs = countries[name].cities.filter(inFrame);
    return [d3.mean(cs, function (c) { return c.lon; }), d3.mean(cs, function (c) { return c.lat; })];
  }
  function padBox(w, s, e, n, pad, minLon, minLat) {
    var cx = (w + e) / 2, cy = (s + n) / 2;
    var dx = Math.max((e - w) * (1 + pad), minLon) / 2, dy = Math.max((n - s) * (1 + pad), minLat) / 2;
    return [[cx - dx, cy - dy], [cx + dx, cy + dy]];
  }
  function countryBox(name) {
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
    return topojson.feature(t, t.objects.countries).features.filter(function (f) { return f.properties.name !== "Antarctica"; })
      .map(function (f) {
        f.b = d3.geoBounds(f);
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
  var markersEl = document.getElementById("markers");
  var W = 0, H = 0, dpr = 1;
  var p0 = d3.geoMercator().scale(1).translate([0, 0]);
  var proj = d3.geoMercator();
  var path = d3.geoPath(proj, ctx);
  var cur = d3.zoomIdentity;
  var C = {};
  function readTokens() {
    var css = getComputedStyle(app);
    var tok = function (n) { return css.getPropertyValue(n).trim(); };
    C = {
      land: tok("--land"), served: tok("--land-served"), scope: tok("--land-scope"), active: tok("--land-active"),
      hover: tok("--land-hover"), green: tok("--land-green"), mintRGB: tok("--mint-rgb"), mintA: +tok("--mint-alpha") || 0.25,
      litRGB: tok("--lit-rgb"), gold: tok("--gold"),
      grid: tok("--map-grid"), servedEdge: tok("--map-served-edge"), border: tok("--map-border"), states: tok("--map-states"), focus: tok("--map-focus"), ring: tok("--map-ring"), dot: tok("--map-dot")
    };
  }
  // Light / Dark map style, remembered per viewer
  var modeBtns = { light: document.getElementById("modeLight"), dark: document.getElementById("modeDark") };
  function setMapMode(m) {
    app.setAttribute("data-map", m);
    modeBtns.light.setAttribute("aria-pressed", m === "light" ? "true" : "false");
    modeBtns.dark.setAttribute("aria-pressed", m === "dark" ? "true" : "false");
    readTokens(); if (typeof schedule === "function") schedule();
    try { localStorage.setItem("svc-map-mode", m); } catch (e) { /* storage may be blocked */ }
  }
  var savedMode = "dark";
  try { savedMode = localStorage.getItem("svc-map-mode") || "dark"; } catch (e) { /* ignore */ }
  modeBtns.light.addEventListener("click", function () { setMapMode("light"); });
  modeBtns.dark.addEventListener("click", function () { setMapMode("dark"); });
  setMapMode(savedMode === "light" ? "light" : "dark");

  var zoom = d3.zoom()
    .scaleExtent([40, 400000])
    .on("start", function (e) { if (e.sourceEvent) canvas.classList.add("is-dragging"); hideTip(); })
    .on("zoom", function (e) { cur = e.transform; schedule(); })
    .on("end", function () { canvas.classList.remove("is-dragging"); });
  var sel = d3.select(canvas).call(zoom).on("dblclick.zoom", null);

  var raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame() { raf = 0; draw(); place(); }

  function resize() {
    var r = app.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    zoom.extent([[0, 0], [W, H]]);
    proj.clipExtent([[-20, -20], [W + 20, H + 20]]);
  }

  function visibleBounds() {
    var a = cur.invert([0, 0]), b = cur.invert([W, H]);
    var D = 180 / Math.PI;
    return { w: a[0] * D, e: b[0] * D, n: p0.invert([0, a[1]])[1], s: p0.invert([0, b[1]])[1] };
  }
  function isVisible(f, vb) {
    if (f.wraps || vb.e - vb.w >= 300) return true;
    return !(f.b[1][0] < vb.w || f.b[0][0] > vb.e || f.b[1][1] < vb.s || f.b[0][1] > vb.n);
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
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    proj.scale(cur.k).translate([cur.x, cur.y]);
    var vb = visibleBounds();
    var F = cur.k > 900 ? F50 : F110;

    ctx.beginPath(); path(graticule);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.stroke();

    var groups = {};
    var vis = [];
    F.forEach(function (f) {
      if (!isVisible(f, vb)) return;
      vis.push(f);
      var col = landColor(f);
      (groups[col] = groups[col] || []).push(f);
    });
    Object.keys(groups).forEach(function (col) {
      ctx.beginPath(); groups[col].forEach(function (f) { path(f); });
      ctx.fillStyle = col; ctx.fill();
    });
    // continent hover: light green wash that eases in
    Object.keys(regFade).forEach(function (rn) {
      var t = regFade[rn]; if (!t) return;
      var e = t * t;                       // ease-in
      ctx.beginPath(); vis.forEach(function (f) { if (f.reg === rn) path(f); });
      ctx.fillStyle = "rgba(" + C.mintRGB + "," + (C.mintA * e).toFixed(3) + ")"; ctx.fill();
    });
    ctx.beginPath(); vis.forEach(function (f) { path(f); });
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.9; ctx.stroke();

    // faint edge on every country Savoya serves, so the tint reads against the water
    ctx.beginPath(); vis.forEach(function (f) { if (f.svc) path(f); });
    ctx.strokeStyle = C.servedEdge; ctx.lineWidth = 0.8; ctx.stroke();
    // gold edge on the focused country
    if (state.country) {
      var fc = F.filter(function (f) { return f.svc === state.country; });
      ctx.beginPath(); fc.forEach(function (f) { path(f); });
      ctx.strokeStyle = C.focus; ctx.lineWidth = 1.2; ctx.stroke();
    }
    // state lines once the US is close
    if (cur.k > 500 && vb.w < -60 && vb.e > -130 && vb.n > 24 && vb.s < 50) {
      ctx.beginPath(); path(usStates);
      ctx.strokeStyle = C.states; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // service ring around the destination
    if (state.city) {
      var c = state.city, circle = d3.geoCircle().center([c.lon, c.lat]).radius(cityRadius(c)).precision(2)();
      ctx.beginPath(); path(circle);
      var cpt = proj([c.lon, c.lat]);
      var g = ctx.createRadialGradient(cpt[0], cpt[1], 0, cpt[0], cpt[1], Math.max(40, cur.k * cityRadius(c) * Math.PI / 180 * 1.2));
      g.addColorStop(0, "rgba(" + C.litRGB + ",0.10)"); g.addColorStop(1, "rgba(" + C.litRGB + ",0.02)");
      ctx.fillStyle = g; ctx.fill();
      ctx.setLineDash([3, 5]); ctx.strokeStyle = C.ring; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    }
    // every served city as a faint point (live markers sit on top where they apply)
    ctx.fillStyle = C.dot;
    cities.forEach(function (c) {
      if (domCities[c.slug]) return;
      var p = proj([c.lon, c.lat]);
      if (p[0] < -10 || p[0] > W + 10 || p[1] < -10 || p[1] > H + 10) return;
      ctx.beginPath(); ctx.arc(p[0], p[1], state.level === "world" ? 1.6 : 2.1, 0, 6.2832); ctx.fill();
    });
  }

  /* ================= Framing ================= */
  var mqPhone = window.matchMedia("(max-width: 860px)");
  function viewRect(forDock) {
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
  function boxTransform(box) {
    var a = p0(box[0]), b = p0(box[1]);
    var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    var r = viewRect();
    var k = Math.min(r.w / (x1 - x0), r.h / (y1 - y0), 400000);
    return d3.zoomIdentity.translate(r.x + r.w / 2 - k * (x0 + x1) / 2, r.y + r.h / 2 - k * (y0 + y1) / 2).scale(k);
  }
  function flyDuration(t) {
    var a = cur.invert([W / 2, H / 2]), b = t.invert([W / 2, H / 2]);
    var i = d3.interpolateZoom([a[0], a[1], W / cur.k], [b[0], b[1], W / t.k]);
    return Math.max(650, Math.min(3000, i.duration * 0.85));
  }
  var flyToken = 0;
  function inView(ll) {
    proj.scale(cur.k).translate([cur.x, cur.y]);
    var p = proj(ll), r = viewRect();
    return p && p[0] > r.x + 24 && p[0] < r.x + r.w - 24 && p[1] > r.y + 24 && p[1] < r.y + r.h - 24;
  }
  function fly(box, done, fast, instant) {
    var t = boxTransform(box), my = ++flyToken;
    sel.interrupt();
    if (reduced || instant || !W) { sel.call(zoom.transform, t); if (done) done(); return; }
    var dur = fast ? 600 : flyDuration(t);
    sel.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, t)
      .on("end", function () { if (my === flyToken && done) done(); });
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
    if (opts.openSheet) openSheet(true);
    var arrive = function () { popDest(); };
    if (!opts.instant && prevCountry === c.country && (prevLevel === "country" || prevLevel === "city") && inView(pt)) {
      sel.interrupt(); flyToken++; setTimeout(arrive, 30);   // already framed: no camera move at all
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
  function cardHtml(name, meta, cta, metaClose, c) {
    return '<button class="c-x" type="button" aria-label="Close"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3l8 8M11 3 3 11"/></svg></button><div class="c-head">' + (c ? thumbImg(c, 48, "c-thumb") : '') + '<div class="c-name">' + esc(name) + '</div></div><div class="c-meta">' + meta + '</div>' +
      (metaClose ? '<div class="c-meta c-meta-close">' + metaClose + '</div>' : '') + '<button class="c-go" type="button">' + cta +
      '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"/></svg></button>' +
      '<button class="copy" type="button" aria-label="Copy a link to this city">' + LINK_ICON + "<span>Copy link</span></button>";
  }
  var hoverEl = null, apRow = null;
  // Where dots overlap (Baltimore / Washington, Miami / Boca Raton), the one nearest the pointer wins.
  function nearestDot(x, y) {
    var best = null, bd = 18 * 18;
    markersEl.querySelectorAll(".radar:not(.is-dest)").forEach(function (el) {
      if (!el._city) return;
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
  function buildMarkers(fresh) {
    hideHover(); apRow = null;
    markersEl.textContent = ""; marks = []; domCities = {}; destEl = null; dock.hidden = true; dock.textContent = "";
    var s = state;
    if (s.level === "world") {
      regionOrder.forEach(function (r) {
        var b = el("button", "chip" + (mqPhone.matches ? " is-small" : ""), '<span class="dot"></span>' + esc(r.name) + ' <span class="n">' + r.cities.length + "</span>");
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
        addMark(b, countryAnchor(k), 2);
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
  function place() {
    proj.scale(cur.k).translate([cur.x, cur.y]);
    marks.forEach(function (m) {
      var p = proj(m.ll);
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
    // airports only show once there is room for them next to the city
    if (state.level === "city") {
      var c = state.city, cp = proj([c.lon, c.lat]), shown = [];
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

  /* ================= Browse panel ================= */
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

    list.textContent = ""; list.scrollTop = 0;
    if (s.level === "world") {
      bTitle.textContent = "Choose a region";
      bCount.textContent = cities.length + " featured markets";
      regionOrder.forEach(function (r) {
        row(r.name, "", r.countries.length + (r.countries.length === 1 ? " country · " : " countries · ") + r.cities.length, function () { goRegion(r.name); });
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
      row("View service details", "Airports, coverage and booking", "", function () { openSheet(); }, "is-primary");
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
    ["miami-fl", "MIA", [[87, .82, -.45, .1], [87, .65, -.3, -.15], [87, .58, .42, .1], [117, .7, .05, .05]]],
    ["san-francisco-ca", "SFO", [[298, 1, -.09, 0], [298, .95, .09, .02], [28, .75, -.08, -.25], [28, .7, .08, -.28]]]
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
      esc(p.airport.code) + "</em> · " + esc(p.city.label) + "</small></span>";
    b.addEventListener("click", function () {
      if (mqPhone.matches) browse.classList.remove("is-open");
      goCity(p.city, { airport: p.airport, openSheet: true });
    });
    li.appendChild(b); popList.appendChild(li);
  });

  /* ================= Canvas hover + click ================= */
  var hoverFeat = null, tip = document.getElementById("tip");
  function featAt(px, py) {
    var ll = proj.invert([px, py]);
    if (!ll) return null;
    var hit = null;
    for (var i = 0; i < F50.length; i++) {
      var f = F50[i];
      if (!f.wraps && (ll[0] < f.b[0][0] || ll[0] > f.b[1][0] || ll[1] < f.b[0][1] || ll[1] > f.b[1][1])) continue;
      if (d3.geoContains(f, ll)) { hit = f; if (f.svc) break; }
    }
    return hit;
  }
  function hideTip() { tip.hidden = true; }
  canvas.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" || canvas.classList.contains("is-dragging")) return;
    var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    proj.scale(cur.k).translate([cur.x, cur.y]);
    var f = featAt(x, y);
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
  canvas.addEventListener("pointerleave", function () { hoverFeat = null; hoverReg = null; hideTip(); kickFade(); });
  sel.on("click", function (e) {
    if (e.defaultPrevented) return;
    var r = canvas.getBoundingClientRect();
    proj.scale(cur.k).translate([cur.x, cur.y]);
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
      '<a href="' + SITE + '/service-areas" target="_blank" rel="noopener">Request a city</a>' +
      '<button type="button" aria-label="Dismiss">✕</button>';
    toastEl.hidden = false;
    toastEl.querySelector("button").onclick = function () { toastEl.hidden = true; };
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, 5200);
  }

  /* ================= Sheet ================= */
  var sheet = document.getElementById("sheet");
  var STATS = [["61%", "of Fortune 100 companies"], ["99.5%", "of trips executed without issue"], ["300+", "service areas across six continents"], ["7,200+", "chauffeurs on the platform"]];
  var lastFocus = null, lastSheetKey = null;
  function openSheet(noReframe) {
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
      '<footer class="sh-foot"><a class="btn btn-primary" href="' + BOOK + '" target="_blank" rel="noopener">Book Now</a>' +
      '<a class="btn btn-ghost" href="' + SITE + "/service-areas/" + c.slug + '" target="_blank" rel="noopener">Learn more<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/></svg></a></footer>';

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
      if (noReframe !== true) reframe();
    }
    var on = sheet.querySelector(".ap-list li.is-on");
    if (on) on.scrollIntoView({ block: "center" });
  }
  function closeSheet(silent) {
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
    var p = proj(ll), r = viewRect();
    var t = d3.zoomIdentity.translate(cur.x + (r.x + r.w / 2 - p[0]), cur.y + (r.y + r.h / 2 - p[1])).scale(cur.k);
    sel.interrupt(); flyToken++;
    sel.transition().duration(reduced ? 0 : 520).ease(d3.easeCubicOut).call(zoom.transform, t);
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
        '<a class="nm-cta" href="' + SITE + '/service-areas" target="_blank" rel="noopener">Request this city<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"/></svg></a>';
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
  function zoomBy(f) { var r = viewRect(); sel.transition().duration(reduced ? 0 : 350).call(zoom.scaleBy, f, [r.x + r.w / 2, r.y + r.h / 2]); }
  document.getElementById("zin").addEventListener("click", function () { zoomBy(1.8); });
  document.getElementById("zout").addEventListener("click", function () { zoomBy(1 / 1.8); });
  document.getElementById("zworld").addEventListener("click", goWorld);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.activeElement !== q) up();
  });

  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      resize(); placeDock();
      var s = state, box = s.level === "world" ? WORLD_BOX : s.level === "region" ? REG[s.region].box : s.level === "country" ? countryBox(s.country) :
        cityFrame(s.city);
      sel.interrupt(); sel.call(zoom.transform, boxTransform(box));
    }, 120);
  });

  /* ================= Boot ================= */
  resize();
  render(false);
  sel.call(zoom.transform, boxTransform(WORLD_BOX));
  if (location.hash.length > 1) applyToken(location.hash, true);

  // test hook for the prototype review
  window.__svc = { goCity: function (s, o) { goCity(bySlug[s], o); }, goRegion: goRegion, goCountry: goCountry, goWorld: goWorld, openSheet: openSheet, state: function () { return state; },
    zoomOn: function (f) { proj.scale(cur.k).translate([cur.x, cur.y]); var c = state.city, p = proj([c.lon, c.lat]); sel.interrupt(); sel.call(zoom.scaleBy, f, p); } };
})();
