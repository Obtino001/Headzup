if (!customElements.get('upsell-addon')) {
  customElements.define('upsell-addon', class UpsellAddon extends HTMLElement {
    constructor() {
      super();
      this.items = this.querySelectorAll('[data-upsell-item]');
      this.totalPriceEl = this.querySelector('[data-upsell-total]');
      this.addToCartBtn = this.querySelector('[data-upsell-add]');
      
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

      if (this.addToCartBtn) {
        this.addToCartBtn.addEventListener('click', this.addToCart.bind(this));
      }
    }

    calculateTotal() {
      let total = 0;
      let checkedCount = 0;

      this.items.forEach(item => {
        if (item.classList.contains('is-checked')) {
          const price = parseInt(item.getAttribute('data-selected-price') || 0, 10);
          total += price;
          checkedCount++;
        }
      });

      if (this.totalPriceEl) {
        // Format money (basic fallback if Shopify.formatMoney isn't available)
        const formattedTotal = Shopify && Shopify.formatMoney 
          ? Shopify.formatMoney(total, window.theme && window.theme.moneyFormat ? window.theme.moneyFormat : "{{amount_no_decimals}} kr") 
          : (total / 100).toFixed(2) + ' kr';
        
        this.totalPriceEl.innerHTML = formattedTotal;
      }

      if (this.addToCartBtn) {
        this.addToCartBtn.disabled = checkedCount === 0;
      }
    }

    async addToCart() {
      const itemsToAdd = [];
      this.items.forEach(item => {
        if (item.classList.contains('is-checked')) {
          const variantId = item.getAttribute('data-selected-variant-id');
          if (variantId) {
            itemsToAdd.push({
              id: parseInt(variantId, 10),
              quantity: 1
            });
          }
        }
      });

      if (itemsToAdd.length === 0) return;

      const originalText = this.addToCartBtn.innerText;
      this.addToCartBtn.innerText = 'Legger til...';
      this.addToCartBtn.disabled = true;

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
          // Trigger theme's cart drawer update
          document.dispatchEvent(new CustomEvent('cart:updated'));
          document.dispatchEvent(new CustomEvent('cart:build'));
          // In many standard themes, dispatching a 'cart:build' or calling theme cart API works.
          if (window.theme && typeof theme.cart === 'function') {
             // Let theme handle it if there's a global
          } else {
             // Generic fallback to redirect to cart if no drawer pops up
             window.location.href = '/cart';
          }
        } else {
          console.error('Failed to add items to cart');
          this.addToCartBtn.innerText = 'Error';
          setTimeout(() => {
            this.addToCartBtn.innerText = originalText;
            this.addToCartBtn.disabled = false;
          }, 2000);
        }
      } catch (error) {
        console.error('Error adding to cart:', error);
      }
    }
  });
}
