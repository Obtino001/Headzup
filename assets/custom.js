/*
* Broadcast Theme
*
* Use this file to add custom Javascript to Broadcast.  Keeping your custom
* Javascript in this fill will make it easier to update Broadcast. In order
* to use this file you will need to open layout/theme.liquid and uncomment
* the custom.js script import line near the bottom of the file.
*/


(function() {
  function initRebuyCart() {
    document.addEventListener("rebuy:smartcart.ready", (e) => {
      const cart = e.detail.smartcart.cart;
      showPaymentIcons();
      freeShippingLimit(cart);
    });
  
    document.addEventListener("rebuy:cart.change", (e) => {
      const cart = e.detail.cart.cart;
      showPaymentIcons();
      freeShippingLimit(cart);
    });
  }
  
  function showPaymentIcons() {
    setTimeout(() => {
      const paymentIcons = document.querySelector(".cart__drawer__payment__icons");
      const checkoutArea = document.querySelector('div[data-rebuy-component="checkout-area"]');
  
      if (!paymentIcons || !checkoutArea || checkoutArea.querySelector(".cloned-payment-icons")) {
        return;
      }
  
      const clonedPaymentIcons = paymentIcons.cloneNode(true);
      clonedPaymentIcons.classList.add("cloned-payment-icons"); 
      checkoutArea.appendChild(clonedPaymentIcons);
    }, 500);
  }

  function freeShippingLimit(cart) {
    const selectors = {
      finalAmount: ".rebuy-cart__flyout-subtotal .rebuy-cart__flyout-subtotal-final-amount span:last-child",
      compareAmount: ".rebuy-cart__flyout-subtotal .rebuy-cart__flyout-subtotal-compare-amount span:last-child",
      freeShippingLimit: ".cart__drawer__free-shipping-limit",
      checkoutArea: 'div[data-rebuy-component="cart-subtotal"]',
      shippingCost: ".cart__drawer__free-shipping-limit__amount"
    };
    const translations = {
      freeShipping: "Free",
    }

    function calculate() {
      const originalFinalAmount = getRebuyHtmlPrice(selectors.finalAmount);
      const originalCompareAmount = getRebuyHtmlPrice(selectors.compareAmount);
      const currency = cart.currency.toLowerCase();
      const freeShippingLimit = window.theme.settings[`freeShippingLimit_${currency}`] ? Number(window.theme.settings[`freeShippingLimit_${currency}`]) * 100 : null;
      const shippingCost = window.theme.settings[`shippingPrice_${currency}`] ? Number(window.theme.settings[`shippingPrice_${currency}`]) * 100 : null;

      let total = originalFinalAmount;
      let totalCompare = originalCompareAmount;
      let hasFreeShipping = true;

      if(total <= freeShippingLimit) {
        total += shippingCost;
        totalCompare += shippingCost;

        hasFreeShipping = false;
      }

      total = total / 100;
      totalCompare = totalCompare / 100;

      return { total, totalCompare, shippingCost, hasFreeShipping };
    }

    function formatPrice(price) {
      return price.toLocaleString('en-US', { style: 'currency', currency: cart.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getRebuyHtmlPrice(selector) {
      const value = document.querySelector(selector)?.innerText;
  
      if(!value) {
        return null;
      }
  
      let price = value.replace(/[^\d.]/g, '');
      return parseFloat(price);;
    }

    function setInnerText(selector, value) {
      const el = document.querySelector(selector);

      if(el) {
        el.innerText = value;
      }
    }

    function addOrUpdateShippingPrice(shippingCost, hasFreeShipping) {
      const cartSubtotalEl = document.querySelector('[data-rebuy-component="cart-subtotal"]');
      
      if (!cartSubtotalEl) {
        return;
      }

      // Create subtotal HTML structure
      const subtotalHTML = `
        <div class="rebuy-cart__flyout-shipping-price">
          <div class="rebuy-cart__flyout-subtotal-shipping-label">
            <span>Fragt</span>
          </div>
          <div class="rebuy-cart__flyout-subtotal-shipping">
            <span>
              <span class="rebuy-cart__flyout-subtotal-final-shipping">
                <span>${hasFreeShipping ? translations.freeShipping : formatPrice(shippingCost / 100)}</span>
              </span>
            </span>
          </div>
        </div>
      `;

      // Create a temporary container
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = subtotalHTML;

      // Remove existing shipping price element if it exists
      const existingShippingPrice = cartSubtotalEl.querySelector('.rebuy-cart__flyout-shipping-price');
      if (existingShippingPrice) {
        existingShippingPrice.remove();
      }

      // Append the new element
      cartSubtotalEl.appendChild(tempContainer.firstElementChild);
    }

    function addOrUpdateEstimatedDelivery() {
      const cartSubtotalEl = document.querySelector('[data-rebuy-component="cart-subtotal"]');
      const estimatedDelivery = document.querySelector(".estimated-delivery");

      if (estimatedDelivery && cartSubtotalEl) {
        const existingEstimatedDelivery = cartSubtotalEl.querySelector(".estimated-delivery");
        if (existingEstimatedDelivery) {
          existingEstimatedDelivery.remove();
        }

        const clonedEstimatedDelivery = estimatedDelivery.cloneNode(true);
        cartSubtotalEl.appendChild(clonedEstimatedDelivery);
      }
    }

    setTimeout(() => {
      const { total, totalCompare, shippingCost, hasFreeShipping } = calculate();

      setInnerText(selectors.finalAmount, formatPrice(total));
      setInnerText(selectors.compareAmount, formatPrice(totalCompare));
      
      addOrUpdateShippingPrice(shippingCost, hasFreeShipping);
      addOrUpdateEstimatedDelivery();
    });
  }  
  
  initRebuyCart();

  class HeaderState {
    constructor() {
      this.header = document.querySelector('header-component');
      this.drawerBody = document.querySelector('.drawer__body');
      this.isStuck = false;

      this.init();
    }

    init() {
      if (!this.header || !this.drawerBody) return;

      this.updateState();
      this.updateDrawerMargin();

      this.observer = new MutationObserver(() => {
        this.updateState();
        this.updateDrawerMargin();
      });
      
      this.observer.observe(this.header, {
        attributes: true,
        attributeFilter: ['class']
      });

      window.addEventListener('scroll', () => {
        this.updateState();
        this.updateDrawerMargin();
      });
    }

    updateState() {
      this.isStuck = this.header.classList.contains('js__header__stuck');
    }

    updateDrawerMargin() {
      this.drawerBody.style.marginTop = this.isStuck ? '30px' : '60px';
    }
  }
  new HeaderState();


  // ^^ Keep your scripts inside this IIFE function call to 
  // avoid leaking your variables into the global scope.
})();
