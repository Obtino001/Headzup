/**
 * Gift box + Ofte købt sammen — loads complementary products first
 * (Search & Discovery intent=complementary), with related fallback.
 */
(function () {
  const ATC_SELECTOR = '[data-add-to-cart], [type="submit"][name="add"], button[name="add"]';

  function rootUrl() {
    return window.Shopify?.routes?.root || '/';
  }

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
    return (cents / 100).toFixed(2).replace('.', ',') + ' kr';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pickVariant(product) {
    if (!product?.variants?.length) return null;
    return (
      product.variants.find((v) => v.available) ||
      product.variants[0] ||
      null
    );
  }

  function imageUrl(product) {
    const img = product.featured_image;
    if (!img) return '';
    if (typeof img === 'string') return img;
    return img.src || img.url || '';
  }

  function buildUpsellItemHtml(product, mainProductId) {
    if (!product || String(product.id) === String(mainProductId)) return '';
    if (product.available === false) return '';

    const variant = pickVariant(product);
    if (!variant || variant.available === false) return '';

    const price = variant.price ?? product.price ?? 0;
    const compare = variant.compare_at_price ?? product.compare_at_price ?? 0;
    const img = imageUrl(product);
    const url = product.url || `/products/${product.handle}`;
    const title = escapeHtml(product.title);
    const showVariantTitle = product.variants.length > 1 && variant.title && variant.title !== 'Default Title';

    return `
      <div class="upsell-addon__item is-unchecked" data-upsell-item data-selected-variant-id="${variant.id}" data-selected-price="${price}" data-selected-compare="${compare || price}">
        <div class="upsell-addon__checkbox-wrapper">
          <div class="upsell-addon__checkbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
        ${
          img
            ? `<img src="${escapeHtml(img)}" alt="${title}" class="upsell-addon__image" width="60" height="60" loading="lazy">`
            : `<div class="upsell-addon__image placeholder-bg"></div>`
        }
        <div class="upsell-addon__details">
          <p class="upsell-addon__title">${title}</p>
          ${showVariantTitle ? `<p class="upsell-addon__variant-title">${escapeHtml(variant.title)}</p>` : ''}
          <div class="upsell-addon__price-row">
            <span class="upsell-addon__price${compare > price ? ' is-sale' : ''}">${formatMoney(price)}</span>
            ${compare > price ? `<span class="upsell-addon__compare-price">${formatMoney(compare)}</span>` : ''}
          </div>
          <a href="${escapeHtml(url)}" class="upsell-addon__read-more">Læs mere</a>
        </div>
      </div>
    `;
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
          this.listEl = this.querySelector('[data-upsell-list]') || this.querySelector('.upsell-addon__list');
          this.footerEl = this.querySelector('[data-upsell-footer]') || this.querySelector('.upsell-addon__footer');
          this.totalPriceEl = this.querySelector('[data-upsell-total]');
          this.mainProductPrice = parseInt(this.getAttribute('data-main-product-price') || 0, 10);
          this.mainProductId = this.getAttribute('data-product-id') || '';
          this.limit = parseInt(this.getAttribute('data-upsell-limit') || '5', 10);

          const recommendationsUrl = this.getAttribute('data-recommendations-url');
          const hasServerItems = this.listEl?.querySelector('[data-upsell-item]');

          if (hasServerItems) {
            // Manual product list or upsell collection rendered in Liquid
            if (this.footerEl) this.footerEl.removeAttribute('hidden');
            this.refreshItems();
          } else if (recommendationsUrl && this.listEl) {
            this.loadRelatedProducts(recommendationsUrl);
          } else {
            this.style.display = 'none';
          }
        }

        async loadRelatedProducts(url) {
          try {
            let products = await this.fetchProducts(url);

            // Prefer true complements; if Search & Discovery returns none, fall back to related
            // but drop near-identical colour variants of the same model.
            if (!products.length && url.includes('intent=complementary')) {
              const fallbackUrl = url.replace('intent=complementary', 'intent=related');
              products = await this.fetchProducts(fallbackUrl);
            }

            const mainTitle = (document.querySelector('h1.product__title, .product__title')?.textContent || '')
              .trim()
              .toLowerCase();

            const filtered = products.filter((product) => {
              if (!product || String(product.id) === String(this.mainProductId)) return false;
              const title = String(product.title || '').toLowerCase();
              if (!mainTitle || !title) return true;
              // Same model, different colour often shares a long title prefix
              const mainCore = mainTitle.replace(/\b(navy|black|white|grey|gray|red|blue|green|brown|pink|beige|olive|khaki|multi|sort|hvid|blå|rød|grøn)\b/gi, '').replace(/\s+/g, ' ').trim();
              const titleCore = title.replace(/\b(navy|black|white|grey|gray|red|blue|green|brown|pink|beige|olive|khaki|multi|sort|hvid|blå|rød|grøn)\b/gi, '').replace(/\s+/g, ' ').trim();
              if (mainCore.length > 12 && titleCore === mainCore) return false;
              return true;
            });

            const html = filtered
              .map((product) => buildUpsellItemHtml(product, this.mainProductId))
              .filter(Boolean)
              .slice(0, this.limit)
              .join('');

            if (!html) {
              this.style.display = 'none';
              return;
            }

            this.listEl.innerHTML = html;
            if (this.footerEl) this.footerEl.removeAttribute('hidden');
            this.refreshItems();
          } catch (err) {
            console.error('[upsell-addon] related products failed', err);
            this.style.display = 'none';
          }
        }

        async fetchProducts(url) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Recommendations failed (${res.status})`);
          const data = await res.json();
          return Array.isArray(data.products) ? data.products : [];
        }

        refreshItems() {
          this.items = this.querySelectorAll('[data-upsell-item]');
          this.bindToggle();
          this.calculateTotal();
        }

        bindToggle() {
          this.items.forEach((item) => {
            if (item.dataset.upsellBound) return;
            item.dataset.upsellBound = '1';
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
