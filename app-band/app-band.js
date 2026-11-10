/* ==========================================================
   APP BAND: animated city background (Savoya App section)
   Draws the Figma "City blocks + route" artwork as SVG inside
   every .app-band and plays it once when the band scrolls into view:
     1. Buildings rise: each shadow lands, then the block lifts out of it,
        spreading out from where the route enters.
     2. A copper light drives the route through the streets.
     3. On arrival the radar fires a shockwave and every block lights up
        copper in a cascade, nearest first, then settles with a warm afterglow.
   Reduced motion: the finished frame, no movement.
   The band's CSS background image stays as the no-JS fallback;
   this script hides it once the SVG is in place.
   Geometry: 1280x480 frame. Blocks are [isFace, cx, cy, size, opacity],
   rotated -30deg (Figma +30). Route runs in street gaps, 6px clear.
   ========================================================== */
(function () {
  if (window.SavoyaAppBand) return;

  var SQ = [[0,-43.3,488.4,55,0.45],[0,-53.1,318.6,57,0.45],[0,-18.6,382.3,56,0.45],[1,-32.6,373.1,56,0.078],[0,25.4,450.5,62,0.45],[1,9.5,440,62,0.056],[0,58.4,514.6,56,0.45],[1,43.4,504.7,56,0.032],[0,-32,210,58,0.45],[1,-41.4,203.8,58,0.056],[0,11.4,280.2,55,0.45],[1,-5.4,269.1,55,0.03],[0,77.1,405.1,55,0.45],[1,70.6,400.7,55,0.044],[0,123.5,476.4,55,0.45],[1,108.6,466.6,55,0.062],[1,145.2,532,53,0.061],[0,-41,41.4,57,0.45],[1,-52.2,34,57,0.06],[0,4.4,112.2,57,0.45],[1,-14.2,99.8,57,0.073],[0,44.7,179,59,0.45],[1,25.1,166,59,0.067],[0,83.4,245,60,0.45],[1,63.8,232,60,0.076],[0,114.7,307.1,57,0.45],[1,99.8,297.3,57,0.075],[0,150.6,371.3,58,0.45],[1,138.5,363.3,58,0.069],[0,189.1,438,56,0.45],[1,175.1,428.7,56,0.03],[0,225.5,503,55,0.45],[1,212.4,494.4,55,0.032],[0,23.5,1.2,62,0.45],[1,17,-3.1,62,0.066],[0,64.9,70.9,56,0.45],[1,50.9,61.7,56,0.077],[0,140.6,201,61,0.45],[1,130.3,194.2,61,0.046],[0,176.5,265.1,62,0.45],[1,169,260.2,62,0.056],[0,219.4,334.5,61,0.45],[1,206.3,325.8,61,0.061],[0,253.8,400.1,53,0.45],[1,238.9,390.2,53,0.066],[0,286.4,461.5,56,0.45],[1,278.9,456.6,56,0.049],[0,327.1,528,60,0.45],[1,319.6,523.1,60,0.05],[0,95.3,-30.4,53,0.45],[1,76.7,-42.7,53,0.071],[0,129.1,32.1,55,0.45],[1,116,23.5,55,0.061],[0,207.1,164.3,58,0.45],[1,194.1,155.7,58,0.056],[0,243.8,229.7,56,0.45],[1,230.7,221.1,56,0.066],[0,273,290.3,54,0.45],[1,267.4,286.6,54,0.032],[0,313.1,357.7,53,0.45],[1,304.7,352.2,53,0.03],[0,360.9,427.7,62,0.45],[1,348.8,419.7,62,0.064],[0,401.8,496.5,58,0.45],[1,384.1,484.7,58,0.032],[0,237.8,62.3,58,0.45],[1,221.9,51.8,58,0.062],[0,269.2,122.7,62,0.45],[1,262.6,118.4,62,0.051],[0,314.3,194.8,56,0.45],[1,296.5,183.1,56,0.076],[0,344.1,255.5,55,0.45],[1,333.9,248.7,55,0.064],[0,384.9,323.2,55,0.45],[1,371.9,314.6,55,0.062],[0,418.7,385.7,57,0.45],[1,411.2,380.7,57,0.074],[0,461.5,453.9,60,0.45],[1,451.3,447.1,60,0.037],[0,499.5,519.7,60,0.45],[1,489.3,512.9,60,0.074],[0,268,-39.4,56,0.45],[1,248.4,-52.3,56,0.065],[0,300.9,23.6,54,0.45],[1,285,13.1,54,0.073],[0,383.3,158.4,58,0.45],[1,363.7,145.5,58,0.038],[0,415.5,220.1,59,0.45],[1,402.4,211.5,59,0.053],[0,491.4,352.4,62,0.45],[1,479.3,344.4,62,0.035],[0,568.9,484.9,57,0.45],[1,553,474.4,57,0.072],[0,367.5,-14.9,58,0.45],[1,353.5,-24.2,58,0.03],[0,400.3,48.7,53,0.45],[1,388.1,40.7,53,0.066],[0,444.4,116.2,62,0.45],[1,432.3,108.2,62,0.052],[0,478.3,180,58,0.45],[1,467.1,172.6,58,0.041],[0,553.5,308.9,55,0.45],[1,544.2,302.8,55,0.079],[0,604.3,381.8,60,0.45],[1,585.6,369.5,60,0.061],[0,638.2,446.6,54,0.45],[1,619.5,434.2,54,0.051],[0,668.7,506.3,58,0.45],[1,660.3,500.8,58,0.067],[0,466.4,9.4,59,0.45],[1,458,3.8,59,0.059],[0,499.8,73.2,55,0.45],[1,493.3,68.9,55,0.075],[0,546.2,142.5,55,0.45],[1,529.4,131.4,55,0.065],[0,578.7,209.8,54,0.45],[1,571.2,204.9,54,0.055],[0,616.6,272.5,55,0.45],[1,607.3,266.4,55,0.048],[0,656,338.7,57,0.45],[1,646.7,332.6,57,0.062],[0,694,404.5,57,0.45],[1,684.7,398.4,57,0.075],[0,742.5,476.5,60,0.45],[1,724.7,464.7,60,0.078],[0,771.8,536.3,61,0.45],[1,763.4,530.7,61,0.036],[0,527,-30.8,54,0.45],[1,520.4,-35.1,54,0.074],[0,574,39.7,59,0.45],[1,561.9,31.7,59,0.045],[0,609.9,102.8,60,0.45],[1,599.6,96.1,60,0.05],[0,651.2,174.2,61,0.45],[1,641.8,168.1,61,0.078],[0,691.2,238.7,61,0.45],[1,677.2,229.5,61,0.058],[0,718.3,298.7,56,0.45],[1,711.8,294.4,56,0.076],[0,769.3,372,60,0.45],[1,752.5,360.9,60,0.077],[0,835.6,498.9,54,0.45],[1,824.4,491.5,54,0.046],[0,632.2,-2.6,56,0.45],[1,625.6,-6.9,56,0.036],[0,712.4,134.4,57,0.45],[1,704.9,129.4,57,0.061],[0,749.6,195.8,61,0.45],[1,743,191.5,61,0.038],[0,797,268.9,57,0.45],[1,778.3,256.6,57,0.067],[0,827.4,328.7,61,0.45],[1,819,323.1,61,0.04],[0,873.4,400.3,59,0.45],[1,855.7,388.6,59,0.04],[0,904,462.3,55,0.45],[1,890.9,453.7,55,0.034],[0,941,526.4,59,0.45],[1,931.7,520.2,59,0.046],[0,709.5,-34.6,62,0.45],[1,695.5,-43.8,62,0.044],[0,775.2,92.1,55,0.45],[1,766.8,86.6,55,0.064],[0,827.5,165.8,61,0.45],[1,808.9,153.5,61,0.071],[0,854.9,226.2,55,0.45],[1,842.8,218.2,55,0.057],[0,887.3,288.3,55,0.45],[1,880.8,284,55,0.065],[0,925.5,354.6,54,0.45],[1,918.1,349.6,54,0.078],[0,964.7,421.4,53,0.45],[1,955.4,415.3,53,0.046],[0,1012.4,492.1,59,0.45],[1,997.5,482.2,59,0.079],[0,810.2,-7.2,56,0.45],[1,795.3,-17.1,56,0.061],[0,840.7,53.7,56,0.45],[1,833.3,48.7,56,0.042],[0,890.5,125.9,61,0.45],[1,874.7,115.5,61,0.062],[0,917,185.7,55,0.45],[1,908.6,180.2,55,0.058],[0,968.4,258.8,61,0.45],[1,950.7,247.1,61,0.065],[0,1001.6,322.2,58,0.45],[1,986.6,312.4,58,0.072],[0,1031.2,382.5,58,0.45],[1,1024.6,378.2,58,0.071],[0,1072.9,450.8,58,0.45],[1,1062.6,444,58,0.038],[0,1119,521.7,59,0.45],[1,1101.3,510,59,0.037],[0,870.2,-49.3,57,0.45],[1,861.8,-54.9,57,0.065],[0,905.2,15.3,54,0.45],[1,897.7,10.4,54,0.08],[0,952.9,85.9,60,0.45],[1,939.8,77.3,60,0.067],[0,990.8,153.5,53,0.45],[1,973,141.8,53,0.032],[0,1026.6,216.6,58,0.45],[1,1014.4,208.6,58,0.03],[0,1065.7,282.3,61,0.45],[1,1054.5,274.9,61,0.066],[0,1103.8,350.4,53,0.45],[1,1087,339.3,53,0.036],[0,1135,411.4,54,0.45],[1,1125.7,405.3,54,0.071],[0,1186,483.7,62,0.45],[1,1169.2,472.6,62,0.068],[1,1201,536.7,53,0.033],[0,979.1,-17.6,55,0.45],[1,964.2,-27.4,55,0.041],[0,1021.1,51.1,54,0.45],[1,1001.5,38.2,54,0.054],[0,1092.4,178.6,58,0.45],[1,1080.3,170.6,58,0.055],[0,1121.8,239.5,55,0.45],[1,1116.2,235.8,55,0.038],[0,1207.1,376.2,59,0.45],[1,1194.9,368.2,59,0.042],[0,1250.4,445.3,60,0.45],[1,1233.6,434.2,60,0.044],[0,1283.3,508.3,58,0.45],[1,1270.3,499.7,58,0.044],[0,1043.2,-58.6,62,0.45],[0,1086.4,11.2,60,0.45],[1,1071.5,1.3,60,0.076],[0,1122,74.9,62,0.45],[1,1110.8,67.5,62,0.076],[0,1153.4,138.2,55,0.45],[1,1144,132,55,0.063],[0,1198.8,208.9,55,0.45],[1,1182,197.8,55,0.031],[0,1241.9,276.5,61,0.45],[1,1224.1,264.7,61,0.056],[0,1273.1,338.6,58,0.45],[1,1260.1,330,58,0.036],[0,1301.6,399,55,0.45],[1,1296,395.3,55,0.039],[1,1335.4,461.5,57,0.074],[0,1145.4,-31.6,61,0.45],[1,1138,-36.5,61,0.067],[0,1259.4,165.9,61,0.45],[1,1252,160.9,61,0.061],[0,1296.6,233.3,53,0.45],[1,1284.5,225.3,53,0.041],[0,1257.9,2.2,60,0.45],[1,1241.1,-8.9,60,0.061],[0,1281.3,59.7,55,0.45],[1,1275.7,56,55,0.046],[0,1332.6,134.6,54,0.45],[1,1313,121.6,54,0.034],[0,1324.1,-36,62,0.45],[1,1308.3,-46.5,62,0.079]];
  var ROUTE = [[653.7,559.5],[463.0,229.2],[662.2,114.2]];
  var DOT = [662.2,114.2];
  var NS = "http://www.w3.org/2000/svg";
  var COPPER = "#dd9058", GOLD = "#f5ad59", INK = "#141313";

  var css =
    ".app-band-city{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block}" +
    ".app-band-city .ab-shadow{fill:#000;fill-opacity:.45}" +
    ".app-band-city .ab-face{fill:#fff}" +
    ".app-band-city .ab-route{fill:none;stroke:" + COPPER + ";stroke-width:3;stroke-linejoin:round}" +
    ".app-band-city .ab-ping{fill:none;stroke:" + COPPER + ";stroke-width:1.5;transform-box:fill-box;transform-origin:center;opacity:0}" +
    ".app-band-city .ab-halo,.app-band-city .ab-dot{transform-box:fill-box;transform-origin:center}" +
    ".app-band-city.ab-anim .ab-shadow{opacity:0;transition:opacity .4s ease var(--d)}" +
    ".app-band-city.ab-anim .ab-face{opacity:0;transition:opacity .25s ease var(--d)}" +
    ".app-band-city.ab-anim .ab-lift{transform:translate(var(--sx),var(--sy));transition:transform .8s cubic-bezier(.2,.8,.2,1.15) calc(var(--d) + 120ms)}" +
    ".app-band-city.ab-anim.ab-play .ab-shadow,.app-band-city.ab-anim.ab-play .ab-face{opacity:1}" +
    ".app-band-city.ab-anim.ab-play .ab-lift{transform:none}" +
    ".app-band-city.ab-anim .ab-halo,.app-band-city.ab-anim .ab-dot{opacity:0;transform:scale(.3)}" +
    ".app-band-city.ab-arrived .ab-halo,.app-band-city.ab-arrived .ab-dot{opacity:1;transform:none;transition:opacity .35s ease,transform .5s cubic-bezier(.3,1.6,.5,1)}" +
    ".app-band-city.ab-arrived .ab-ping{animation:abPing 2.4s ease-out infinite}" +
    ".app-band-city.ab-arrived .ab-ping.p2{animation-delay:.8s}" +
    ".app-band-city.ab-arrived .ab-ping.p3{animation-delay:1.6s}" +
    "@keyframes abPing{0%{opacity:.75;transform:scale(.4)}100%{opacity:0;transform:scale(3.2)}}" +
    ".app-band>*:not(.app-band-city){position:relative;z-index:1}" +
    ".app-band .app-devices{position:absolute}" +
    "@media (max-width:991px){.app-band .app-devices{position:relative}}";

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function block(q, cls, parent) {
    var x = q[1], y = q[2], w = q[3];
    var r = el("rect", {
      x: x - w / 2, y: y - w / 2, width: w, height: w, rx: w * 0.05,
      transform: "rotate(-30 " + x + " " + y + ")", "class": cls
    }, parent);
    if (cls === "ab-face") r.setAttribute("fill-opacity", q[4]);
    return r;
  }

  // Route length helpers
  var segLen = [], total = 0;
  for (var i = 1; i < ROUTE.length; i++) {
    var l = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]);
    segLen.push(l); total += l;
  }
  function at(t) {
    var d = t * total;
    for (var i = 0; i < segLen.length; i++) {
      if (d <= segLen[i]) {
        var k = d / segLen[i];
        return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * k, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * k];
      }
      d -= segLen[i];
    }
    return ROUTE[ROUTE.length - 1];
  }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function build(band, uid) {
    var svg = el("svg", {
      viewBox: "0 0 1280 480", preserveAspectRatio: "xMidYMid slice",
      "class": "app-band-city", "aria-hidden": "true", focusable: "false"
    });
    svg.innerHTML =
      '<defs>' +
      '<linearGradient id="abL' + uid + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + INK + '" stop-opacity=".92"/><stop offset=".42" stop-color="' + INK + '" stop-opacity=".35"/><stop offset=".7" stop-color="' + INK + '" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="abR' + uid + '" cx=".35" cy=".45" r=".8"><stop offset=".35" stop-color="' + INK + '" stop-opacity="0"/><stop offset="1" stop-color="' + INK + '" stop-opacity=".85"/></radialGradient>' +
      '<radialGradient id="abG' + uid + '"><stop offset="0" stop-color="' + GOLD + '"/><stop offset=".35" stop-color="' + COPPER + '" stop-opacity=".55"/><stop offset="1" stop-color="' + COPPER + '" stop-opacity="0"/></radialGradient>' +
      '</defs>';

    var city = el("g", {}, svg), faces = [];
    var rx = ROUTE[0][0], ry = Math.min(ROUTE[0][1], 520);
    for (var i = 0; i < SQ.length; i++) {
      var s = null, f = null;
      if (SQ[i][0] === 0) {
        s = SQ[i];
        if (SQ[i + 1] && SQ[i + 1][0] === 1 && SQ[i + 1][3] === s[3]) { f = SQ[i + 1]; i++; }
      } else f = SQ[i];
      var ref = f || s;
      var d = Math.round(Math.hypot(ref[1] - rx, ref[2] - ry) * 0.95) + "ms";
      var g = el("g", {}, city);
      if (s) block(s, "ab-shadow", g).style.setProperty("--d", d);
      if (f) {
        var lift = el("g", { "class": "ab-lift" }, g);
        lift.style.setProperty("--d", d);
        lift.style.setProperty("--sx", (s ? s[1] - f[1] : 12) + "px");
        lift.style.setProperty("--sy", (s ? s[2] - f[2] : 8) + "px");
        var face = block(f, "ab-face", lift);
        face.style.setProperty("--d", d);
        face._base = f[4];
        face._dist = Math.hypot(f[1] - DOT[0], f[2] - DOT[1]);
        faces.push(face);
      }
    }

    var pts = ROUTE.map(function (p) { return p.join(","); }).join(" ");
    var route = el("polyline", { points: pts, "class": "ab-route", pathLength: "1" }, svg);
    var radar = el("g", {}, svg);
    radar.innerHTML =
      ['', ' p2', ' p3'].map(function (c) { return '<circle class="ab-ping' + c + '" cx="' + DOT[0] + '" cy="' + DOT[1] + '" r="11"/>'; }).join("") +
      '<circle class="ab-halo" cx="' + DOT[0] + '" cy="' + DOT[1] + '" r="20" fill="' + COPPER + '" fill-opacity=".18"/>' +
      '<circle class="ab-halo" cx="' + DOT[0] + '" cy="' + DOT[1] + '" r="11" fill="' + COPPER + '" fill-opacity=".35"/>' +
      '<circle class="ab-dot" cx="' + DOT[0] + '" cy="' + DOT[1] + '" r="6" fill="' + COPPER + '" stroke="' + INK + '" stroke-width="2"/>';
    var head = el("circle", { r: 22, fill: "url(#abG" + uid + ")" }, svg);
    head.style.opacity = 0;
    el("rect", { width: 1280, height: 480, fill: "url(#abL" + uid + ")" }, svg);
    el("rect", { width: 1280, height: 480, fill: "url(#abR" + uid + ")" }, svg);

    band.insertBefore(svg, band.firstChild);
    band.style.backgroundImage = "none";
    return { svg: svg, route: route, head: head, faces: faces };
  }

  function lightUp(st) {
    var ring = el("circle", {
      cx: DOT[0], cy: DOT[1], r: 10, fill: "none", stroke: GOLD,
      "stroke-width": 2, "vector-effect": "non-scaling-stroke"
    });
    ring.style.transformBox = "fill-box"; ring.style.transformOrigin = "center";
    st.svg.insertBefore(ring, st.head);
    ring.animate([{ transform: "scale(1)", opacity: .9 }, { transform: "scale(140)", opacity: 0 }],
      { duration: 1900, easing: "cubic-bezier(.2,.6,.3,1)", fill: "forwards" }).onfinish = function () { ring.remove(); };
    st.faces.forEach(function (f) {
      var b = f._base;
      f.animate([
        { fill: "#ffffff", fillOpacity: b },
        { fill: GOLD, fillOpacity: Math.min(.6, b + .42), offset: .18 },
        { fill: COPPER, fillOpacity: b + .16, offset: .45 },
        { fill: "#ffffff", fillOpacity: b + .018 }
      ], { duration: 1800, delay: 120 + f._dist * 0.95, easing: "cubic-bezier(.25,.8,.3,1)", fill: "forwards" });
    });
  }

  function play(st) {
    st.svg.classList.add("ab-play");
    st.route.setAttribute("stroke-dasharray", "0 1");
    var t0 = performance.now() + 1500, dur = 1500;
    function tick(now) {
      var k = Math.min(1, Math.max(0, (now - t0) / dur)), e = ease(k);
      st.route.setAttribute("stroke-dasharray", e + " 1");
      var p = at(e);
      st.head.setAttribute("cx", p[0]); st.head.setAttribute("cy", p[1]);
      st.head.style.opacity = (k > 0 && k < 1) ? 1 : 0;
      if (k < 1) requestAnimationFrame(tick);
      else { st.svg.classList.add("ab-arrived"); lightUp(st); }
    }
    requestAnimationFrame(tick);
  }

  function init() {
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var bands = document.querySelectorAll(".app-band");
    bands.forEach(function (band, i) {
      if (band.querySelector(".app-band-city")) return;
      var st = build(band, i);
      if (reduce || !("IntersectionObserver" in window) || !Element.prototype.animate) {
        st.svg.classList.add("ab-arrived");
        return;
      }
      st.svg.classList.add("ab-anim");
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { io.disconnect(); play(st); }
        });
      }, { threshold: 0.35 });
      io.observe(band);
    });
  }

  window.SavoyaAppBand = { init: init };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
