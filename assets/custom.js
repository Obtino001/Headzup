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

  /*
   * The button is never disabled while a size is missing — it reads "Vælg størrelse"
   * and opens the size picker. Once a size is picked the theme's variant handler
   * relabels it, so all that is left here is dropping the marker attribute.
   */
  function unlockAddToCartAfterSizeSelect() {
    const pending = document.querySelectorAll('[data-pending-size]');
    if (!pending.length) return;

    const stillPending = Array.from(pending).some((input) => !input.value);
    if (stillPending) return;

    document.querySelectorAll('[data-add-to-cart][data-require-size-select]').forEach((btn) => {
      btn.removeAttribute('disabled');
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('data-require-size-select');
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
