if (!customElements.get('upsell-addon')) {
  customElements.define('upsell-addon', class UpsellAddon extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.items = this.querySelectorAll('[data-upsell-item]');
      this.totalPriceEl = this.querySelector('[data-upsell-total]');
      // Attributes are only guaranteed to be available in connectedCallback
      this.mainProductPrice = parseInt(this.getAttribute('data-main-product-price') || 0, 10);
      
      this.bindEvents();
      this.calculateTotal();
    }

    bindEvents() {
      this.items.forEach(item => {
        item.addEventListener('click', (e) => {
          // Prevent clicking on the "Read more" link from toggling
          if (e.target.tagName.toLowerCase() === 'a') return;
          
          item.classList.toggle('is-checked');
          item.classList.toggle('is-unchecked');
          this.calculateTotal();
        });
      });

      this.productWrapper = this.closest('product-component') || document;
      const submitBtn = this.productWrapper.querySelector('[data-add-to-cart]') || this.productWrapper.querySelector('[type="submit"][name="add"], button[name="add"]');
      
      // Save form reference for addMultipleToCart
      if (submitBtn) {
        this.form = submitBtn.closest('form');
        submitBtn.addEventListener('click', (e) => {
          const checkedItems = this.getCheckedItems();
          if (checkedItems.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            this.addMultipleToCart(submitBtn, checkedItems);
          }
        }, true); // Intercept in capture phase
      }
    }

    getCheckedItems() {
      const items = [];
      this.items.forEach(item => {
        if (item.classList.contains('is-checked')) {
          const variantId = item.getAttribute('data-selected-variant-id');
          if (variantId) {
            items.push({
              id: parseInt(variantId, 10),
              quantity: 1
            });
          }
        }
      });
      return items;
    }

    calculateTotal() {
      let total = this.mainProductPrice;

      this.items.forEach(item => {
        if (item.classList.contains('is-checked')) {
          const price = parseInt(item.getAttribute('data-selected-price') || 0, 10);
          total += price;
        }
      });

      if (this.totalPriceEl) {
        // Format money (basic fallback if Shopify.formatMoney isn't available)
        const formattedTotal = Shopify && Shopify.formatMoney 
          ? Shopify.formatMoney(total, window.theme && window.theme.moneyFormat ? window.theme.moneyFormat : "{{amount_no_decimals}} kr") 
          : (total / 100).toFixed(2) + ' kr';
        
        this.totalPriceEl.innerHTML = formattedTotal;
      }

      }


    async addMultipleToCart(submitBtn, checkedItems) {
      let mainInput = null;
      if (this.form) {
        const formId = this.form.getAttribute('id');
        if (formId) {
          mainInput = document.querySelector(`input[name="id"][form="${formId}"]`);
        }
        if (!mainInput) {
          mainInput = this.form.querySelector('[name="id"]');
        }
      } else {
        mainInput = document.querySelector('input[name="id"]');
      }
      
      const mainId = mainInput ? parseInt(mainInput.value, 10) : null;
      
      const itemsToAdd = [...checkedItems];
      if (mainId) {
        // Add main product to the beginning of the array
        itemsToAdd.unshift({
          id: mainId,
          quantity: 1
        });
      }

      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="btn__loader"><svg height="18" width="18" class="svg-loader"><circle r="7" cx="9" cy="9" /><circle stroke-dasharray="87.96459430051421 87.96459430051421" r="7" cx="9" cy="9" /></svg></span> Tilføjer...';
      submitBtn.disabled = true;

      try {
        const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ items: itemsToAdd })
        });
        
        if (response.ok) {
          document.dispatchEvent(new CustomEvent('theme:cart:refresh', { bubbles: true }));
          document.dispatchEvent(new CustomEvent('theme:product:add', { bubbles: true }));
          
          // Revert button state after a short delay
          setTimeout(() => {
            submitBtn.classList.remove('is-loading');
            submitBtn.removeAttribute('disabled');
            submitBtn.innerHTML = originalText;
          }, 500);
          
          if (!document.querySelector('.cart-drawer.is-open, .drawer.is-open')) {
             // Let theme handle it, or we could redirect
             // window.location.href = window.Shopify.routes.root + 'cart';
          }
        } else {
          console.error('Failed to add items to cart');
          submitBtn.innerHTML = 'Fejl';
          setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
          }, 2000);
        }
      } catch (error) {
        console.error('Error adding to cart:', error);
      }
    }
  });
}
