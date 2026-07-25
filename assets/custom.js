/*
 * Broadcast Theme — custom.js
 * Cart: Assortion app drawer only. Theme cart drawer stays OFF.
 * Do NOT open Rebuy — store uses Assortion.
 */

(function () {
  function killThemeCartDrawer() {
    document
      .querySelectorAll(
        'cart-drawer, #cart-drawer, .drawer--cart, [data-section-type="cart-drawer"], .shopify-section:has(cart-drawer)'
      )
      .forEach((node) => node.remove());

    document
      .querySelectorAll(
        'cart-drawer .underlay, .drawer--cart .underlay, .drawer--cart .drawer__underlay, cart-drawer .drawer__underlay'
      )
      .forEach((el) => el.remove());

    document.dispatchEvent(new CustomEvent('theme:scroll:unlock', { bubbles: true }));
  }

  function openAssortionCart() {
    killThemeCartDrawer();

    // Assortion / common app APIs
    try {
      if (typeof window.Assortion?.openCart === 'function') {
        window.Assortion.openCart();
        return true;
      }
      if (typeof window.Assortion?.Cart?.open === 'function') {
        window.Assortion.Cart.open();
        return true;
      }
      if (typeof window.AST?.openCart === 'function') {
        window.AST.openCart();
        return true;
      }
      if (typeof window.AST?.Cart?.open === 'function') {
        window.AST.Cart.open();
        return true;
      }
      if (typeof window.assortion?.openCart === 'function') {
        window.assortion.openCart();
        return true;
      }
    } catch (e) {
      console.warn('Assortion openCart error', e);
    }

    // Shopify standard action (Assortion may hook this)
    try {
      if (window.Shopify?.actions?.openCart) {
        window.Shopify.actions.openCart();
        return true;
      }
    } catch (e) {}

    // Events Assortion-style carts often listen for
    document.dispatchEvent(new CustomEvent('assortion:cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('ast:cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));

    // Click Assortion cart UI if present
    const trigger = document.querySelector(
      [
        '[data-assortion-open-cart]',
        '[data-ast-open-cart]',
        '.ast-cart-toggle',
        '#ast-cart-icon',
        '.assortion-cart-button',
        '[data-assortion-cart]',
      ].join(', ')
    );
    if (trigger) {
      trigger.click();
      return true;
    }

    return false;
  }

  function openAssortionWithRetry() {
    if (openAssortionCart()) return;
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (openAssortionCart() || attempts >= 12) clearInterval(id);
    }, 200);
  }

  // After ATC — open Assortion, never theme / Rebuy
  document.addEventListener('theme:product:added', () => {
    killThemeCartDrawer();
    setTimeout(() => {
      killThemeCartDrawer();
      openAssortionWithRetry();
    }, 150);
  });

  document.addEventListener('theme:product:add', () => {
    killThemeCartDrawer();
    setTimeout(() => {
      killThemeCartDrawer();
      openAssortionWithRetry();
    }, 150);
  });

  // Cart icon → Assortion (do not open Rebuy / theme)
  document.addEventListener(
    'click',
    (event) => {
      const cartToggle = event.target.closest(
        '[data-cart-toggle], .header-topbar__icon--cart, a[href="/cart"], a[href$="/cart"]'
      );
      if (!cartToggle) return;
      if (event.target.closest('[data-add-to-cart], [data-quick-add-btn], .quick-add__holder, form[action*="/cart/add"]')) {
        return;
      }
      // Let Assortion's own buttons work
      if (cartToggle.closest('[class*="ast-"], [id*="ast-"], [class*="assortion"], [id*="assortion"]')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      killThemeCartDrawer();
      openAssortionCart();
    },
    true
  );

  document.addEventListener('theme:cart-drawer:show', (event) => {
    event.stopImmediatePropagation();
    killThemeCartDrawer();
    openAssortionCart();
  });

  document.addEventListener('theme:cart:toggle', (event) => {
    event.stopImmediatePropagation();
    killThemeCartDrawer();
    openAssortionCart();
  });

  // Watcher: if theme cart ever appears, delete it
  const observer = new MutationObserver(() => {
    if (document.querySelector('cart-drawer, .drawer--cart, [data-section-type="cart-drawer"]')) {
      killThemeCartDrawer();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  killThemeCartDrawer();

  // Expose for gift/addon script
  window.HeadzupCart = {
    open: openAssortionCart,
    openWithRetry: openAssortionWithRetry,
    killTheme: killThemeCartDrawer,
  };
})();
