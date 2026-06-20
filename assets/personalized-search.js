!(function () {
  'use strict';

  const COOKIE_NAME = 'shopify_recently_viewed';

  function readRecentlyViewed() {
    if (window.Shopify?.Products?.getRecentlyViewed) {
      return window.Shopify.Products.getRecentlyViewed();
    }

    if (document.cookie.indexOf('; ') === -1) return [];

    const cookieRow = document.cookie.split('; ').find((row) => row.startsWith(`${COOKIE_NAME}=`));
    if (!cookieRow) return [];

    return decodeURIComponent(cookieRow.split('=')[1]).split(' ').filter(Boolean);
  }

  class PersonalizedSearch {
    constructor(container) {
      this.container = container;
      this.grid = container.querySelector('[data-personalized-products-grid]');
      this.heading = container.querySelector('[data-personalized-heading]');
      this.defaultHeading = this.heading?.textContent?.trim() || '';
      this.fallbackHtml = this.grid?.innerHTML || '';
      this.isLoading = false;
    }

    init() {
      if (!window.theme?.settings?.personalizedSearchEnabled || !this.grid) return;

      const handles = readRecentlyViewed();
      if (!handles.length) {
        this.restoreFallback();
        return;
      }

      this.loadPersonalizedProducts(handles);
    }

    restoreFallback() {
      if (!this.grid || !window.theme?.settings?.personalizedSearchShowFallback) return;

      this.grid.innerHTML = this.fallbackHtml;
      this.container.removeAttribute('data-personalized');

      if (this.heading && this.defaultHeading) {
        this.heading.textContent = this.defaultHeading;
      }
    }

    async loadPersonalizedProducts(handles) {
      if (this.isLoading) return;

      this.isLoading = true;
      this.grid.classList.add('is-loading');

      try {
        const productHandles = await this.getPersonalizedProductHandles(handles);

        if (!productHandles.length) {
          this.restoreFallback();
          return;
        }

        await this.renderProducts(productHandles);
        this.updateHeading(await this.getTopVendor(handles));
        this.container.setAttribute('data-personalized', 'true');
      } catch (error) {
        console.warn('Personalized search:', error);
        this.restoreFallback();
      } finally {
        this.grid.classList.remove('is-loading');
        this.isLoading = false;
      }
    }

    async getTopVendor(handles) {
      const products = await this.fetchProductData(handles.slice(0, 5));
      const vendorCounts = {};

      products.forEach((product) => {
        if (!product?.vendor) return;
        vendorCounts[product.vendor] = (vendorCounts[product.vendor] || 0) + 1;
      });

      const sortedVendors = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1]);
      return sortedVendors[0]?.[0] || null;
    }

    async fetchProductData(handles) {
      const responses = await Promise.all(
        handles.map((handle) =>
          fetch(`${window.theme.routes.root}products/${handle}.js`)
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null)
        )
      );

      return responses.filter(Boolean);
    }

    async getPersonalizedProductHandles(handles) {
      const limit = window.theme.settings.personalizedSearchLimit || 4;
      const viewedSet = new Set(handles);
      const products = await this.fetchProductData(handles.slice(0, 5));

      if (!products.length) return [];

      const vendorCounts = {};
      products.forEach((product) => {
        if (!product.vendor) return;
        vendorCounts[product.vendor] = (vendorCounts[product.vendor] || 0) + 1;
      });

      const topVendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!topVendor) return [];

      let resultHandles = [];
      const suggestUrl = `${window.theme.routes.root}search/suggest.json?q=${encodeURIComponent(topVendor)}&resources[type]=product&resources[limit]=15`;

      try {
        const suggestResponse = await fetch(suggestUrl);
        if (suggestResponse.ok) {
          const suggestData = await suggestResponse.json();
          const suggestedProducts = suggestData?.resources?.results?.products || [];

          resultHandles = suggestedProducts
            .filter((product) => product.vendor === topVendor && !viewedSet.has(product.handle))
            .map((product) => product.handle);
        }
      } catch (error) {
        console.warn('Personalized search suggest:', error);
      }

      if (resultHandles.length < limit && products[0]?.id) {
        try {
          const recommendationsUrl = `${window.theme.routes.product_recommendations_url}?product_id=${products[0].id}&limit=${limit + 3}&intent=related`;
          const recommendationsResponse = await fetch(recommendationsUrl);

          if (recommendationsResponse.ok) {
            const recommendationsData = await recommendationsResponse.json();
            const recommendedProducts = recommendationsData?.products || [];

            recommendedProducts.forEach((product) => {
              if (resultHandles.length >= limit) return;
              if (viewedSet.has(product.handle)) return;
              if (resultHandles.includes(product.handle)) return;
              if (product.vendor !== topVendor) return;

              resultHandles.push(product.handle);
            });
          }
        } catch (error) {
          console.warn('Personalized search recommendations:', error);
        }
      }

      if (resultHandles.length < limit) {
        handles.forEach((handle) => {
          if (resultHandles.length >= limit) return;
          if (resultHandles.includes(handle)) return;

          resultHandles.push(handle);
        });
      }

      return resultHandles.slice(0, limit);
    }

    async renderProducts(handles) {
      this.grid.innerHTML = '';

      const target = 'api-product-grid-item';
      const animationAnchor = this.container.closest('[data-popdown]') ? 'details[open] .search-popdown' : '';

      for (let index = 0; index < handles.length; index++) {
        const handle = handles[index];

        try {
          const response = await fetch(`${window.theme.routes.root}products/${handle}?section_id=${target}`);
          if (!response.ok) continue;

          let productMarkup = await response.text();
          productMarkup = productMarkup.includes('||itemAnimationDelay||')
            ? productMarkup.replaceAll('||itemAnimationDelay||', index * 100)
            : productMarkup;
          productMarkup = productMarkup.includes('||itemAnimationAnchor||')
            ? productMarkup.replaceAll('||itemAnimationAnchor||', animationAnchor)
            : productMarkup;

          const wrapper = document.createElement('div');
          wrapper.innerHTML = productMarkup;
          const content = wrapper.querySelector('[data-api-content]');

          if (content) {
            this.grid.innerHTML += content.innerHTML;
          }
        } catch (error) {
          console.warn('Personalized search product load failed:', handle, error);
        }
      }
    }

    updateHeading(vendor) {
      if (!this.heading) return;

      const brandHeading = window.theme.strings?.personalizedSearchBrandHeading;
      const defaultHeading = window.theme.strings?.personalizedSearchHeading;

      if (vendor && brandHeading) {
        this.heading.textContent = brandHeading.replace('{{ brand }}', vendor);
        return;
      }

      if (defaultHeading) {
        this.heading.textContent = defaultHeading;
      }
    }
  }

  function initPersonalizedSearch() {
    document.querySelectorAll('[data-personalized-search]').forEach((container) => {
      const instance = container._personalizedSearchInstance || new PersonalizedSearch(container);
      container._personalizedSearchInstance = instance;
      instance.init();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPersonalizedSearch();

    const debounce =
      window.theme?.debounce ||
      function (callback, wait) {
        let timeoutId;
        return function debounced() {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(callback, wait);
        };
      };

    document.querySelectorAll('[data-predictive-search-input]').forEach((input) => {
      input.addEventListener(
        'input',
        debounce(() => {
          if (!input.value.length) {
            initPersonalizedSearch();
          }
        }, 200)
      );
    });
  });
})();
