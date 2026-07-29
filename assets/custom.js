/*
 * Cart icon: prefer Assortion drawer when available, otherwise go to /cart.
 * Theme cart-drawer open is a no-op stub — never block the cart link.
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
    const href = link?.getAttribute?.('href') || (window.theme?.routes?.cart_url) || '/cart';
    window.location.assign(href);
  }

  function onCartIconClick(e) {
    const link = e.currentTarget;
    // Let modifier-clicks / new-tab behave normally
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;

    e.preventDefault();

    if (openAssortionCart()) return;

    // Brief retry in case Assortion boots late after ATC, then fall back to /cart
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
      // Skip Returnflows / other app activators
      if (link.hasAttribute('data-returnflows-open')) return;
      link.dataset.headzupCartBound = '1';
      link.addEventListener('click', onCartIconClick, false);
    });
  }

  bindCartIcons();
  document.addEventListener('DOMContentLoaded', bindCartIcons);
  document.addEventListener('shopify:section:load', bindCartIcons);

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
