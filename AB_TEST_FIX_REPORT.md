# A/B Test Result — Root Cause and Fix

**Date:** 12 August 2026
**Subject:** Why "New Group 1" underperformed, what caused it, and what has been fixed

---

## 1. Summary

The test variant showed a large drop in conversion. We investigated and found a
single, specific defect that fully explains it: **on every product page with sizes,
the buy button read "UTILGÆNGELIG" (Unavailable) and the price was hidden on page
load.**

This was not a design or preference issue. It was a functional bug in how the theme
reacts to a product that has no size selected yet. It has been identified, fixed and
verified in code.

---

## 2. What the data actually says

| Metric | Control | New Group 1 |
|---|---|---|
| Visitors | 790 | 763 |
| Orders | 27 | 10 |
| Conversion rate | 3.42% | 1.31% |
| Revenue per visitor | 13.49 kr | 4.17 kr |
| Average order value | 394.71 kr | 318.33 kr |

Two things are true at the same time, and both matter:

1. **The variant was genuinely worse.** Even the most optimistic end of the
   confidence interval is −23%. This is not random noise.
2. **The exact figure of −62% is not reliable.** The test ran for roughly one day
   with 10 orders on the variant. The testing platform's own summary states it is
   "too early to call." The true size of the effect cannot be measured from this
   sample.

The correct conclusion is therefore: *something was broken, and we now know exactly
what.* It is not: *the new design converts 62% worse.*

---

## 3. Root cause

One of the agreed changes was to stop pre-selecting a size, so that customers make a
deliberate size choice instead of accidentally ordering the default size. The intent
was sound.

What was not accounted for is how this theme handles a product page where no variant
is selected yet. Internally the theme treats "no size chosen" and "this product does
not exist" as the same state. On page load its variant handler therefore did three
things at once:

- relabelled the Add to Cart button to **"UTILGÆNGELIG"** (Unavailable)
- disabled that button and greyed it out
- applied an "unavailable" style that **hid the price entirely**

So the first thing a visitor saw was a product with no price and a greyed-out button
saying Unavailable. Nothing on the page indicated that choosing a size would fix it.
A significant share of visitors would reasonably conclude the product was sold out
and leave.

Everything else on the page worked correctly. As soon as a size was picked, the price
appeared and the button became "TILFØJ TIL KURV". The failure was confined entirely
to the default state on load — which is, of course, the state every single visitor
sees first.

---

## 4. What has been fixed

### 4.1 Product page: the empty size state (primary fix)

The theme now distinguishes between "no size chosen yet" and "product unavailable".
While a size is still pending:

- The button reads **"VÆLG STØRRELSE"** (Select size).
- The button stays **active and navy** — it is not disabled or greyed out.
- **The price is shown** on load, using the product's own price.
- Clicking the button **scrolls to the size selector and opens it**, with a brief
  highlight, instead of doing nothing.
- As soon as a size is chosen, the page behaves exactly as before: the variant price
  is shown and the button becomes "TILFØJ TIL KURV".

This keeps the benefit of a deliberate size choice while removing the message that
told every visitor the product was unavailable.

### 4.2 Hero scrim

The hero subline ("Personlig service siden 2020…") was thin light text over a busy
photograph. A gradient scrim has been added behind the hero content — horizontal on
desktop, bottom-up on mobile — so the headline and subline stay legible without
darkening the whole image.

### 4.3 Collection page product titles

Titles were being cut at a fixed length, which happened to fall inside the shared
brand prefix. Four different caps all displayed as "New Era - 59FIFTY Fitted Cap - N…"
and were indistinguishable.

The brand name is now removed from the title (it is already displayed above the
title), and the remaining text wraps over two lines instead of being cut. The
colourway — the part that actually distinguishes one cap from another — is now
visible on every card.

---

## 5. Confirmed working (no action needed)

The following were reviewed and are behaving as intended:

- Hero has a headline, subline and a "Shop caps" button, positioned clear of the logos
- Trust bar sits above the fold
- Wishlist button is outlined and no longer competes with Add to Cart
- Størrelsesguide sits next to the size label and opens correctly
- Cross-sell shows a genuine complementary product rather than colour variants
- Sale prices are no longer red
- Collection filters are working

---

## 6. Safety switch added

A new theme setting has been added under **Theme editor → Theme settings → Product
form → "Require an explicit size choice"**.

- **On** (current): size starts empty, button reads "Vælg størrelse".
- **Off**: the first available size is pre-selected, exactly as the store behaved
  before this project.

This can be toggled from the theme editor in seconds by anyone, with no developer
involvement and no deployment. If anything unexpected appears in the next test, the
store can be returned to its previous behaviour immediately.

---

## 7. Recommended relaunch plan

1. **Stop the current test now.** The variant with the defect is still receiving
   traffic; every hour it runs is avoidable lost revenue.
2. **Deploy the fix** to the test theme.
3. **Verify before launching.** Open any fitted cap directly, without a size in the
   URL. The price must be visible and the button must be navy and read "VÆLG
   STØRRELSE". Clicking it must open the size dropdown.
4. **Start a completely new test.** Do not resume the existing one — the variant has
   changed, and mixing the old data would invalidate the result.
5. **Let it run properly.** A minimum of two weeks, or roughly 200 orders per
   variation, before drawing any conclusion. The previous test was called at one day
   and 10 orders.

---

## 8. One thing to watch in the next test

Average order value was also down (394 kr vs 318 kr). This is most likely a side
effect of the much smaller order count, but the cross-sell block was changed in the
same release to show a complementary product instead of colour variants. Average
order value should be monitored specifically in the next run; if it stays down while
conversion recovers, the cross-sell selection is the first place to look.

---

## 9. Closing note

The test did its job. It surfaced a functional defect within a single day, at the cost
of roughly 800 sessions, rather than letting it sit unnoticed on the store for weeks.
The cause is understood, the fix is in place, and a safety switch now exists so the
change can be reversed instantly if needed.
