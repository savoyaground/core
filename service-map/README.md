# Service map

Interactive map of every Savoya service area, built for the Service Areas page.

## Embed (Webflow)

Page head:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/savoyaground/core@<commit>/service-map/service-map.min.css">
```

Mount, wherever the map should sit (it fills the viewport below the nav):

```html
<div id="svc-map"></div>
```

Page footer:

```html
<script src="https://cdn.jsdelivr.net/gh/savoyaground/core@<commit>/service-map/service-map.min.js" defer></script>
```

Optional: an element with `id="request"` on the page (the Service Area Request form) makes
"Request this city" scroll to it instead of linking away.

## Files

- `service-map.js`: loader + app. Loads d3 7.9.0, topojson-client 3.1.0 and the world/US outlines from jsDelivr on demand.
- `service-map.css`: everything scoped under `.svm`. Elements inside the map are reset to browser defaults so site styles can't leak in.
- `service-areas.json`: one row per live city in the Webflow "Service Areas" collection (name, region, country, state, lat/lon, airports, surrounding cities).
- `thumbs/{slug}.webp`: 288px city thumbnails (sharp at 3x for every size used).
- `source/`: the prototype and the build that turns it into the two files above (`node source/prod/build.js`).

## Updating the city list

`service-areas.json` is a snapshot of the CMS. When cities are added, re-export the collection,
regenerate the JSON (lat/lon now live on each CMS item), add a thumbnail, commit, and bump the commit hash in Webflow.
