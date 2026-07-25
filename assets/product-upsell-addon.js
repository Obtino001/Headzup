/**
 * Gift box + "Ofte købt sammen" addons share this component.
 * When any checkbox is checked, we intercept ATC once, add all items together,
 * open Rebuy only — never refresh/open the theme cart drawer (that left the blur overlay).
 */
(function () {
  const ATC_SELECTOR = '[data-add-to-cart], [type="submit"][name="add"], button[name="add"]';

  function hideThemeCart() {
    document.querySelectorAll('cart-drawer, .drawer--cart, #cart-drawer').forEach((drawer) => {
      drawer.classList.remove('is-open', 'is-closing');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.style.setProperty('display', 'none', 'important');
    });
    document.querySelectorAll('.drawer__underlay, .underlay--visible').forEach((el) => {
      if (el.closest('#rebuy-cart, .rebuy-cart')) return;
      el.classList.remove('underlay--visible');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
    document.dispatchEvent(new CustomEvent('theme:scroll:unlock', { bubbles: true }));
  }

  function openRebuy() {
    hideThemeCart();
    const smartCart = window.Rebuy?.SmartCart;
    if (!smartCart || typeof smartCart.show !== 'function') return false;
    smartCart.skip_open = false;
    smartCart.show();
    return true;
  }

  function openRebuyWithRetry() {
    if (openRebuy()) return;
    let attempts = 0;
    const retry = setInterval(() => {
      attempts += 1;
      if (openRebuy() || attempts >= 12) clearInterval(retry);
    }, 200);
  }

  function collectCheckedItems() {
    const items = [];
    const seen = new Set();

    document.querySelectorAll('upsell-addon [data-upsell-item].is-checked').forEach((item) => {
      const variantId = parseInt(item.getAttribute('data-selected-variant-id') || '', 10);
      if (!variantId || seen.has(variantId)) return;
      seen.add(variantId);
      items.push({ id: variantId, quantity: 1 });
    });

    return items;
  }

  function getMainVariantId(form) {
    if (!form) {
      const input = document.querySelector('product-form input[name="id"], form[action*="/cart/add"] input[name="id"]');
      return input ? parseInt(input.value, 10) : null;
    }
    const formId = form.getAttribute('id');
    let input = formId ? document.querySelector(`input[name="id"][form="${formId}"]`) : null;
    if (!input) input = form.querySelector('[name="id"]');
    return input ? parseInt(input.value, 10) : null;
  }

  function formatMoney(cents) {
    if (window.Shopify?.formatMoney) {
      return Shopify.formatMoney(
        cents,
        window.theme?.moneyFormat || '{{amount_no_decimals}} kr'
      );
    }
    return (cents / 100).toFixed(2) + ' kr';
  }

  async function addBundleToCart(submitBtn, checkedItems) {
    const form = submitBtn.closest('form');
    const mainId = getMainVariantId(form);
    const itemsToAdd = [...checkedItems];

    if (mainId && !itemsToAdd.some((item) => item.id === mainId)) {
      itemsToAdd.unshift({ id: mainId, quantity: 1 });
    }

    if (!itemsToAdd.length) return;

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML =
      '<span class="btn__loader"><svg height="18" width="18" class="svg-loader"><circle r="7" cx="9" cy="9" /><circle stroke-dasharray="87.96459430051421 87.96459430051421" r="7" cx="9" cy="9" /></svg></span> Tilføjer...';
    submitBtn.disabled = true;

    try {
      const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ items: itemsToAdd }),
      });

      if (!response.ok) {
        throw new Error('Add to cart failed');
      }

      // Do NOT dispatch theme:cart:refresh — that rebuilds theme cart + underlay ghost.
      // Tell listeners product was added; custom.js / Rebuy open the app cart.
      document.dispatchEvent(
        new CustomEvent('theme:product:added', {
          bubbles: true,
          detail: { response: await response.json().catch(() => ({})) },
        })
      );

      // Refresh header count without opening theme drawer
      fetch(window.Shopify.routes.root + 'cart.js')
        .then((r) => r.json())
        .then((cart) => {
          document.dispatchEvent(
            new CustomEvent('theme:cart:change', {
              bubbles: true,
              detail: { cartCount: cart.item_count },
            })
          );
        })
        .catch(() => {});

      hideThemeCart();
      openRebuyWithRetry();

      setTimeout(() => {
        submitBtn.classList.remove('is-loading');
        submitBtn.removeAttribute('disabled');
        submitBtn.innerHTML = originalText;
      }, 500);
    } catch (error) {
      console.error('Upsell add-to-cart error:', error);
      submitBtn.innerHTML = 'Fejl';
      setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }, 2000);
    }
  }

  // One capture listener for the whole page — merges gift box + addon checkboxes
  document.addEventListener(
    'click',
    (event) => {
      const submitBtn = event.target.closest(ATC_SELECTOR);
      if (!submitBtn) return;
      if (submitBtn.closest('.rebuy-cart, #rebuy-cart, cart-drawer')) return;

      const checkedItems = collectCheckedItems();
      if (!checkedItems.length) return; // normal ATC (no gift/addons)

      event.preventDefault();
      event.stopImmediatePropagation();
      addBundleToCart(submitBtn, checkedItems);
    },
    true
  );

  if (!customElements.get('upsell-addon')) {
    customElements.define(
      'upsell-addon',
      class UpsellAddon extends HTMLElement {
        connectedCallback() {
          this.items = this.querySelectorAll('[data-upsell-item]');
          this.totalPriceEl = this.querySelector('[data-upsell-total]');
          this.mainProductPrice = parseInt(this.getAttribute('data-main-product-price') || 0, 10);
          this.bindToggle();
          this.calculateTotal();
        }

        bindToggle() {
          this.items.forEach((item) => {
            item.addEventListener('click', (e) => {
              if (e.target.closest('a')) return;
              item.classList.toggle('is-checked');
              item.classList.toggle('is-unchecked');
              // Recalc totals on every upsell-addon that has a total row
              document.querySelectorAll('upsell-addon').forEach((el) => {
                if (typeof el.calculateTotal === 'function') el.calculateTotal();
              });
            });
          });
        }

        calculateTotal() {
          if (!this.totalPriceEl) return;

          let total = this.mainProductPrice || 0;
          // Include every checked addon on the page in "I alt" when this block shows total
          document.querySelectorAll('upsell-addon [data-upsell-item].is-checked').forEach((item) => {
            total += parseInt(item.getAttribute('data-selected-price') || 0, 10);
          });

          this.totalPriceEl.innerHTML = formatMoney(total);
        }
      }
    );
  }
})();
