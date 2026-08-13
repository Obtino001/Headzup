# QA Test Plan — Size State Fix

Test this on the **preview link of the non-live theme** (Shopify admin → Online Store
→ Themes → the test theme → ⋯ → Preview).

**Use an incognito / private window.** A normal window may serve the old cached CSS
and JS and show you a false failure.

---

## Step 0 — Confirm the new code is actually loaded

Before testing anything, open any product page, press `F12` → **Console** tab, paste
this and press Enter:

```js
window.theme.strings.selectSize
```

- **Expected:** `"Vælg størrelse"`
- **If it returns `undefined`:** the theme has not picked up the new files yet. Stop
  here, confirm the GitHub branch has synced to this theme, and hard-refresh with
  `Ctrl + Shift + R`. Do not continue testing until this returns the Danish string.

---

## Test 1 — The critical one: product page on load

This is the test that matters. Everything else is secondary.

**Important:** the URL must **not** contain `?variant=`. If you click a product from
a collection page the URL often includes a variant, and then a size is legitimately
pre-selected. Copy a clean product URL and open it directly, for example:

```
https://<preview-url>/products/<any-fitted-cap>
```

Check all four, on desktop:

| # | What to check | Expected |
|---|---|---|
| 1.1 | Price under the title | **Visible** (e.g. `329,00 kr`) |
| 1.2 | Add to Cart button text | **VÆLG STØRRELSE** |
| 1.3 | Button colour | **Navy and solid**, looks clickable — not grey |
| 1.4 | Size dropdown | Reads **Vælg størrelse**, no size pre-selected |

**Fails if:** the button says UTILGÆNGELIG, or is grey, or the price is missing.

Repeat the same four checks on a phone (or F12 → device toolbar).

---

## Test 2 — Clicking the button before choosing a size

On the same page, **click the VÆLG STØRRELSE button** without touching the dropdown.

Expected:
- The page scrolls to the size selector
- The size dropdown **opens by itself**
- The dropdown border briefly highlights / nudges
- Nothing is added to the cart, and no error message appears

**Fails if:** nothing happens, or the dropdown opens and instantly closes again, or
something gets added to the cart.

---

## Test 3 — Choosing a size

Pick a size from the dropdown.

Expected:
- The dropdown now shows the chosen size
- The button changes to **TILFØJ TIL KURV**
- The price still shows, now the price of that size
- Clicking the button adds the product to the cart normally

Then add it to the cart and confirm the correct size arrives in the cart.

---

## Test 4 — Sold out sizes must still say sold out

Find a product where at least one size is sold out, and select that size.

Expected: the button reads **UDSOLGT** (sold out) and is disabled.

This confirms we only changed the "no size chosen yet" state and did not accidentally
make genuinely unavailable products look purchasable.

---

## Test 5 — Products without sizes

Open a product that has no size option at all (an accessory, a tote bag).

Expected: it behaves exactly as before — price visible, button reads **TILFØJ TIL
KURV** immediately, no size step.

---

## Test 6 — Hero scrim

Open the homepage.

Expected: the headline and the subline "Personlig service siden 2020…" are clearly
readable against the photo, with a soft dark gradient behind them. On mobile the
gradient comes up from the bottom.

**Fails if:** the whole image looks flatly darkened, or the text is still hard to read.

---

## Test 7 — Collection titles

Open a collection with several New Era caps.

Expected: each card shows a different, readable title with the colourway visible, over
up to two lines. The brand name appears once, above the title, not repeated inside it.

**Fails if:** four cards still read the same truncated text.

---

## Test 8 — Quick regression pass

These were working before; just confirm nothing broke.

- Mega menu opens on hover and **closes on hover-out**
- Search icon opens the Clerk search overlay (desktop **and** mobile)
- Størrelsesguide opens next to the size label, including on Chapter Two products
- Product cards show the second image on hover (desktop)
- Desktop navigation is visible immediately, no hamburger, no fade-in delay
- Cart icon opens the cart drawer

---

## If something fails

Send me, for the failing step:

1. The step number (e.g. "Test 1.2 failed")
2. The **full URL** you were on
3. A screenshot
4. Anything red in the browser console (`F12` → Console)

Point 4 matters most — a JavaScript error there usually tells us the cause in one line.

---

## Safety switch (only if needed)

Theme editor → Theme settings → **Product form** → **"Require an explicit size
choice"**.

Turning it **off** pre-selects the first available size, i.e. the store's original
behaviour. Leave it **on** for this test — it is the behaviour we are relaunching
with.
