!function () {
  "use strict";
  const TAG = "complementary-products";
  const ATTR_URL = "data-url";
  const ATTR_SLIDER = "data-slider";
  const ATTR_INJECT = "data-inject-selector";

  class ComplementaryProducts extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      new IntersectionObserver(
        (entries, observer) => {
          if (!entries[0].isIntersecting) return;
          observer.unobserve(this);

          const url = this.getAttribute(ATTR_URL);
          if (!url) return;

          fetch(url)
            .then((res) => res.text())
            .then((html) => {
              const wrapper = document.createElement("div");
              wrapper.innerHTML = html;

              const injectSelector = this.getAttribute(ATTR_INJECT);
              if (injectSelector) {
                const source = wrapper.querySelector("[data-upsell-recommendations]");
                const target = this.querySelector(injectSelector);
                const host = this.querySelector("upsell-addon");
                if (source && target && source.innerHTML.trim().length) {
                  target.innerHTML = source.innerHTML;
                  if (host) host.removeAttribute("hidden");
                  this.dispatchEvent(
                    new CustomEvent("theme:upsell:loaded", {
                      bubbles: true,
                      detail: { container: this },
                    })
                  );
                }
                return;
              }

              const section = wrapper.querySelector(TAG);
              if (section && section.innerHTML.trim().length) {
                this.innerHTML = section.innerHTML;
                if (this.hasAttribute(ATTR_SLIDER)) {
                  this.dispatchEvent(
                    new CustomEvent("theme:complementary:loaded", {
                      bubbles: true,
                      detail: { container: this },
                    })
                  );
                }
              }
            })
            .catch((err) => console.error(err));
        },
        { rootMargin: "0px 0px 400px 0px" }
      ).observe(this);
    }
  }

  if (!customElements.get(TAG)) {
    customElements.define(TAG, ComplementaryProducts);
  }
}();
