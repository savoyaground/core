// Production build: scoped CSS + self-loading JS for the Webflow Service Areas page.
// Output: prod/out/service-map.css, prod/out/service-map.js (+ copies data and thumbs)
const fs = require("fs"), path = require("path");
const postcss = require("postcss"), prefixer = require("postcss-prefix-selector");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(path.join(ROOT, "src/app.html"), "utf8");
let js = fs.readFileSync(path.join(ROOT, "src/app.js"), "utf8");
let css = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));
let markup = html.slice(html.indexOf('<div class="app" id="app">'), html.indexOf("<script"));

/* ---------- Renames: classes that collide with savoya.com styles, and every id ---------- */
const CLS = ["btn-primary", "btn-ghost", "btn", "card", "is-open", "left", "list", "pop", "quote", "row", "stats"];
const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const ID = (s) => "svm-" + s;

// markup
markup = markup.replace(/class="([^"]*)"/g, (m, v) => 'class="' + v.split(/\s+/).map((c) => (CLS.includes(c) ? "svm-" + c : c)).join(" ") + '"');
markup = markup.replace(/\s(id|for|aria-controls|aria-labelledby)="([^"]+)"/g, (m, a, v) =>
  " " + a + '="' + v.split(/\s+/).map((x) => (ids.includes(x) ? ID(x) : x)).join(" ") + '"');
markup = markup.replace(/>\s+</g, "><").trim();

// css: class + id selectors
const clsRe = new RegExp("\\.(" + CLS.map((c) => c.replace("-", "\\-")).join("|") + ")(?![\\w-])", "g");
css = css.replace(clsRe, ".svm-$1");
ids.forEach((id) => { css = css.replace(new RegExp("#" + id + "(?![\\w-])", "g"), "#" + ID(id)); });
// page-level rules become rules on the mount
css = css.replace(/html,\s*body\s*\{[^}]*\}/, "");
css = css.replace(/\nbody\s*\{([^}]*)\}/, (m, b) => "\n:root {" + b.replace(/overflow:\s*hidden;?/, "") + "}");

/* ---------- JS ---------- */
let applied = 0;
function rep(a, b, all) {
  if (!js.includes(a)) throw new Error("missing: " + a.slice(0, 80));
  js = all ? js.split(a).join(b) : js.replace(a, b); applied++;
}
// data comes from the JSON feed (Webflow CMS export)
const dataSrc = fs.readFileSync(path.join(ROOT, "src/data.js"), "utf8");
const sandbox = {}; new Function("window", dataSrc)(sandbox);
const REG = sandbox.SVC_REGIONS;
REG["North America"].box = [[-127, 7], [-57, 55]]; // reach Barbados
rep('var SITE = "https://www.savoya.com";',
  'var SITE = /(^|\\.)savoya\\.com$|\\.webflow\\.io$/.test(location.hostname) ? location.origin : "https://www.savoya.com";');
rep("var REG = window.SVC_REGIONS;", "var REG = " + JSON.stringify(REG) + ";");
rep("var MAPNAME = window.SVC_MAPNAME || {};", "var MAPNAME = " + JSON.stringify(require("./mapname.json")) + ";");
js = js.replace(/var cities = window\.SVC_ROWS\.map\(function \(r\) \{[\s\S]*?\n  \}\);\n/, () => { applied++; return (
`var cities = DATA.map(function (r) {
    return {
      name: r.c, region: r.r, country: r.co, state: r.st, slug: r.s, lat: r.la, lon: r.lo, featured: false,
      airports: r.a.map(function (a) { return { code: a.code, name: a.name, lat: a.la != null ? a.la : null, lon: a.lo != null ? a.lo : null, slug: a.sl || null }; }),
      nearby: r.nb, label: r.n
    };
  });
`); });
rep('function readTopo(id) { return JSON.parse(document.getElementById(id).textContent); }\n', "");
rep('var t110 = readTopo("topo110"), t50 = readTopo("topo50"), tUS = readTopo("topoUS");', "var t110 = TOPO.w110, tUS = TOPO.us;");
rep("var F110 = feats(t110), F50 = feats(t50);", "var F110 = feats(t110), F50 = F110;");
rep("(window.SVC_CONT || {})[f.id]", "CONT[f.id]");
rep("var THUMBS = window.SVC_THUMBS || {};", "");
rep("/(^|\\.)savoya\\.com$/.test(location.hostname)", "/(^|\\.)savoya\\.com$|\\.webflow\\.io$/.test(location.hostname)");

// ids
ids.forEach((id) => {
  const a = 'getElementById("' + id + '")';
  if (js.includes(a)) js = js.split(a).join('getElementById("' + ID(id) + '")');
});
rep('getElementById("ico-" + k)', 'getElementById("svm-ico-" + k)', true);
// classes used from JS
rep('el("button", "row " + ', 'el("button", "svm-row " + ');
rep('"row is-ap"', '"svm-row is-ap"');
rep('"is-open"', '"svm-is-open"', true);
rep('el("button", "pop")', 'el("button", "svm-pop")');
rep('class="stats"', 'class="svm-stats"');
rep('class="quote"', 'class="svm-quote"');
rep('class="btn btn-primary"', 'class="svm-btn svm-btn-primary"');
rep('class="btn btn-ghost"', 'class="svm-btn svm-btn-ghost"');
rep('document.querySelector(".topbar")', 'document.querySelector(".svm .topbar")');
// internal links open in the same tab
js = js.split("\n").map((l) => (l.includes("SITE +") && !l.includes("Learn more") ? l.split(' target="_blank" rel="noopener"').join("") : l)).join("\n"); // Book Now and Learn more keep a new tab

// wheel zooms the map. Hand-off at the edge: zoomed all the way out to the globe, scrolling down moves the page
// (to the footer); while the page is scrolled away from the map, the wheel scrolls the page back first.
rep(`  var zoom = d3.zoom()
    .scaleExtent([40, 400000])`,
`  function mapInView() { var r = app.getBoundingClientRect(); return r.top >= -2 && r.bottom <= window.innerHeight + 2; }
  function atGlobe() { return cur.k <= boxTransform(WORLD_BOX).k * 1.02; }
  var zoom = d3.zoom()
    .scaleExtent([40, 400000])
    .filter(function (e) {
      if (e.type === "wheel") {
        if (e.ctrlKey) return true;                        // trackpad pinch: always the map
        if (!mapInView()) return false;                    // page is scrolled: let it scroll back
        if (e.deltaY > 0 && atGlobe()) return false;       // fully zoomed out: hand off to the page
        return true;
      }
      return !e.ctrlKey && !e.button;
    })`);
rep(`  if (location.hash.length > 1) applyToken(location.hash, true);`,
`  if (location.hash.length > 1) applyToken(location.hash, true);
  TOPO.load50(function (t) { F50 = feats(t); schedule(); });`);
// drop the prototype test hook
js = js.replace(/\n  \/\/ test hook for the prototype review[\s\S]*?\n\}\)\(\);\s*$/, () => { applied++; return "\n};\n"; });
js = js.replace(/^\(function \(\) \{\n  "use strict";/, () => { applied++; return 'window.SavoyaServiceMap = function (DATA, TOPO, CONT, THUMBS) {\n  "use strict";'; });
if (!js.startsWith("window.SavoyaServiceMap")) throw new Error("wrap failed");

/* ---------- Production-only CSS ---------- */
// site typeface (General Sans) in place of the prototype's Inter, which savoya.com does not load
css = css.replace(/--font:\s*"Inter",/, '--font: "Generalsans", "Inter",');
css += `
/* ---------- Webflow mount ---------- */
:root { position: relative; display: block; height: calc(100svh - var(--svm-top, 0px)); min-height: 560px;
  background: #0B0B0C; overflow: hidden; isolation: isolate; }
:root.is-error .svm-loading i { display: none; }
.app { height: 100%; }
.svm-loading { position: absolute; inset: 0; display: grid; place-items: center; z-index: 50; pointer-events: none;
  transition: opacity 400ms var(--ease); }
.svm-loading i { width: 10px; height: 10px; border-radius: 50%; background: #F6CB4F; box-shadow: 0 0 0 0 rgba(246, 203, 79, 0.6);
  animation: svm-wait 1.4s ease-out infinite; }
@keyframes svm-wait { to { box-shadow: 0 0 0 26px rgba(246, 203, 79, 0); } }
.svm-loading p { margin: 64px 0 0; position: absolute; font-size: 13px; color: #8E8B85; }
:root:not(.is-ready) .app > :not(canvas) { visibility: hidden; }
:root.is-ready .svm-loading { opacity: 0; }
@media (max-width: 860px) { :root { height: calc(100svh - var(--svm-top, 0px) - 56px); min-height: 520px; } }
`;
markup = '<div class="svm-loading" aria-hidden="true"><i></i><p>Loading map</p></div>' + markup;

/* ---------- Scope every selector under .svm, rename keyframes ---------- */
const kf = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
css = css.replace(/@keyframes\s+([\w-]+)/g, (m, n) => "@keyframes svm-" + n);
css = css.replace(/((?:-webkit-)?animation(?:-name)?\s*:\s*)([^;}]+)/g, (m, p, v) =>
  p + v.replace(/[\w-]+/g, (w) => (kf.includes(w) ? "svm-" + w : w)));
const scoped = postcss([
  prefixer({
    prefix: ".svm",
    transform(prefix, sel, prefixed) {
      if (sel.startsWith(":root")) return ".svm" + sel.slice(5);
      if (sel === "*" || sel.startsWith("*")) return ".svm " + sel;
      return prefixed;
    }
  })
]).process(css, { from: undefined }).css;

// Isolation: put every element (except SVG internals) back on browser defaults, which is what the
// design was built against, so Webflow's h1/p/ul/label/blockquote rules can't leak in.
// :where() keeps this at the specificity of .svm alone, so every rule below still wins.
const RESET = `/* Savoya service map. Scoped under .svm; built from the approved prototype. */
.svm :where(:not(svg, svg *, .svm-loading, .svm-loading *)) { all: revert; }
.svm [hidden] { display: none !important; }
`;
fs.writeFileSync(path.join(OUT, "service-map.css"), RESET + scoped.trim() + "\n");

/* ---------- Loader ---------- */
const CONT = fs.readFileSync(path.join(ROOT, "src/continents.json"), "utf8").trim();
const loader = `/* Savoya service map: interactive map of every service area.
   Mount: <div id="svc-map"></div> plus service-map.css. Data: service-areas.json (Webflow CMS export).
   Libraries (d3, topojson-client) and map shapes (world-atlas, us-atlas) load from jsDelivr on demand. */
(function () {
  "use strict";
  if (window.__svmBooted) return;
  var me = document.currentScript;
  var BASE = me && me.src ? me.src.replace(/[^/]*$/, "") : "";
  var LIB = {
    d3: "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
    topojson: "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js"
  };
  var SHAPES = {
    w110: "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json",
    w50: "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json",
    us: "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json"
  };
  var CONT = ${CONT};
  var MARKUP = ${JSON.stringify(markup)};

  function lib(name) {
    if (window[name]) return Promise.resolve();
    return new Promise(function (ok, fail) {
      var s = document.createElement("script"); s.src = LIB[name]; s.async = true;
      s.onload = ok; s.onerror = function () { fail(new Error("Could not load " + name)); };
      document.head.appendChild(s);
    });
  }
  function json(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status + " " + u); return r.json(); }); }

  // Fill the viewport below whatever sits above the map (nav, banners)
  function fit(mount) {
    var top = mount.getBoundingClientRect().top + (window.scrollY || 0);
    mount.style.setProperty("--svm-top", Math.max(0, Math.min(top, 240)) + "px");
  }

  function boot() {
    var mount = document.getElementById("svc-map");
    if (!mount || window.__svmBooted) return;
    window.__svmBooted = true;
    var base = mount.getAttribute("data-base") || BASE;
    mount.classList.add("svm");
    mount.innerHTML = MARKUP;
    fit(mount);
    window.addEventListener("resize", function () { fit(mount); });
    var data = json(base + "service-areas.json");
    var shapes = Promise.all([json(SHAPES.w110), json(SHAPES.us)]);
    lib("d3").then(function () { return lib("topojson"); })
      .then(function () { return Promise.all([data, shapes]); })
      .then(function (r) {
        var thumbs = {};
        r[0].forEach(function (c) { thumbs[c.s] = base + "thumbs/" + c.s + ".webp"; });
        window.SavoyaServiceMap(r[0], {
          w110: r[1][0], us: r[1][1],
          load50: function (cb) { json(SHAPES.w50).then(cb).catch(function () { /* stay on 110m outlines */ }); }
        }, CONT, thumbs);
        requestAnimationFrame(function () { mount.classList.add("is-ready"); });
      })
      .catch(function (e) {
        console.error("[service-map]", e);
        mount.classList.add("is-error");
        var p = mount.querySelector(".svm-loading p");
        if (p) p.textContent = "The map could not load. The full list of service areas is below.";
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
`;
fs.writeFileSync(path.join(OUT, "service-map.js"), loader + "\n" + js);
fs.copyFileSync(path.join(__dirname, "service-areas.json"), path.join(OUT, "service-areas.json"));
console.log("applied", applied, "| ids", ids.length, "| keyframes", kf.length);
console.log("css", fs.statSync(path.join(OUT, "service-map.css")).size, "js", fs.statSync(path.join(OUT, "service-map.js")).size);
