/**
 * Gift box + Ofte købt sammen — add via /cart/add.js then open Assortion.
 */
(function () {
  const ATC_SELECTOR = '[data-add-to-cart], [type="submit"][name="add"], button[name="add"]';

  function rootUrl() {
    return window.Shopify?.routes?.root || '/';
  }

  // Must be .js endpoint for JSON { items: [...] }
  function cartAddUrl() {
    const fromTheme = window.theme?.routes?.cart_add_url || '';
    if (fromTheme.endsWith('.js')) return fromTheme;
    if (fromTheme) return fromTheme.replace(/\/?$/, '') + '.js';
    return rootUrl() + 'cart/add.js';
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
    const formId = form?.getAttribute?.('id');
    const candidates = [];

    if (formId) {
      candidates.push(document.querySelector(`input[name="id"][form="${formId}"]`));
    }
    if (form) {
      candidates.push(form.querySelector('[name="id"]'));
    }
    candidates.push(
      document.querySelector('product-form input[name="id"]'),
      document.querySelector('[data-product-form] input[name="id"]'),
      document.querySelector('form[action*="/cart/add"] [name="id"]'),
      document.querySelector('input[name="id"][form]')
    );

    for (const input of candidates) {
      if (!input || !input.value) continue;
      const id = parseInt(input.value, 10);
      if (id) return id;
    }
    return null;
  }

  function formatMoney(cents) {
    if (window.Shopify?.formatMoney) {
      return Shopify.formatMoney(cents, window.theme?.moneyFormat || '{{amount_no_decimals}} kr');
    }
    return (cents / 100).toFixed(2) + ' kr';
  }

  function openAppCart() {
    setTimeout(() => {
      if (window.HeadzupCart?.openWithRetry) window.HeadzupCart.openWithRetry();
      else if (window.HeadzupCart?.open) window.HeadzupCart.open();
      else document.querySelector('.ast-cart')?.classList.add('ast-open');
      document.dispatchEvent(new CustomEvent('theme:product:added', { bubbles: true }));
    }, 250);
  }

  async function addOneItem(item) {
    const response = await fetch(cartAddUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ id: item.id, quantity: item.quantity || 1 }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status) {
      const msg = data.description || data.message || `Variant ${item.id} failed (${response.status})`;
      const err = new Error(msg);
      err.data = data;
      err.item = item;
      throw err;
    }
    return data;
  }

  async function addBundleToCart(submitBtn, checkedItems) {
    const form =
      submitBtn.closest('form') ||
      submitBtn.closest('product-form')?.querySelector('form') ||
      document.querySelector('product-form form, form[action*="/cart/add"]');

    const mainId = getMainVariantId(form);
    const itemsToAdd = [];
    const seen = new Set();

    if (mainId) {
      itemsToAdd.push({ id: mainId, quantity: 1 });
      seen.add(mainId);
    }

    checkedItems.forEach((item) => {
      if (!item.id || seen.has(item.id)) return;
      seen.add(item.id);
      itemsToAdd.push(item);
    });

    if (!itemsToAdd.length) {
      console.warn('[upsell-addon] No variant ids found', { mainId, checkedItems });
      return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML =
      '<span class="btn__loader"><svg height="18" width="18" class="svg-loader"><circle r="7" cx="9" cy="9" /><circle stroke-dasharray="87.96459430051421 87.96459430051421" r="7" cx="9" cy="9" /></svg></span> Tilføjer...';
    submitBtn.disabled = true;

    const errors = [];
    let added = 0;

    try {
      // Add one-by-one so one sold-out upsell does not block the main product
      for (const item of itemsToAdd) {
        try {
          await addOneItem(item);
          added += 1;
        } catch (itemErr) {
          console.warn('[upsell-addon] item failed', item, itemErr);
          errors.push(itemErr.message);
        }
      }

      if (!added) {
        throw new Error(errors[0] || 'Add to cart failed');
      }

      document.dispatchEvent(new CustomEvent('theme:product:added', { bubbles: true }));

      fetch(rootUrl() + 'cart.js')
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

      openAppCart();

      submitBtn.classList.remove('is-loading');
      submitBtn.removeAttribute('disabled');
      submitBtn.innerHTML = originalText;
    } catch (error) {
      console.error('Upsell add-to-cart error:', error, { url: cartAddUrl(), itemsToAdd });
      submitBtn.innerHTML = 'Fejl';
      setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }, 2000);
    }
  }

  document.addEventListener(
    'click',
    (event) => {
      const submitBtn = event.target.closest(ATC_SELECTOR);
      if (!submitBtn) return;
      if (submitBtn.closest('cart-drawer')) return;

      const checkedItems = collectCheckedItems();
      if (!checkedItems.length) return;

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
              document.querySelectorAll('upsell-addon').forEach((el) => {
                if (typeof el.calculateTotal === 'function') el.calculateTotal();
              });
            });
          });
        }

        calculateTotal() {
          if (!this.totalPriceEl) return;
          let total = this.mainProductPrice || 0;
          document.querySelectorAll('upsell-addon [data-upsell-item].is-checked').forEach((item) => {
            total += parseInt(item.getAttribute('data-selected-price') || 0, 10);
          });
          this.totalPriceEl.innerHTML = formatMoney(total);
        }
      }
    );
  }
})();
