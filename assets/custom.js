/*
 * Assortion cart drawer (.ast-cart / .ast-open)
 * React-controlled — class alone can be wiped, so we lock open until user closes.
 */

(function () {
  let lockOpen = false;
  let lockUntil = 0;

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

  function applyAstOpen() {
    const cart = getAstCart();
    if (!cart) return false;

    cart.classList.add('ast-open');
    cart.removeAttribute('hidden');
    cart.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('ast-cart-open');
    document.body.classList.add('ast-cart-open');

    // Soft visibility nudge — avoid fighting Assortion transforms permanently
    cart.style.visibility = 'visible';
    cart.style.opacity = '1';
    cart.style.pointerEvents = 'auto';
    cart.style.zIndex = '2147483000';

    return true;
  }

  function findAssortionOpenApi() {
    const roots = [];
    try {
      for (const key of Object.keys(window)) {
        if (!/^(ast|assort)/i.test(key)) continue;
        roots.push(window[key]);
      }
    } catch (e) {}

    ['Assortion', 'AST', 'ast', 'assortion', '__ASSORTION__', '__AST__'].forEach((k) => {
      if (window[k]) roots.push(window[k]);
    });

    for (const root of roots) {
      if (!root || typeof root !== 'object') continue;
      for (const method of ['openCart', 'open', 'show', 'toggle', 'showCart']) {
        if (typeof root[method] === 'function') {
          try {
            return root[method].bind(root);
          } catch (e) {}
        }
        const nested = root.Cart || root.cart || root.drawer || root.CartDrawer;
        if (nested && typeof nested[method] === 'function') {
          try {
            return nested[method].bind(nested);
          } catch (e) {}
        }
      }
    }
    return null;
  }

  function dispatchAstEvents() {
    ['ast:cart:open', 'assortion:cart:open', 'ast:open-cart', 'assortion:open'].forEach((name) => {
      document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { open: true } }));
      window.dispatchEvent(new CustomEvent(name, { detail: { open: true } }));
    });
    try {
      window.postMessage({ type: 'ast:cart:open', open: true }, '*');
      window.postMessage({ source: 'assortion', action: 'openCart' }, '*');
    } catch (e) {}
  }

  function openAssortionCart() {
    killThemeStubOnly();
    lockOpen = true;
    lockUntil = Date.now() + 8000;

    const api = findAssortionOpenApi();
    if (api) {
      try {
        api();
      } catch (e) {}
    }

    dispatchAstEvents();
    applyAstOpen();

    return isAssortionOpen();
  }

  function openAssortionWithRetry() {
    openAssortionCart();

    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      applyAstOpen();

      // Wait for Assortion to mount .ast-cart (async app embed)
      if (!getAstCart() && attempts < 40) return;

      if (isAssortionOpen() && attempts >= 5) {
        // keep lock briefly so React doesn't immediately close
        if (attempts >= 25) clearInterval(id);
        return;
      }

      openAssortionCart();
      if (attempts >= 40) clearInterval(id);
    }, 150);
  }

  function afterProductAdded() {
    killThemeStubOnly();
    openAssortionWithRetry();
  }

  // Cart icon — capture so Returnflows / theme cannot swallow the click
  document.addEventListener(
    'click',
    (e) => {
      const closeBtn = e.target.closest(
        '.ast-cart [aria-label="Close cart"], .ast-cart__header-actions button, .ast-cart .ast-button--icon-only'
      );
      // Only treat header close as unlock (not qty buttons)
      if (e.target.closest('.ast-cart__header-actions')) {
        lockOpen = false;
        lockUntil = 0;
        document.documentElement.classList.remove('ast-cart-open');
        document.body.classList.remove('ast-cart-open');
        return;
      }

      const link = e.target.closest('[data-cart-toggle], a[href="/cart"], a[href$="/cart"]');
      if (!link) return;
      if (link.closest('.ast-cart')) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      openAssortionWithRetry();
    },
    true
  );

  // Re-apply .ast-open if Assortion React removes it while locked
  const lockObserver = new MutationObserver(() => {
    if (!lockOpen || Date.now() > lockUntil) {
      if (Date.now() > lockUntil) lockOpen = false;
      return;
    }
    const cart = getAstCart();
    if (cart && !cart.classList.contains('ast-open')) {
      cart.classList.add('ast-open');
    }
  });
  lockObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
  });

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

  // Do NOT wrap fetch — Assortion needs its own network intercept intact on PDP

  killThemeStubOnly();

  window.HeadzupCart = {
    open: openAssortionCart,
    openWithRetry: openAssortionWithRetry,
    killTheme: killThemeStubOnly,
    isOpen: isAssortionOpen,
  };
})();
