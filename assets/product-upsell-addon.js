if (!customElements.get('upsell-addon')) {
  customElements.define('upsell-addon', class UpsellAddon extends HTMLElement {
    constructor() {
      super();
      this.items = this.querySelectorAll('[data-upsell-item]');
      this.totalPriceEl = this.querySelector('[data-upsell-total]');
    }

    connectedCallback() {
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

      // The addon block might not be wrapped inside the <form> element
      this.productWrapper = this.closest('product-component') || document;
      this.form = this.productWrapper.querySelector('form[action*="/cart/add"]');
      if (this.form) {
        // Find the main submit button
        const submitBtn = this.form.querySelector('[type="submit"], [name="add"]');
        if (submitBtn) {
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
    }

    async addMultipleToCart(submitBtn, checkedItems) {
      const mainInput = this.form.querySelector('[name="id"]');
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
      submitBtn.innerHTML = '<span class="btn__loader"><svg height="18" width="18" class="svg-loader"><circle r="7" cx="9" cy="9" /><circle stroke-dasharray="87.96459430051421 87.96459430051421" r="7" cx="9" cy="9" /></svg></span> Legger til...';
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
          document.dispatchEvent(new CustomEvent('cart:updated'));
          document.dispatchEvent(new CustomEvent('cart:build'));
          // Attempt to open standard theme drawers if applicable
          setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
          }, 1000);
          
          if (!document.querySelector('.cart-drawer.is-open, .drawer.is-open')) {
             // Let theme handle it, or we could redirect
             // window.location.href = window.Shopify.routes.root + 'cart';
          }
        } else {
          console.error('Failed to add items to cart');
          submitBtn.innerHTML = 'Error';
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
