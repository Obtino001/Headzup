/*
 * Cart icon: prefer Assortion drawer when available, otherwise go to /cart.
 * Theme cart-drawer open is a no-op stub — never block the cart link.
 * Also: force explicit size selection on PDP before ATC.
 */

(function () {
  function findAssortionOpen() {
    const paths = [
      ['Assortion', 'openCart'],
      ['Assortion', 'Cart', 'open'],
      ['Assortion', 'cart', 'open'],
      ['Assortion', 'open'],
      ['AST', 'openCart'],
      ['AST', 'Cart', 'open'],
      ['AST', 'open'],
      ['assortion', 'openCart'],
      ['assortion', 'open'],
      ['AssortionCart', 'open'],
      ['AssortionCart', 'openCart'],
    ];

    for (const path of paths) {
      let ctx = window;
      let fn = null;
      for (let i = 0; i < path.length; i++) {
        ctx = ctx?.[path[i]];
        if (ctx == null) break;
        if (i === path.length - 1 && typeof ctx === 'function') fn = ctx;
      }
      if (fn) {
        const owner = path.length > 1 ? path.slice(0, -1).reduce((o, k) => o?.[k], window) : window;
        return fn.bind(owner || window);
      }
    }

    return null;
  }

  function openAssortionCart() {
    const api = findAssortionOpen();
    if (!api) return false;
    try {
      api();
      return true;
    } catch (e) {
      console.warn('[HeadzupCart] Assortion open failed', e);
      return false;
    }
  }

  function goToCart(link) {
    const href = link?.getAttribute?.('href') || window.theme?.routes?.cart_url || '/cart';
    window.location.assign(href);
  }

  function onCartIconClick(e) {
    const link = e.currentTarget;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;

    e.preventDefault();

    if (openAssortionCart()) return;

    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (openAssortionCart()) {
        clearInterval(id);
        return;
      }
      if (attempts >= 6) {
        clearInterval(id);
        goToCart(link);
      }
    }, 100);
  }

  function bindCartIcons() {
    document.querySelectorAll('[data-cart-toggle], a[href="/cart"], a[href$="/cart"]').forEach((link) => {
      if (link.dataset.headzupCartBound === '1') return;
      if (link.hasAttribute('data-returnflows-open')) return;
      link.dataset.headzupCartBound = '1';
      link.addEventListener('click', onCartIconClick, false);
    });
  }

  function unlockAddToCartAfterSizeSelect() {
    const pending = document.querySelectorAll('[data-pending-size]');
    if (!pending.length) return;

    const stillPending = Array.from(pending).some((input) => !input.value);
    const buttons = document.querySelectorAll('[data-add-to-cart][data-require-size-select]');

    buttons.forEach((btn) => {
      if (stillPending) {
        btn.setAttribute('disabled', 'disabled');
        btn.setAttribute('aria-disabled', 'true');
        return;
      }
      btn.removeAttribute('disabled');
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('data-require-size-select');
      const label = btn.querySelector('[data-add-to-cart-text]');
      if (label) {
        const addLabel =
          window.theme?.strings?.addToCart ||
          (document.documentElement.lang?.startsWith('da') ? 'Tilføj til kurv' : 'Add to cart');
        // Only replace placeholder select-size copy
        const text = (label.textContent || '').trim().toLowerCase();
        if (text.includes('vælg størrelse') || text.includes('select size')) {
          label.textContent = addLabel;
        }
      }
    });
  }

  function bindForceSizeSelect() {
    document.querySelectorAll('[data-force-size-select]').forEach((popout) => {
      if (popout.dataset.sizeSelectBound === '1') return;
      popout.dataset.sizeSelectBound = '1';

      popout.addEventListener('click', (e) => {
        const option = e.target.closest('[data-popout-option]');
        if (!option) return;
        const input = popout.querySelector('[data-pending-size]');
        if (input) {
          input.value = option.getAttribute('data-value') || '';
          input.removeAttribute('data-pending-size');
        }
        popout.removeAttribute('data-force-size-select');
        // Allow theme variant change handlers to run, then unlock ATC
        setTimeout(unlockAddToCartAfterSizeSelect, 50);
      });
    });

    unlockAddToCartAfterSizeSelect();
  }

  bindCartIcons();
  bindForceSizeSelect();
  document.addEventListener('DOMContentLoaded', () => {
    bindCartIcons();
    bindForceSizeSelect();
  });
  document.addEventListener('shopify:section:load', () => {
    bindCartIcons();
    bindForceSizeSelect();
  });

  window.HeadzupCart = {
    open: openAssortionCart,
    openWithRetry: function () {
      if (openAssortionCart()) return;
      let attempts = 0;
      const id = setInterval(() => {
        attempts += 1;
        if (openAssortionCart() || attempts >= 8) clearInterval(id);
      }, 200);
    },
  };
})();
