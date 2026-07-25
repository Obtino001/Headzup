/*
 * Assortion cart: .ast-cart + .ast-open
 * Theme cart-drawer stub stays hidden for AJAX ATC only.
 */

(function () {
  function killThemeStubOnly() {
    document.querySelectorAll('[data-headzup-cart-stub]').forEach((drawer) => {
      drawer.classList.remove('is-open', 'is-closing');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.style.setProperty('display', 'none', 'important');
    });
  }

  function getAstCart() {
    return document.querySelector('.ast-cart');
  }

  function isAssortionOpen() {
    const cart = getAstCart();
    return !!(cart && cart.classList.contains('ast-open'));
  }

  function openAssortionCart() {
    killThemeStubOnly();

    const cart = getAstCart();
    if (!cart) return false;

    cart.classList.add('ast-open');
    cart.removeAttribute('hidden');
    cart.setAttribute('aria-hidden', 'false');

    // Clear any leftover theme overrides that could hide it
    cart.style.removeProperty('display');
    cart.style.removeProperty('visibility');
    cart.style.removeProperty('opacity');
    cart.style.removeProperty('pointer-events');
    cart.style.removeProperty('transform');
    cart.style.removeProperty('z-index');

    return cart.classList.contains('ast-open');
  }

  function openAssortionWithRetry() {
    openAssortionCart();
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (openAssortionCart() || attempts >= 15) clearInterval(id);
    }, 200);
  }

  function afterProductAdded() {
    killThemeStubOnly();
    // Assortion may auto-open; if not (common on PDP), force .ast-open
    setTimeout(() => {
      if (!isAssortionOpen()) openAssortionWithRetry();
    }, 150);
    setTimeout(() => {
      if (!isAssortionOpen()) openAssortionWithRetry();
    }, 600);
    setTimeout(() => {
      if (!isAssortionOpen()) openAssortionWithRetry();
    }, 1200);
  }

  function bindCartIcon() {
    document.querySelectorAll('[data-cart-toggle], a[href="/cart"], a[href$="/cart"]').forEach((link) => {
      if (link.dataset.headzupCartBound === '1') return;
      link.dataset.headzupCartBound = '1';
      link.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          killThemeStubOnly();
          openAssortionWithRetry();
        },
        false
      );
    });
  }

  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = (form.getAttribute('action') || '').toLowerCase();
      if (!action.includes('/cart/add')) return;
      if (form.closest('product-form') || form.querySelector('[data-add-to-cart]')) {
        event.preventDefault();
      }
    },
    true
  );

  document.addEventListener('theme:product:added', afterProductAdded);
  document.addEventListener('theme:product:add', afterProductAdded);

  document.addEventListener('theme:cart-drawer:show', (event) => {
    event.stopImmediatePropagation();
    killThemeStubOnly();
    openAssortionWithRetry();
  });

  document.addEventListener('theme:cart:toggle', (event) => {
    event.stopImmediatePropagation();
    killThemeStubOnly();
    openAssortionWithRetry();
  });

  // After any cart mutation Assortion syncs — ensure drawer is open on PDP ATC
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function () {
      const input = arguments[0];
      const url = typeof input === 'string' ? input : input?.url || '';
      return originalFetch.apply(this, arguments).then((response) => {
        if (/\/cart\/(add|change|update)/.test(url)) {
          setTimeout(() => {
            if (!isAssortionOpen()) openAssortionWithRetry();
          }, 250);
        }
        return response;
      });
    };
  }

  const observer = new MutationObserver(() => {
    const openStub = document.querySelector('[data-headzup-cart-stub].is-open');
    if (openStub) killThemeStubOnly();
    bindCartIcon();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'href'],
  });

  killThemeStubOnly();
  bindCartIcon();
  document.addEventListener('DOMContentLoaded', bindCartIcon);

  window.HeadzupCart = {
    open: openAssortionCart,
    openWithRetry: openAssortionWithRetry,
    killTheme: killThemeStubOnly,
    isOpen: isAssortionOpen,
  };
})();
