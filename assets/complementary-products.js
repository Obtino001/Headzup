!function () {
  "use strict";
  const TAG = "complementary-products";
  const ATTR_URL = "data-url";
  const ATTR_FALLBACK = "data-fallback-url";
  const ATTR_SLIDER = "data-slider";

  class ComplementaryProducts extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      new IntersectionObserver(
        (entries, observer) => {
          if (!entries[0].isIntersecting) return;
          observer.unobserve(this);
          this.loadRecommendations();
        },
        { rootMargin: "0px 0px 400px 0px" }
      ).observe(this);
    }

    loadFromUrl(url) {
      if (!url) return Promise.resolve(false);
      return fetch(url)
        .then((res) => res.text())
        .then((html) => {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = html;
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
            return true;
          }
          return false;
        })
        .catch((err) => {
          console.error(err);
          return false;
        });
    }

    loadRecommendations() {
      const primary = this.getAttribute(ATTR_URL) || "";
      const fallback = this.getAttribute(ATTR_FALLBACK) || "";
      if (!primary) return;

      this.loadFromUrl(primary).then((loaded) => {
        if (!loaded && fallback) this.loadFromUrl(fallback);
      });
    }
  }

  if (!customElements.get(TAG)) {
    customElements.define(TAG, ComplementaryProducts);
  }
})();
