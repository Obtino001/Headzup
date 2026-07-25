/*
 * Assortion cart UI. Theme cart-drawer = hidden AJAX stub.
 * Mobile often auto-opens; desktop often needs an explicit nudge.
 */

(function () {
  const OPEN_CLASSES = ['open', 'is-open', 'active', 'is-active', 'visible', 'is-visible', 'show', 'is-show'];

  function isThemeStub(node) {
    return !!(node?.hasAttribute?.('data-headzup-cart-stub') || node?.closest?.('[data-headzup-cart-stub]'));
  }

  function killThemeStubOnly() {
    document.querySelectorAll('[data-headzup-cart-stub]').forEach((drawer) => {
      drawer.classList.remove('is-open', 'is-closing');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.style.setProperty('display', 'none', 'important');
    });
  }

  function walk(node, fn) {
    if (!node) return;
    fn(node);
    if (node.shadowRoot) walk(node.shadowRoot, fn);
    const children = node.children || [];
    for (let i = 0; i < children.length; i++) walk(children[i], fn);
  }

  function looksLikeAssortionCart(el) {
    if (!el || el.nodeType !== 1 || isThemeStub(el)) return false;
    if (el.closest?.('header, .header-topbar, nav')) return false;

    const id = (el.id || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : el.className?.baseVal || '').toLowerCase();
    const tag = (el.tagName || '').toLowerCase();
    const attrs = `${el.getAttribute('data-testid') || ''} ${el.getAttribute('role') || ''}`.toLowerCase();

    if (/rebuy/.test(id + cls + tag)) return false;
    if (tag === 'cart-drawer' || tag === 'cart-items') return false;

    if (/assort|ast-cart|ast_cart|astcart/.test(id + cls + tag + attrs)) return true;
    if (el.getAttribute('data-assortion-cart') != null) return true;
    if (el.getAttribute('data-ast-cart') != null) return true;

    const text = (el.textContent || '').slice(0, 500).toLowerCase();
    if (text.includes('indkøbskurv') || text.includes('indkobskurv')) return true;

    return false;
  }

  function collectAssortionNodes() {
    const found = [];
    walk(document.body, (el) => {
      if (looksLikeAssortionCart(el)) found.push(el);
    });
    return found;
  }

  function isVisibleCart(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) return false;
    // Closed drawers often sit off-screen to the right
    if (rect.left > window.innerWidth - 40) return false;
    if (style.transform && /translateX\((100%|[1-9]\d{2,}px)\)/.test(style.transform)) return false;
    return true;
  }

  function isAssortionOpen() {
    return collectAssortionNodes().some(isVisibleCart);
  }

  function revealNode(el) {
    if (!el || isThemeStub(el)) return;
    OPEN_CLASSES.forEach((c) => el.classList.add(c));
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('opacity');
    el.style.removeProperty('pointer-events');
    el.style.setProperty('transform', 'translateX(0)', 'important');
    el.style.setProperty('right', '0', 'important');
    el.style.setProperty('z-index', '2147483000', 'important');
    el.style.setProperty('pointer-events', 'auto', 'important');
    if (typeof el.open === 'function') {
      try {
        el.open();
      } catch (e) {}
    }
    if ('open' in el && typeof el.open === 'boolean') {
      try {
        el.open = true;
      } catch (e) {}
    }
  }

  function findAssortionApi() {
    const keys = Object.keys(window).filter((k) => /ast|assort/i.test(k));
    for (const key of keys) {
      const val = window[key];
      if (!val) continue;
      if (typeof val === 'function' && /open|cart/i.test(key)) {
        try {
          return val.bind(window);
        } catch (e) {}
      }
      if (typeof val !== 'object') continue;
      for (const method of ['openCart', 'open', 'show', 'toggle', 'showCart', 'openDrawer']) {
        if (typeof val[method] === 'function') return val[method].bind(val);
        if (val.Cart && typeof val.Cart[method] === 'function') return val.Cart[method].bind(val.Cart);
        if (val.cart && typeof val.cart[method] === 'function') return val.cart[method].bind(val.cart);
        if (val.drawer && typeof val.drawer[method] === 'function') return val.drawer[method].bind(val.drawer);
      }
    }
    return null;
  }

  function dispatchOpenEvents() {
    const names = [
      'assortion:cart:open',
      'ast:cart:open',
      'ast:open-cart',
      'assortion:open',
      'cart:open',
      'open-cart',
    ];
    names.forEach((name) => {
      document.dispatchEvent(new CustomEvent(name, { bubbles: true }));
      window.dispatchEvent(new CustomEvent(name));
    });
    try {
      window.postMessage({ type: 'assortion:cart:open' }, '*');
      window.postMessage({ source: 'assortion', action: 'openCart' }, '*');
    } catch (e) {}
  }

  function openAssortionCart() {
    killThemeStubOnly();
    if (isAssortionOpen()) return true;

    const api = findAssortionApi();
    if (api) {
      try {
        api();
        if (isAssortionOpen()) return true;
      } catch (e) {
        console.warn('[HeadzupCart] Assortion API failed', e);
      }
    }

    dispatchOpenEvents();

    const nodes = collectAssortionNodes();
    nodes.forEach(revealNode);
    // Also reveal likely parents (flyout wrappers)
    nodes.forEach((node) => {
      let p = node.parentElement;
      for (let i = 0; i < 4 && p; i++) {
        if (looksLikeAssortionCart(p) || /assort|ast-cart/i.test((p.id || '') + (p.className || ''))) {
          revealNode(p);
        }
        p = p.parentElement;
      }
    });

    return isAssortionOpen() || nodes.length > 0;
  }

  function openAssortionWithRetry() {
    openAssortionCart();
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (isAssortionOpen() || openAssortionCart() || attempts >= 12) clearInterval(id);
    }, 200);
  }

  // After ATC: Assortion may auto-open (mobile). If not, force on desktop.
  function afterProductAdded() {
    killThemeStubOnly();
    setTimeout(() => {
      if (!isAssortionOpen()) openAssortionWithRetry();
    }, 250);
    setTimeout(() => {
      if (!isAssortionOpen()) openAssortionWithRetry();
    }, 800);
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

  // Watch Assortion mount late, then ensure cart icon is bound
  const observer = new MutationObserver(() => {
    const openStub = document.querySelector('[data-headzup-cart-stub].is-open');
    if (openStub) killThemeStubOnly();
    bindCartIcon();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'href', 'style'],
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

  // If Assortion uses fetch interception, also nudge after our own ATC fetches settle
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function () {
      const args = arguments;
      const input = args[0];
      const url = typeof input === 'string' ? input : input?.url || '';
      return originalFetch.apply(this, args).then((response) => {
        if (/\/cart\/(add|change|update)/.test(url)) {
          setTimeout(() => {
            if (!isAssortionOpen()) openAssortionWithRetry();
          }, 300);
        }
        return response;
      });
    };
  }

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
