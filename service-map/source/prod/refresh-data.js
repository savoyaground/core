#!/usr/bin/env node
/*
  Refresh the service map's city data from the Webflow CMS.

  Rebuilds service-map/service-areas.json from the live (published) Service Areas
  and Airports collections, keeping the coordinates we already have for airports
  and surrounding towns.

  Usage (from the repo root, Node 18+):
    WEBFLOW_TOKEN=xxxx node service-map/source/prod/refresh-data.js            # write the file
    WEBFLOW_TOKEN=xxxx node service-map/source/prod/refresh-data.js --dry-run  # report only
    (--force allows removing more than 10 cities in one run; the guard stops a bad API response from emptying the map)

  The token needs read access to CMS (Webflow: Site settings > Apps & integrations > API access).
  Never commit the token.

  After it runs: check the report, add thumbnails for any new cities (thumbs/<slug>.webp, 288x288),
  commit + push, then pin the new commit hash in the Service Areas page code.

  Rules:
  - A city is on the map when it is published and "Hide Service Area" is off.
  - Airports: the city's "Airport (Reference)" list, in that order. Cities without it keep
    their current airports (or fall back to the old "Airports" text field).
  - Surrounding towns: the "Cities" field, or "Hourly Cities" when "Cities" is empty.
  - Coordinates for airports and towns are reused from the current file by code / name.
    Anything new without coordinates is listed in the report (it still shows by name).
*/
"use strict";
const fs = require("fs");
const path = require("path");

const SITE_COLLECTIONS = {
  cities: "653c244574d44fa458a42f28",    // Service Areas
  airports: "660ec668447cf8e0bcc9089c",  // Airports
  countries: "653c244574d44fa458a42f2d"  // Countries
};
const DATA = path.join(__dirname, "..", "..", "service-areas.json");
const THUMBS = path.join(__dirname, "..", "..", "thumbs");
const DRY = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");   // allow removing more than MAX_REMOVE cities in one run
const MAX_REMOVE = 10;
const FROM = (() => { const i = process.argv.indexOf("--from"); return i > -1 ? process.argv[i + 1] : null; })();

const CONTINENT_REGION = { "oceania": "Australia", "australia": "Australia", "middle east": "Middle East",
  "europe": "Europe", "asia": "Asia", "africa": "Africa", "north america": "North America",
  "south america": "South America", "central america": "North America", "caribbean": "North America" };

async function fetchAll(collectionId) {
  const token = process.env.WEBFLOW_TOKEN;
  if (!token) throw new Error("Set WEBFLOW_TOKEN (Webflow API token with CMS read access).");
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const url = `https://api.webflow.com/v2/collections/${collectionId}/items/live?limit=100&offset=${offset}`;
    let res;
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
      if (res.status !== 429) break;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));   // rate limit: wait and retry
    }
    if (!res.ok) throw new Error(`Webflow API ${res.status} for ${collectionId}: ${await res.text()}`);
    const body = await res.json();
    out.push(...(body.items || []));
    const total = body.pagination ? body.pagination.total : out.length;
    if (out.length >= total || !(body.items || []).length) break;
  }
  return out;
}

const text = html => String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
  .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
  .replace(/&quot;/g, '"').replace(/‍/g, "");
const lines = html => text(html).split("\n").map(s => s.trim()).filter(Boolean);
const town = s => s.split(",")[0].trim();   // "Zlatar, Krapinsko-Zagorska" -> "Zlatar"
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

async function main() {
  const old = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const oldBySlug = Object.fromEntries(old.map(c => [c.s, c]));

  // What we already know: airport coordinates by code, town coordinates by name, region by country
  const apCoord = {}, townCoord = {}, regionOf = {};
  for (const c of old) {
    regionOf[c.co] = regionOf[c.co] || c.r;
    for (const a of c.a || []) if (a.la != null && !apCoord[a.code]) apCoord[a.code] = [a.la, a.lo];
    for (const t of c.nc || []) {
      townCoord[c.s + "|" + t[0]] = [t[1], t[2]];
      if (!townCoord["*|" + t[0]]) townCoord["*|" + t[0]] = [t[1], t[2]];
    }
  }

  let cities, airports, countries;
  if (FROM) ({ cities, airports, countries } = JSON.parse(fs.readFileSync(FROM, "utf8")));
  else {
    cities = await fetchAll(SITE_COLLECTIONS.cities);
    airports = await fetchAll(SITE_COLLECTIONS.airports);
    countries = await fetchAll(SITE_COLLECTIONS.countries);
  }
  const airportById = Object.fromEntries(airports.map(a => [a.id, a.fieldData]));
  const countryById = Object.fromEntries((countries || []).map(c => [c.id, c.fieldData.name]));

  const report = { added: [], removed: [], hidden: 0, noCoords: [], noAirports: [], noTowns: [],
                   apNoCoords: new Set(), townsNoCoords: 0, noThumb: [] };
  const fresh = [];

  for (const item of cities) {
    const f = item.fieldData || {};
    if (item.isArchived) continue;   // the live endpoint returns published items; isDraft can be true when a live item has unsaved edits
    if (f["feature-on-service-page"] === true) { report.hidden++; continue; }   // "Hide Service Area" on

    const slug = f.slug, prev = oldBySlug[slug];
    const name = (f.name || "").trim();
    const country = (f.country || countryById[f["country-reference"]] || (prev && prev.co) || "").trim();
    const afterComma = (name.split(",")[1] || "").trim();
    const st = prev ? prev.st : (/^[A-Z]{2}$/.test(afterComma) ? afterComma : "");
    const region = (prev && prev.r) || regionOf[country] ||
      CONTINENT_REGION[String(f.continent || "").trim().toLowerCase()] || "";

    const la = num(f["latitude-2"]) ?? (prev && prev.la), lo = num(f["longitude-2"]) ?? (prev && prev.lo);
    if (la == null || lo == null) { report.noCoords.push(slug); continue; }   // can't place it on the map

    // Airports
    let a;
    const refs = f["airport-reference"] || [];
    if (refs.length) {
      a = refs.map(id => airportById[id]).filter(Boolean).map(ap => {
        const code = (ap["airport-code"] || "").trim();
        const o = { code, name: (ap.name || "").trim() };
        const xy = apCoord[code];
        if (xy) { o.la = xy[0]; o.lo = xy[1]; } else report.apNoCoords.add(code + " " + o.name);
        return o;
      });
    } else if (prev) a = prev.a;
    else a = lines(f["airports-2"]).map(l => {
      const m = l.match(/^([A-Z0-9]{3,4})\s*[-–]\s*(.+)$/);
      if (!m) return null;
      const o = { code: m[1], name: m[2].trim() }, xy = apCoord[m[1]];
      if (xy) { o.la = xy[0]; o.lo = xy[1]; } else report.apNoCoords.add(m[1] + " " + o.name);
      return o;
    }).filter(Boolean);
    if (!a.length) report.noAirports.push(slug);

    // Surrounding towns
    let nb = lines(f["cities-2"]).map(town);
    if (!nb.length) nb = lines(f["hourly-cities"]).map(town);
    if (!nb.length && prev) nb = prev.nb;
    nb = [...new Set(nb.filter(Boolean))];
    if (!nb.length) report.noTowns.push(slug);
    const nc = [];
    for (const t of nb) {
      const xy = townCoord[slug + "|" + t] || townCoord["*|" + t];
      if (xy) nc.push([t, xy[0], xy[1]]); else report.townsNoCoords++;
    }

    const c = { s: slug, n: name, c: (f["featured-location-name"] || name.split(",")[0]).trim(),
                st, co: country, r: region, la, lo, a, nb, nc };
    fresh.push(c);
    if (!prev) report.added.push(slug);
    if (!fs.existsSync(path.join(THUMBS, slug + ".webp"))) report.noThumb.push(slug);
  }

  // Keep the current file's order; new cities go at the end
  const freshSlugs = new Set(fresh.map(c => c.s));
  report.removed = old.filter(c => !freshSlugs.has(c.s)).map(c => c.s);
  const order = Object.fromEntries(old.map((c, i) => [c.s, i]));
  fresh.sort((x, y) => (order[x.s] ?? 1e9) - (order[y.s] ?? 1e9));

  console.log(`Cities on the map: ${old.length} -> ${fresh.length}  (hidden: ${report.hidden})`);
  const list = (label, arr) => arr.length && console.log(`${label} (${arr.length}): ${arr.join(", ")}`);
  list("Added", report.added);
  list("Removed (unpublished or hidden)", report.removed);
  list("Skipped, no lat/lon in the CMS", report.noCoords);
  list("No airports", report.noAirports);
  list("No surrounding towns", report.noTowns);
  list("Airports without map coordinates (shown by name only)", [...report.apNoCoords]);
  if (report.townsNoCoords) console.log(`Surrounding towns without coordinates (not drawn as dots): ${report.townsNoCoords}`);
  list("Missing thumbnails (add thumbs/<slug>.webp, 288x288)", report.noThumb);

  if (DRY) { console.log("\nDry run: nothing written."); return; }
  if (report.removed.length > MAX_REMOVE && !FORCE) {
    console.error(`\nStopped: this would remove ${report.removed.length} cities from the map. If that is intended, run again with --force.`);
    process.exit(1);
  }
  fs.writeFileSync(DATA, JSON.stringify(fresh));
  console.log(`\nWrote ${path.relative(process.cwd(), DATA)}. Next: thumbnails, commit, push, pin the hash.`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
