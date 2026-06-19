!function(){
  "use strict";

  class ProductModel extends window.theme.DeferredMedia {
    constructor() {
      super();
    }
    loadContent() {
      super.loadContent();
      Shopify.loadFeatures([{
        name: "model-viewer-ui",
        version: "1.0",
        onLoad: this.setupModelViewerUI.bind(this)
      }]);
    }
    setupModelViewerUI(t) {
      if (!t) {
        this.modelViewerUI = new Shopify.ModelViewerUI(this.querySelector("model-viewer"));
      }
    }
  }

  window.ProductModel = {
    loadShopifyXR() {
      Shopify.loadFeatures([{
        name: "shopify-xr",
        version: "1.0",
        onLoad: this.setupShopifyXR.bind(this)
      }]);
    },
    setupShopifyXR(t) {
      if (!t) {
        if (window.ShopifyXR) {
          document.querySelectorAll('[id^="ModelJSON-"]').forEach((t) => {
            window.ShopifyXR.addModels(JSON.parse(t.textContent));
            t.remove();
          });
          window.ShopifyXR.setupXRElements();
        } else {
          document.addEventListener("shopify_xr_initialized", () => this.setupShopifyXR());
        }
      }
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    if (window.ProductModel && window.ProductModel.loadShopifyXR) {
      window.ProductModel.loadShopifyXR();
    }
  });

  const e = "[data-add-to-cart]";
  const r = "[data-product-json]";
  const o = "[data-product-form]";
  const i = "#cart-bar";
  const s = "[data-popup-open]";
  const a = ".product__submit__add";
  const n = "[data-form-wrapper]";
  const d = "[data-product-variants]";
  const c = "is-loading";
  const l = "is-visible";
  const h = "data-cart-bar-enabled";
  const u = "data-add-to-cart-bar";
  const p = "data-cart-bar-scroll";
  const m = "data-cart-bar-product-notification";
  const f = "data-sticky-enabled";

  if (!customElements.get("product-component")) {
    customElements.define("product-component", class extends HTMLElement {
      constructor() {
        super();
        this.stickyEnabled = "true" === this.getAttribute(f);
        this.formWrapper = this.querySelector(n);
        this.cartBarEnabled = this.hasAttribute(h);
        this.setCartBarHeight = this.setCartBarHeight.bind(this);
        this.scrollToTop = this.scrollToTop.bind(this);
        this.unlockTimer = 0;
      }

      connectedCallback() {
        const t = this.querySelector(r);
        if (t && !t.innerHTML || !t) return;

        this.cartBar = document.querySelector(i);

        const eventData = JSON.parse(t.innerHTML).handle;
        let handleData = {};
        if (eventData) {
          handleData = { handle: eventData };
        }
        Shopify.Products.recordRecentlyViewed(handleData);
        if (Shopify.Products && Shopify.Products.recordRecentlyViewed) {
          Shopify.Products.recordRecentlyViewed(handleData);
        }
        this.form = this.querySelector(o);
        if (this.cartBarEnabled) {
          this.initCartBar();
          this.setCartBarHeight();
          this.initCartBarObserver();
          document.addEventListener("theme:resize", this.setCartBarHeight);
        }
      }

      initCartBar() {
        if (!this.cartBar) return;
        this.cartBarBtns = this.cartBar.querySelectorAll(a);
        if (this.cartBarBtns.length > 0) {
          this.cartBarBtns.forEach((t) => {
            t.addEventListener("click", (t) => {
              t.preventDefault();
              if (t.currentTarget.hasAttribute(u)) {
                if (this.cartBarEnabled) {
                  t.currentTarget.classList.add(c);
                  t.currentTarget.setAttribute("disabled", "disabled");
                }
                this.form.querySelector(e).dispatchEvent(new Event("click", { bubbles: true }));
              } else if (t.currentTarget.hasAttribute(p)) {
                this.scrollToTop();
              } else if (t.currentTarget.hasAttribute(m)) {
                this.form.querySelector(s)?.dispatchEvent(new Event("click"));
              }
            });
            if (t.hasAttribute(u)) {
              document.addEventListener("theme:product:add-error", this.scrollToTop);
            }
          });
        }
        this.setCartBarHeight();
      }

      scrollToTop() {
        const t = this.querySelector(d);
        const e = (window.theme.isMobile() ? t || this.form : this).getBoundingClientRect().top;
        window.theme.scrollTo(window.theme.isMobile() ? e - 10 : e);
      }

      initCartBarObserver() {
        const mainButton = this.form ? this.form.querySelector(e) : this.querySelector(e);
        if (!mainButton || !this.cartBar) return;

        const observerOptions = {
          root: null,
          threshold: 0
        };

        this.cartBarObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            const shouldShow = !entry.isIntersecting;
            this.cartBar.classList.toggle(l, shouldShow);
          });
        }, observerOptions);

        this.cartBarObserver.observe(mainButton);
      }

      setCartBarHeight() {
        if (this.cartBar) {
          const t = this.cartBar.offsetHeight;
          document.documentElement.style.setProperty("--cart-bar-height", `${t}px`);
        }
      }

      disconnectedCallback() {
        document.removeEventListener("theme:product:add-error", this.scrollToTop);
        if (this.cartBarObserver) {
          this.cartBarObserver.disconnect();
        }
        if (this.cartBarEnabled) {
          document.removeEventListener("theme:resize", this.setCartBarHeight);
        }
      }
    });
  }

  if (!customElements.get("product-model")) {
    customElements.define("product-model", ProductModel);
  }
}();
