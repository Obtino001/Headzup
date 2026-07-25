/*
 * Broadcast Theme — custom.js
 * Assortion = cart UI. Theme drawer hidden stub only (no refresh to /cart).
 */

(function () {
  function isCartStub(node) {
    return node?.hasAttribute?.('data-headzup-cart-stub') || node?.closest?.('[data-headzup-cart-stub]');
  }

  function killThemeCartUI() {
    // Never remove the AJAX stub — only kill real theme drawer UI / open state
    document.querySelectorAll('cart-drawer, .drawer--cart').forEach((drawer) => {
      drawer.classList.remove('is-open', 'is-closing');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.style.setProperty('display', 'none', 'important');
      if (!isCartStub(drawer) && !drawer.querySelector('cart-items')) {
        drawer.remove();
      }
    });

    document
      .querySelectorAll(
        '.drawer--cart:not([data-headzup-cart-stub]) .underlay, .drawer--cart:not([data-headzup-cart-stub]) .drawer__underlay'
      )
      .forEach((el) => el.remove());

    document.dispatchEvent(new CustomEvent('theme:scroll:unlock', { bubbles: true }));
  }

  function openAssortionCart() {
    killThemeCartUI();

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
      // Some Assortion builds expose these
      if (typeof window.openAssortionCart === 'function') {
        window.openAssortionCart();
        return true;
      }
      if (window.AssortionCart?.open) {
        window.AssortionCart.open();
        return true;
      }
    } catch (e) {
      console.warn('Assortion openCart error', e);
    }

    document.dispatchEvent(new CustomEvent('assortion:cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('ast:cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));

    // Open Assortion drawer DOM if present
    const drawer = document.querySelector(
      [
        '#assortion-cart',
        '#ast-cart',
        '#astCartDrawer',
        '.assortion-cart-drawer',
        '.ast-cart-drawer',
        '[data-assortion-cart-drawer]',
        '[class*="AssortionCart"]',
        'assortion-cart',
      ].join(', ')
    );
    if (drawer) {
      drawer.classList.add('open', 'is-open', 'active', 'is-active', 'visible', 'is-visible');
      drawer.style.removeProperty('display');
      drawer.setAttribute('aria-hidden', 'false');
      const backdrop = document.querySelector(
        '.assortion-cart-backdrop, .ast-cart-backdrop, [data-assortion-backdrop]'
      );
      if (backdrop) {
        backdrop.classList.add('open', 'is-open', 'active', 'visible');
        backdrop.style.removeProperty('display');
      }
      return true;
    }

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
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    }

    return false;
  }

  function openAssortionWithRetry() {
    openAssortionCart();
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      openAssortionCart();
      if (attempts >= 8) clearInterval(id);
    }, 250);
  }

  // Block native form POST to /cart/add (causes full page refresh)
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = (form.getAttribute('action') || '').toLowerCase();
      if (action.includes('/cart/add')) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );

  document.addEventListener('theme:product:added', () => {
    killThemeCartUI();
    setTimeout(() => {
      killThemeCartUI();
      openAssortionWithRetry();
    }, 100);
  });

  document.addEventListener('theme:product:add', () => {
    killThemeCartUI();
    setTimeout(() => {
      killThemeCartUI();
      openAssortionWithRetry();
    }, 100);
  });

  // Cart icon: stop /cart page navigation, but do NOT stopPropagation —
  // Assortion must receive the click to open its drawer.
  document.addEventListener(
    'click',
    (event) => {
      const cartToggle = event.target.closest(
        '[data-cart-toggle], .header-topbar__icon--cart, a[href="/cart"], a[href$="/cart"]'
      );
      if (!cartToggle) return;
      if (
        event.target.closest(
          '[data-add-to-cart], [data-quick-add-btn], .quick-add__holder, form[action*="/cart/add"]'
        )
      ) {
        return;
      }

      event.preventDefault(); // block navigation to /cart page only
      killThemeCartUI();
      openAssortionCart();
    },
    false // bubble — Assortion capture listeners run first
  );

  document.addEventListener('theme:cart-drawer:show', (event) => {
    event.stopImmediatePropagation();
    killThemeCartUI();
    openAssortionCart();
  });

  document.addEventListener('theme:cart:toggle', (event) => {
    event.stopImmediatePropagation();
    killThemeCartUI();
    openAssortionCart();
  });

  const observer = new MutationObserver(() => {
    const openTheme = document.querySelector(
      'cart-drawer.is-open:not([data-headzup-cart-stub]), .drawer--cart.is-open:not([data-headzup-cart-stub])'
    );
    if (openTheme) killThemeCartUI();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  killThemeCartUI();

  window.HeadzupCart = {
    open: openAssortionCart,
    openWithRetry: openAssortionWithRetry,
    killTheme: killThemeCartUI,
  };
})();
