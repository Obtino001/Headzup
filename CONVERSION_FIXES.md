# HeadzUp conversion fixes (all 14)

Document of changes shipped to address the conversion drop on the new theme version.

---

## Priority 1 — conversion drop

### 1. Restyle wishlist button
**Problem:** Bright cyan “TILFØJ TIL ØNSKESKYEN” outshone navy “Tilføj til kurv”.  
**Fix:**
- [`templates/product.json`](templates/product.json) — Ønskeskyen block: transparent background, navy text/border/icon (`#0c2340`).
- [`assets/custom.css`](assets/custom.css) — scoped `.gowish-btn` overrides so the app cannot force cyan back.

**Result:** ATC stays the primary CTA; wishlist reads as a muted outline.

---

### 2. Remove pre-selected size
**Problem:** Size dropdown defaulted to smallest fitted size (e.g. 6 7/8).  
**Fix:**
- [`snippets/product-variant-options.liquid`](snippets/product-variant-options.liquid) — when URL has no `?variant=`, size shows **Vælg størrelse**, no active option, empty pending input.
- [`snippets/product-buttons.liquid`](snippets/product-buttons.liquid) — ATC disabled with “Vælg størrelse” until a size is chosen.
- [`assets/custom.js`](assets/custom.js) — unlocks ATC after selection.
- Locales: `products.product.select_size` in `da.json` / `en.default.json`.

---

### 3. Hero text collision with logos
**Problem:** Value prop sat bottom-left through New Era / MLB logos.  
**Fix:** [`templates/index.json`](templates/index.json) — alignment `align--middle-left-desktop` / `align--middle-left-mobile`.

---

### 4. Scrim behind hero text
**Problem:** White text on light image was illegible.  
**Fix:** `show_overlay_text: true`, `overlay_opacity: 55` on the hero section.

---

### 5. Hero CTA
**Problem:** Nothing to click in the hero.  
**Fix:** Button text **Shop caps** → New Era collection; solid white button style.

---

### 6. Hero text hierarchy
**Problem:** Four lines of equal-weight body copy.  
**Fix:**
- Headline: **Danmarks bedste udvalg af caps**
- Subline: shorter supporting sentence (`body-medium`)
- CSS in `custom.css` for stronger title / quieter description

---

## Priority 2 — friction and clarity

### 7. Size guide next to “Størrelse”
**Problem:** Small grey “Størrelsesguide” floated right in whitespace.  
**Fix:**
- Trigger moved beside the size legend in `product-variant-options.liquid`.
- Modal-only render from `ring_size` block (`hide_trigger: true`).
- Drawer open via event delegation in [`snippets/size-guide.liquid`](snippets/size-guide.liquid).

---

### 8. “Ofte købt sammen” — complements not colour variants
**Problem:** Related feed returned the same cap in other colours.  
**Fix:**
- Recommendations intent → `complementary` with related fallback + colour-variant filter.
- **Also wired:** Theme Editor **Upsell collection** / **Products (manual)** now actually render (they were unused before).

**How to set for 1000+ products (recommended):**
1. Shopify Admin → **Products → Collections → Create collection** (e.g. “Ofte købt sammen / Accessories”).
2. Add accessories only: Cap Strips, stickers, cleaning kits, etc. (not colour variants of caps).
3. Theme Editor → Product page → **Upsell Addon** → set **Upsell collection** to that collection.
4. Done — every PDP shows the same 5 accessories. No per-product setup.

Optional: Search & Discovery complementary rules if you want different accessories per collection.

---

### 9. Cross-sell red prices
**Problem:** Red prices signalled discount when items were not on sale.  
**Fix:** Default price colour navy `#0c2340`; red only with `.is-sale` when `compare_at > price`.

---

### 10. Mobile hero height ~70%
**Problem:** Tall hero pushed trust bar below the fold.  
**Fix:** `mobile_height: screen-height-two-thirds--mobile` + CSS `min-height: 70vh` on that class.

---

### 11. Slim mobile header stack
**Problem:** Announcement + brand switcher + logo ate ~⅓ of the screen.  
**Fix:** On mobile, when header is stuck (`js__header__stuck`), collapse `.header-topbar` (height/opacity).

---

### 12. Soften “Chapter Two” tab
**Problem:** Equal-weight tab invited users off-brand before they saw product.  
**Fix:** Second brand tab reduced opacity/size; Headz Up tab kept visually primary.

---

## Priority 3 — verify

### 13. Blank product cards
**Problem:** Homepage cards rendered as empty white boxes (AOS + lazy).  
**Fix:**
- Eager-load more slider images (lazy after index 8).
- CSS forces `opacity: 1` on product card `img-in` / `is-loading` images.

---

### 14. Expose main navigation on load
**Problem:** Desktop nav forced into hamburger below 1200px; header faded in via AOS.  
**Fix:**
- Removed hard `minWidth = 1200` override in [`assets/theme.dev.js`](assets/theme.dev.js) — uses measured `getMinWidth()`.
- Removed `data-aos="fade"` from header so nav/logo are visible immediately.

---

## How to QA (preview)

| # | Check |
|---|--------|
| 1 | PDP: ATC navy solid; wishlist muted outline; wishlist still works |
| 2 | Fitted product: dropdown says Vælg størrelse; ATC locked until size picked |
| 3–6 | Homepage: headline + subline + Shop caps; text clear of logos; readable scrim |
| 7 | Størrelsesguide beside Størrelse; opens drawer |
| 8–9 | Ofte købt sammen: accessories/complements; prices navy unless on sale |
| 10 | Mobile: trust content peeks under ~70vh hero |
| 11 | Mobile scroll: topbar collapses |
| 12 | Chapter Two quieter than Headz Up |
| 13 | Homepage product rows show images without blank boxes |
| 14 | Desktop: menu visible without waiting for scroll/fade |

---

## Files touched

- `templates/product.json`
- `templates/index.json`
- `snippets/product-variant-options.liquid`
- `snippets/product-buttons.liquid`
- `snippets/size-guide.liquid`
- `snippets/product-upsell-addon.liquid`
- `snippets/product-grid-item.liquid`
- `sections/product.liquid`
- `sections/header.liquid`
- `assets/custom.css`
- `assets/custom.js`
- `assets/product-upsell-addon.css`
- `assets/product-upsell-addon.js`
- `assets/theme.dev.js`
- `locales/da.json`
- `locales/en.default.json`

---

## Follow-ups for merchant

1. Configure **complementary products** in Search & Discovery for stronger “Ofte købt sammen” (Stetson strips, stickers, accessories).
2. A/B: if wishlist still feels loud, move to heart-on-image in a later pass.
3. Measure conversion for 7–14 days after publish before further layout experiments.
