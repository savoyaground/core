(() => {
  if (window.SavoyaLordicons) return;
 
  /* ---------- Color themes ---------- */
 
  const THEMES = {
    gold:  "primary:#c56129,secondary:#f5ad59",
    dark:  "primary:#141313,secondary:#141313",
    light: "primary:#ffffff,secondary:#ffffff"
  };
 
  const DEFAULT_THEME = "gold";
  const DEFAULT_TRIGGER = "in";
  const LORDICON_SRC = "https://cdn.lordicon.com/lordicon.js";
 
  /* ---------- Load the Lordicon player once ---------- */
 
  if (
    !window.customElements?.get("lord-icon") &&
    !document.querySelector(`script[src="${LORDICON_SRC}"]`)
  ) {
    const player = document.createElement("script");
    player.src = LORDICON_SRC;
    document.head.appendChild(player);
  }
 
  /* ---------- Helpers ---------- */
 
  function getConfig() {
    return window.SavoyaIcons || {};
  }
 
  function colorsFor(theme) {
    return THEMES[theme] || THEMES[getConfig().theme] || THEMES[DEFAULT_THEME];
  }
 
  function setIfChanged(element, attribute, value) {
    if (element.getAttribute(attribute) !== value) {
      element.setAttribute(attribute, value);
    }
  }
 
  function applyIcon(icon, id, theme, trigger) {
    if (!id) return;
 
    setIfChanged(icon, "src", `https://cdn.lordicon.com/${id}.json`);
    setIfChanged(icon, "colors", colorsFor(theme));
    setIfChanged(icon, "trigger", trigger || DEFAULT_TRIGGER);
 
    icon.style.opacity = "1";
  }
 
  /* ---------- 1. Attribute-based icons ---------- */
 
  function initAttributeIcons(root) {
    root.querySelectorAll("lord-icon[data-icon]").forEach(icon => {
      applyIcon(
        icon,
        icon.dataset.icon,
        icon.dataset.iconTheme,
        icon.dataset.iconTrigger
      );
    });
  }
 
  /* ---------- 2. Config-based blocks ---------- */
 
  function initBlockIcons(root) {
    const config = getConfig();
    const blocks = config.blocks || {};
 
    Object.entries(blocks).forEach(([className, entry]) => {
      const iconIds = Array.isArray(entry) ? entry : entry.icons || [];
      const theme = Array.isArray(entry) ? config.theme : entry.theme || config.theme;
      const trigger = Array.isArray(entry)
        ? config.trigger
        : entry.trigger || config.trigger;
 
      root.querySelectorAll(`.${className}`).forEach(block => {
        block
          .querySelectorAll("lord-icon.lordicon-dynamic")
          .forEach((icon, index) => {
            // An icon with its own data-icon attribute wins.
            if (icon.dataset.icon) return;
 
            applyIcon(icon, iconIds[index], theme, trigger);
          });
      });
    });
  }
 
  function initIcons() {
    initAttributeIcons(document);
    initBlockIcons(document);
  }
 
  /* ---------- Watch for icons added later (CMS, tabs, sliders) ---------- */
 
  function isRelevant(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
 
    const blockSelectors = Object.keys(getConfig().blocks || {}).map(
      name => `.${name}`
    );
 
    const selector = [
      "lord-icon[data-icon]",
      "lord-icon.lordicon-dynamic",
      ...blockSelectors
    ].join(", ");
 
    return node.matches(selector) || !!node.querySelector(selector);
  }
 
  function start() {
    initIcons();
 
    const observer = new MutationObserver(mutations => {
      const hasNewIcons = mutations.some(mutation =>
        Array.from(mutation.addedNodes).some(isRelevant)
      );
 
      if (hasNewIcons) initIcons();
    });
 
    observer.observe(document.body, { childList: true, subtree: true });
  }
 
  /* ---------- Public API ---------- */
 
  window.SavoyaLordicons = {
    refresh: initIcons,
    themes: THEMES
  };
 
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();