/*
 * Broadcast Theme — custom.js
 * Assortion = cart UI. Theme drawer = hidden stub only.
 */

(function () {
  function isCartStub(node) {
    return node?.hasAttribute?.('data-headzup-cart-stub') || node?.closest?.('[data-headzup-cart-stub]');
  }

  function killThemeCartUI() {
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

  function findAssortionApi() {
    const candidates = [
      window.Assortion?.openCart,
      window.Assortion?.Cart?.open,
      window.Assortion?.cart?.open,
      window.AST?.openCart,
      window.AST?.Cart?.open,
      window.assortion?.openCart,
      window.AssortionCart?.open,
      window.openAssortionCart,
    ];
    for (const fn of candidates) {
      if (typeof fn === 'function') return fn.bind(window.Assortion || window.AST || window.assortion || window);
    }

    // Scan window for Assortion-like objects
    try {
      for (const key of Object.keys(window)) {
        if (!/ast|assort/i.test(key)) continue;
        const val = window[key];
        if (!val || typeof val !== 'object') continue;
        if (typeof val.openCart === 'function') return val.openCart.bind(val);
        if (typeof val.open === 'function') return val.open.bind(val);
        if (val.Cart && typeof val.Cart.open === 'function') return val.Cart.open.bind(val.Cart);
        if (val.cart && typeof val.cart.open === 'function') return val.cart.open.bind(val.cart);
      }
    } catch (e) {}

    return null;
  }

  function openAssortionDrawerDom() {
    const drawers = document.querySelectorAll(
      [
        '#assortion-cart',
        '#ast-cart',
        '#astCartDrawer',
        '#ast-cart-drawer',
        '.assortion-cart-drawer',
        '.ast-cart-drawer',
        '[data-assortion-cart-drawer]',
        '[data-ast-cart-drawer]',
        'assortion-cart',
        '[id*="ast"][id*="cart" i]',
        '[class*="ast-"][class*="cart" i]',
      ].join(', ')
    );

    let opened = false;
    drawers.forEach((drawer) => {
      // skip tiny icons
      if (drawer.closest('header') && drawer.tagName === 'A') return;
      drawer.classList.add('open', 'is-open', 'active', 'is-active', 'visible', 'is-visible');
      drawer.style.display = '';
      drawer.style.visibility = 'visible';
      drawer.style.opacity = '1';
      drawer.style.pointerEvents = 'auto';
      drawer.setAttribute('aria-hidden', 'false');
      opened = true;
    });

    document.querySelectorAll('[class*="ast"][class*="backdrop" i], [class*="assortion"][class*="backdrop" i]').forEach((bg) => {
      bg.classList.add('open', 'is-open', 'active', 'visible');
      bg.style.display = '';
    });

    return opened;
  }

  function openAssortionCart() {
    killThemeCartUI();

    const api = findAssortionApi();
    if (api) {
      try {
        api();
        return true;
      } catch (e) {
        console.warn('Assortion API open failed', e);
      }
    }

    if (openAssortionDrawerDom()) return true;

    document.dispatchEvent(new CustomEvent('assortion:cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('ast:cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('ast:open-cart', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('assortion:cart:open'));

    return openAssortionDrawerDom();
  }

  function openAssortionWithRetry() {
    openAssortionCart();
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (openAssortionCart() || attempts >= 10) clearInterval(id);
    }, 200);
  }

  // Stop /cart page navigation only — Assortion listens on these links
  function bindCartIconLinks() {
    document.querySelectorAll('[data-cart-toggle], a[href="/cart"], a[href$="/cart"]').forEach((link) => {
      if (link.dataset.headzupCartBound) return;
      link.dataset.headzupCartBound = '1';

      // Keep original href for Assortion selectors, but block full page nav
      link.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          killThemeCartUI();
          openAssortionWithRetry();
        },
        false
      );
    });
  }

  // Block native form POST to /cart/add (page refresh)
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
    setTimeout(openAssortionWithRetry, 100);
  });

  document.addEventListener('theme:product:add', () => {
    killThemeCartUI();
    setTimeout(openAssortionWithRetry, 100);
  });

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
    bindCartIconLinks();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'href'],
  });

  killThemeCartUI();
  bindCartIconLinks();
  document.addEventListener('DOMContentLoaded', bindCartIconLinks);

  window.HeadzupCart = {
    open: openAssortionCart,
    openWithRetry: openAssortionWithRetry,
    killTheme: killThemeCartUI,
  };
})();
