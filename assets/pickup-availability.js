!(function () {
  'use strict';

  function FetchError(opts) {
    this.status = opts.status || null;
    this.headers = opts.headers || null;
    this.json = opts.json || null;
    this.body = opts.body || null;
  }
  FetchError.prototype = Error.prototype;

  const ATTR_VARIANT = 'data-store-availability-container';
  const SELECTOR_SECTION = '.shopify-section';
  const SELECTOR_DRAWER = '[data-pickup-drawer]';
  const SELECTOR_SECTION_TYPE = '[data-section-type]';
  const CLASS_HIDDEN = 'hidden';

  class PickupAvailability extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.container = this.closest(SELECTOR_SECTION_TYPE);
      this.drawer = null;
      if (this.container) {
        this.container.addEventListener('theme:variant:change', (event) =>
          this.fetchPickupAvailability(event)
        );
      }
      this.fetchPickupAvailability();
    }

    fetchPickupAvailability(event) {
      if (
        (event && !event.detail.variant) ||
        (event && event.detail.variant && !event.detail.variant.available)
      ) {
        this.classList.add(CLASS_HIDDEN);
        return;
      }

      const variantId =
        event && event.detail.variant
          ? event.detail.variant.id
          : this.getAttribute(ATTR_VARIANT);

      if (!variantId) return;

      const root = (window.theme && window.theme.routes && window.theme.routes.root) || '/';

      fetch(`${root}variants/${variantId}/?section_id=api-pickup-availability`)
        .then(this.handleErrors)
        .then((response) => response.text())
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const section = doc.querySelector(SELECTOR_SECTION);
          if (!section) {
            this.classList.add(CLASS_HIDDEN);
            return;
          }

          this.innerHTML = section.innerHTML;
          this.drawer = this.querySelector(SELECTOR_DRAWER);

          if (this.drawer) {
            this.classList.remove(CLASS_HIDDEN);
            this.bindDrawerTriggers();
          } else {
            this.classList.add(CLASS_HIDDEN);
          }
        })
        .catch((error) => {
          console.error(error);
        });
    }

    bindDrawerTriggers() {
      const openButtons = this.querySelectorAll('[data-popup-open], .pickup__button');
      openButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          this.openDrawer();
        });
      });

      const closeButtons = this.querySelectorAll('[data-popup-close]');
      closeButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          this.closeDrawer();
        });
      });

      if (this.drawer) {
        this.drawer.addEventListener('click', (event) => {
          if (event.target === this.drawer) this.closeDrawer();
        });
      }
    }

    openDrawer() {
      if (!this.drawer) return;

      if (typeof this.drawer.showModal === 'function') {
        this.drawer.showModal();
      } else {
        this.drawer.setAttribute('open', '');
      }

      document.dispatchEvent(new CustomEvent('theme:scroll:lock', { bubbles: true }));
    }

    closeDrawer() {
      if (!this.drawer) return;

      if (typeof this.drawer.close === 'function') {
        this.drawer.close();
      } else {
        this.drawer.removeAttribute('open');
      }

      document.dispatchEvent(new CustomEvent('theme:scroll:unlock', { bubbles: true }));
    }

    handleErrors(response) {
      if (response.ok) return response;
      return response.json().then(function (json) {
        throw new FetchError({
          status: response.statusText,
          headers: response.headers,
          json: json,
        });
      });
    }
  }

  if (!customElements.get('pickup-availability')) {
    customElements.define('pickup-availability', PickupAvailability);
  }
})();
