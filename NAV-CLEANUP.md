# Nav (Concept 01) — rollout & cleanup checklist

Do this **after** the team review and final edits, when the new nav moves from the
`/nav-concept-01` draft page to every page.

## Load once, site-wide
Webflow > Site settings > Custom code:

**Head**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/savoyaground/animation@<commit>/animation.css">
```

**Footer**
```html
<script defer src="https://cdn.jsdelivr.net/gh/savoyaground/animation@<commit>/animation.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/savoyaground/core@<commit>/nav.js"></script>
<!-- nav.js is the master nav (formerly nav-v3.js); nav-v2.js and nav-v1.js are kept for rollback only -->
```
Pin `<commit>` to a real commit hash, not a branch, so a push can't change the live site unexpectedly.

## Cleanup
- [ ] Remove `animation.css` / `animation.js` from the Nav Concept 01 page's custom code (added only so the draft could preview animations)
- [ ] Remove per-page copies of `animation.css` / `animation.js` on other pages once they load site-wide
- [ ] Delete the inline nav script from the Nav Concept 01 page footer (replaced by `nav.js`)
- [ ] Remove the duplicate `buttons.js` on the Nav Concept 01 page (loaded in both head and footer)
- [ ] Swap the old **Main Nav** component for the new nav on live pages
- [ ] Archive or delete the Nav Concept 01 draft page
- [ ] Do **not** run Webflow's "Clean up unused styles" on `nc1-open` / `nc1-active` / `nc1-hover`. Only `nav.js` applies them, so Webflow thinks they're unused.
- [ ] Point every page/site footer at `nav.js` (latest commit hash); remove `nav-v3.js` links
- [ ] Optional: move nav.js's injected V2 styles (`.nc1-nav.nc1-v2 …`) into Webflow classes if designers need to edit them
- [ ] Once the new nav is live and stable, delete `nav-v1.js` and `nav-v2.js` from the repo

## What nav.js needs on the page
- Webflow classes `nc1-*` (Nav Bar, Nav Item Col, Nav Item List Item, Sidebar CTA, Nav Footer Bar components)
- `animation.css` for the entrance animations (`fade-in`, `reveal-up`, `reveal-up-group`, `fade-section`). Without it the menu still works, just without the entrance animation.
