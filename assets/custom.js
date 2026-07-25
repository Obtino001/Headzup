/*
 * Assortion = cart UI. Theme cart-drawer = hidden AJAX stub only.
 * Do not force-open Assortion after ATC (app opens via network intercept).
 * Cart icon: open Assortion without navigating to /cart.
 */

(function () {
  function isThemeStub(node) {
    return !!(node?.hasAttribute?.('data-headzup-cart-stub') || node?.closest?.('[data-headzup-cart-stub]'));
  }

  function killThemeStubOnly() {
    document.querySelectorAll('[data-headzup-cart-stub], cart-drawer#cart-drawer').forEach((drawer) => {
      if (!isThemeStub(drawer) && drawer.id === 'cart-drawer' && !drawer.hasAttribute('data-headzup-cart-stub')) {
        // Don't touch a non-stub #cart-drawer if Assortion reused the id
        if (!drawer.closest('[data-section-type="cart-drawer"]')) return;
      }
      drawer.classList.remove('is-open', 'is-closing');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.style.setProperty('display', 'none', 'important');
    });
  }

  function findAssortionApi() {
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
      ['AssortionCart', 'show'],
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

    try {
      for (const key of Object.keys(window)) {
        if (!/^(ast|assort)/i.test(key)) continue;
        const val = window[key];
        if (!val || typeof val !== 'object') continue;
        for (const method of ['openCart', 'open', 'show', 'toggle']) {
          if (typeof val[method] === 'function') return val[method].bind(val);
          if (val.Cart && typeof val.Cart[method] === 'function') return val.Cart[method].bind(val.Cart);
          if (val.cart && typeof val.cart[method] === 'function') return val.cart[method].bind(val.cart);
        }
      }
    } catch (e) {}

    return null;
  }

  function isAssortionDrawer(el) {
    if (!el || isThemeStub(el)) return false;
    if (el.matches?.('[data-headzup-cart-stub]')) return false;
    const id = (el.id || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const tag = (el.tagName || '').toLowerCase();
    return (
      /assort|ast-cart|ast_cart/.test(id) ||
      /assort|ast-cart|ast_cart/.test(cls) ||
      tag.includes('assort') ||
      el.getAttribute?.('data-assortion-cart') != null ||
      el.getAttribute?.('data-ast-cart') != null
    );
  }

  function openAssortionDrawerDom() {
    const candidates = document.querySelectorAll(
      [
        '[data-assortion-cart]',
        '[data-ast-cart]',
        '[data-assortion-cart-drawer]',
        '[data-ast-cart-drawer]',
        '#assortion-cart',
        '#ast-cart',
        '#ast-cart-drawer',
        'assortion-cart',
        'ast-cart-drawer',
        '[id*="assortion" i]',
        '[class*="assortion-cart" i]',
        '[class*="ast-cart" i]',
      ].join(', ')
    );

    let opened = false;
    candidates.forEach((drawer) => {
      if (!isAssortionDrawer(drawer) && !drawer.matches?.('[data-assortion-cart], [data-ast-cart], assortion-cart, ast-cart-drawer')) {
        // allow id/class matches
        if (!/assort|ast-cart/i.test(drawer.id + drawer.className)) return;
      }
      if (drawer.closest('header') && drawer.tagName === 'A') return;

      drawer.classList.add('open', 'is-open', 'active', 'is-active', 'visible', 'is-visible');
      drawer.removeAttribute('hidden');
      drawer.setAttribute('aria-hidden', 'false');
      drawer.style.removeProperty('display');
      drawer.style.removeProperty('visibility');
      drawer.style.removeProperty('opacity');
      drawer.style.pointerEvents = 'auto';
      if (typeof drawer.open === 'function') {
        try {
          drawer.open();
        } catch (e) {}
      }
      opened = true;
    });

    return opened;
  }

  function clickAssortionOpenControls() {
    const btn = document.querySelector(
      [
        '[data-assortion-open-cart]',
        '[data-ast-open-cart]',
        'button[aria-label*="cart" i][class*="assort" i]',
        'button[class*="assort"][class*="cart" i]',
        'a[class*="assort"][class*="cart" i]',
      ].join(', ')
    );
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  function openAssortionCart() {
    killThemeStubOnly();

    const api = findAssortionApi();
    if (api) {
      try {
        api();
        return true;
      } catch (e) {
        console.warn('[HeadzupCart] Assortion API failed', e);
      }
    }

    if (clickAssortionOpenControls()) return true;
    if (openAssortionDrawerDom()) return true;

    document.dispatchEvent(new CustomEvent('assortion:cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('ast:cart:open', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('ast:open-cart', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('assortion:cart:open'));

    return openAssortionDrawerDom();
  }

  function openAssortionWithRetry() {
    openAssortionCart();
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (openAssortionCart() || attempts >= 8) clearInterval(id);
    }, 250);
  }

  // Cart icon → Assortion (do not leave this to theme stub / /cart page)
  function bindCartIcon() {
    document.querySelectorAll('[data-cart-toggle], a[href="/cart"], a[href$="/cart"]').forEach((link) => {
      if (link.dataset.headzupCartBound === '1') return;
      link.dataset.headzupCartBound = '1';
      link.addEventListener(
        'click',
        (e) => {
          // Block /cart page nav only — do not stopPropagation so Assortion can hear the click too
          e.preventDefault();
          killThemeStubOnly();
          openAssortionWithRetry();
        },
        false
      );
    });
  }

  // Block native form POST to /cart/add (full page refresh) — theme uses AJAX click path
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = (form.getAttribute('action') || '').toLowerCase();
      if (!action.includes('/cart/add')) return;
      // Let theme AJAX / Assortion handle — only block real navigations
      if (form.closest('product-form') || form.querySelector('[data-add-to-cart]')) {
        event.preventDefault();
      }
    },
    true
  );

  // After ATC: only kill theme stub — Assortion opens itself
  document.addEventListener('theme:product:added', () => {
    killThemeStubOnly();
  });

  document.addEventListener('theme:cart-drawer:show', (event) => {
    event.stopImmediatePropagation();
    killThemeStubOnly();
  });

  document.addEventListener('theme:cart:toggle', (event) => {
    event.stopImmediatePropagation();
    killThemeStubOnly();
    openAssortionWithRetry();
  });

  const observer = new MutationObserver(() => {
    const openStub = document.querySelector(
      'cart-drawer[data-headzup-cart-stub].is-open, .drawer--cart[data-headzup-cart-stub].is-open'
    );
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
  };
})();
