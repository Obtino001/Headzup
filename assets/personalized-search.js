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
      if (!this.grid || !window.theme?.settings?.personalizedSearchShowFallback) {
        if (this.fallbackHtml.trim() === '') {
          const wrapper = this.container?.closest('.predictive-search--empty');
          if (wrapper && !wrapper.querySelector('.predictive-search__item')) {
            wrapper.style.display = 'none';
          }
        }
        return;
      }

      this.grid.innerHTML = this.fallbackHtml;
      this.container.removeAttribute('data-personalized');

      if (this.heading && this.defaultHeading) {
        this.heading.textContent = this.defaultHeading;
      }

      if (this.fallbackHtml.trim() === '') {
        const wrapper = this.container?.closest('.predictive-search--empty');
        if (wrapper && !wrapper.querySelector('.predictive-search__item')) {
          wrapper.style.display = 'none';
        }
      } else {
        this.container?.closest('.predictive-search--empty')?.style.removeProperty('display');
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

        if (!this.grid.children.length) {
          this.restoreFallback();
          return;
        }

        this.setGridColumns(this.grid.children.length);
        this.updateHeading(await this.getTopVendor(handles));
        this.container.setAttribute('data-personalized', 'true');
        this.container?.closest('.predictive-search--empty')?.style.removeProperty('display');
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

      const topVendorNormalized = topVendor.toLowerCase();
      const matchesVendor = (vendor) => vendor?.toLowerCase() === topVendorNormalized;
      const addHandle = (list, handle) => {
        if (list.length >= limit) return;
        if (!handle || viewedSet.has(handle) || list.includes(handle)) return;
        list.push(handle);
      };

      let resultHandles = [];

      if (products[0]?.id) {
        try {
          const recommendationsUrl = `${window.theme.routes.product_recommendations_url}?product_id=${products[0].id}&limit=${limit + 6}&intent=related`;
          const recommendationsResponse = await fetch(recommendationsUrl);

          if (recommendationsResponse.ok) {
            const recommendationsData = await recommendationsResponse.json();
            const recommendedProducts = recommendationsData?.products || [];

            recommendedProducts.forEach((product) => {
              if (!matchesVendor(product.vendor)) return;
              addHandle(resultHandles, product.handle);
            });
          }
        } catch (error) {
          console.warn('Personalized search recommendations:', error);
        }
      }

      if (resultHandles.length < limit) {
        const suggestUrl = `${window.theme.routes.root}search/suggest.json?q=${encodeURIComponent(topVendor)}&resources[type]=product&resources[limit]=20`;

        try {
          const suggestResponse = await fetch(suggestUrl);
          if (suggestResponse.ok) {
            const suggestData = await suggestResponse.json();
            const suggestedProducts = suggestData?.resources?.results?.products || [];

            suggestedProducts.forEach((product) => {
              if (!matchesVendor(product.vendor)) return;
              addHandle(resultHandles, product.handle);
            });
          }
        } catch (error) {
          console.warn('Personalized search suggest:', error);
        }
      }

      if (resultHandles.length < limit) {
        for (const product of products) {
          addHandle(resultHandles, product.handle);
        }
      }

      return resultHandles.slice(0, limit);
    }

    setGridColumns(count) {
      const columns = Math.min(Math.max(count, 2), 4);
      this.grid.style.setProperty('--columns', columns);
      this.container.style.setProperty('--columns', columns);
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

    document.querySelectorAll('header-search-popdown details').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (details.open) {
          initPersonalizedSearch();
        }
      });
    });

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
