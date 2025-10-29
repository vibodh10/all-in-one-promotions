/**
 * Smart Offers & Bundles - Storefront Widget
 * This script is injected into the merchant's storefront to display offers
 */

(function() {
  'use strict';

  // Configuration
  const API_URL = 'https://your-app-url.com/api';
  const SHOP_ID = window.Shopify?.shop || '';
  
  // Widget state
  let activeOffers = [];
  let cartData = {};
  let widgetInstances = [];

  /**
   * Initialize the widget
   */
  async function init() {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        return;
      }

      // Get product ID from page
      const productId = getProductId();
      if (!productId) return;

      // Fetch active offers for this product
      activeOffers = await fetchOffers(productId);

      // Render widgets for each offer
      activeOffers.forEach(offer => {
        renderOfferWidget(offer);
      });

      // Set up cart tracking
      setupCartTracking();

      // Track page view events
      trackOfferViews();

    } catch (error) {
      console.error('Smart Offers Widget Error:', error);
    }
  }

  /**
   * Get current product ID from Shopify page
   */
  function getProductId() {
    // Try multiple methods to get product ID
    if (window.ShopifyAnalytics?.meta?.product?.id) {
      return window.ShopifyAnalytics.meta.product.id;
    }

    // Try from meta tags
    const metaProduct = document.querySelector('meta[property="product:id"]');
    if (metaProduct) {
      return metaProduct.getAttribute('content');
    }

    // Try from URL
    const urlMatch = window.location.pathname.match(/\/products\/([^\/]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    return null;
  }

  /**
   * Fetch offers from API
   */
  async function fetchOffers(productId) {
    try {
      const response = await fetch(`${API_URL}/storefront/offers?productId=${productId}&shop=${SHOP_ID}`);
      const data = await response.json();
      return data.offers || [];
    } catch (error) {
      console.error('Error fetching offers:', error);
      return [];
    }
  }

  /**
   * Render offer widget on page
   */
  function renderOfferWidget(offer) {
    // Find insertion point based on offer settings
    const insertionPoint = findInsertionPoint(offer.displaySettings.position);
    if (!insertionPoint) return;

    // Create widget container
    const widget = createWidgetElement(offer);
    
    // Insert widget
    if (offer.displaySettings.position === 'below_atc') {
      insertionPoint.parentNode.insertBefore(widget, insertionPoint.nextSibling);
    } else {
      insertionPoint.parentNode.insertBefore(widget, insertionPoint);
    }

    // Store widget instance
    widgetInstances.push({
      offerId: offer.id,
      element: widget,
      offer: offer
    });

    // Set up event listeners
    setupWidgetListeners(widget, offer);
  }

  /**
   * Create widget HTML element
   */
  function createWidgetElement(offer) {
    const container = document.createElement('div');
    container.className = 'smart-offer-widget';
    container.setAttribute('data-offer-id', offer.id);
    container.style.cssText = `
      border: 2px solid ${offer.styling.primaryColor};
      border-radius: ${offer.styling.borderRadius};
      padding: 16px;
      margin: 16px 0;
      font-family: ${offer.styling.fontFamily};
      background: ${offer.styling.secondaryColor};
    `;

    let content = '';

    // Render based on offer type
    if (offer.type === 'quantity_break') {
      content = renderQuantityBreakWidget(offer);
    } else if (offer.type === 'bundle') {
      content = renderBundleWidget(offer);
    } else if (offer.type === 'volume_discount') {
      content = renderVolumeDiscountWidget(offer);
    } else if (offer.type === 'cross_sell') {
      content = renderCrossSellWidget(offer);
    }

    container.innerHTML = content;
    return container;
  }

  /**
   * Render quantity break widget
   */
  function renderQuantityBreakWidget(offer) {
    const sortedTiers = offer.tiers.sort((a, b) => a.quantity - b.quantity);
    
    let html = `
      <div class="smart-offer-header">
        <h3 style="margin: 0 0 8px 0; color: ${offer.styling.primaryColor};">
          ${offer.name}
        </h3>
        ${offer.description ? `<p style="margin: 0 0 12px 0; font-size: 14px;">${offer.description}</p>` : ''}
      </div>
      <div class="smart-offer-tiers" style="display: flex; gap: 12px; flex-wrap: wrap;">
    `;

    sortedTiers.forEach((tier, index) => {
      const isActive = getCurrentQuantity() >= tier.quantity;
      html += `
        <div class="smart-offer-tier" 
             data-quantity="${tier.quantity}"
             style="
               flex: 1;
               min-width: 80px;
               padding: 12px;
               border: 2px solid ${isActive ? offer.styling.primaryColor : '#e0e0e0'};
               border-radius: 4px;
               text-align: center;
               cursor: pointer;
               background: ${isActive ? offer.styling.primaryColor + '10' : 'white'};
             ">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">
            ${tier.quantity}+
          </div>
          <div style="font-size: 14px; color: ${offer.styling.primaryColor};">
            ${tier.discount}% OFF
          </div>
        </div>
      `;
    });

    html += '</div>';

    if (offer.displaySettings.showSavings) {
      const currentSavings = calculateCurrentSavings(offer);
      if (currentSavings > 0) {
        html += `
          <div class="smart-offer-savings" style="margin-top: 12px; font-weight: bold; color: ${offer.styling.primaryColor};">
            You save: $${currentSavings.toFixed(2)}
          </div>
        `;
      }
    }

    return html;
  }

  /**
   * Render bundle widget
   */
  function renderBundleWidget(offer) {
    return `
      <div class="smart-offer-bundle">
        <h3 style="margin: 0 0 8px 0; color: ${offer.styling.primaryColor};">
          ${offer.name}
        </h3>
        <p style="margin: 0 0 12px 0;">
          Buy ${offer.bundleConfig.minItems} items and save ${offer.discountValue}${offer.discountType === 'percentage' ? '%' : '$'}!
        </p>
        <button class="smart-offer-cta" 
                style="
                  background: ${offer.styling.primaryColor};
                  color: ${offer.styling.secondaryColor};
                  border: none;
                  padding: 12px 24px;
                  border-radius: ${offer.styling.borderRadius};
                  cursor: pointer;
                  font-size: 16px;
                  font-weight: bold;
                  width: 100%;
                ">
          View Bundle Items
        </button>
      </div>
    `;
  }

  /**
   * Render volume discount widget
   */
  function renderVolumeDiscountWidget(offer) {
    const currentQuantity = getCurrentQuantity();
    const nextTier = getNextTier(offer, currentQuantity);
    
    let html = `
      <div class="smart-offer-volume">
        <h3 style="margin: 0 0 8px 0; color: ${offer.styling.primaryColor};">
          ${offer.name}
        </h3>
    `;

    if (nextTier && offer.displaySettings.showProgressBar) {
      const progress = (currentQuantity / nextTier.quantity) * 100;
      const remaining = nextTier.quantity - currentQuantity;
      
      html += `
        <p style="margin: 0 0 8px 0; font-size: 14px;">
          Add ${remaining} more to save ${nextTier.discount}${offer.discountType === 'percentage' ? '%' : '$'}
        </p>
        <div class="smart-offer-progress" 
             style="
               width: 100%;
               height: 8px;
               background: #e0e0e0;
               border-radius: 4px;
               overflow: hidden;
             ">
          <div style="
                 width: ${Math.min(progress, 100)}%;
                 height: 100%;
                 background: ${offer.styling.primaryColor};
                 transition: width 0.3s ease;
               "></div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * Render cross-sell widget
   */
  function renderCrossSellWidget(offer) {
    return `
      <div class="smart-offer-cross-sell">
        <h3 style="margin: 0 0 8px 0; color: ${offer.styling.primaryColor};">
          ${offer.name}
        </h3>
        <p style="margin: 0 0 12px 0; font-size: 14px;">
          Customers also bought
        </p>
        <div class="smart-offer-products" style="display: flex; gap: 12px; overflow-x: auto;">
          <!-- Products will be loaded dynamically -->
        </div>
      </div>
    `;
  }

  /**
   * Find insertion point in DOM
   */
  function findInsertionPoint(position) {
    let selector;
    
    switch (position) {
      case 'below_atc':
        selector = 'form[action*="/cart/add"] button[type="submit"], .product-form__submit, [name="add"]';
        break;
      case 'above_atc':
        selector = 'form[action*="/cart/add"], .product-form';
        break;
      case 'product_tabs':
        selector = '.product-tabs, .product-description';
        break;
      default:
        selector = 'form[action*="/cart/add"]';
    }

    return document.querySelector(selector);
  }

  /**
   * Setup widget event listeners
   */
  function setupWidgetListeners(widget, offer) {
    // Click on tier
    const tiers = widget.querySelectorAll('.smart-offer-tier');
    tiers.forEach(tier => {
      tier.addEventListener('click', () => {
        const quantity = parseInt(tier.getAttribute('data-quantity'));
        updateQuantitySelector(quantity);
        trackEvent('offer_click', offer.id);
      });
    });

    // CTA button clicks
    const cta = widget.querySelector('.smart-offer-cta');
    if (cta) {
      cta.addEventListener('click', () => {
        trackEvent('offer_click', offer.id);
        if (offer.type === 'bundle') {
          showBundleModal(offer);
        }
      });
    }

    // Track visibility (impression)
    observeVisibility(widget, () => {
      trackEvent('offer_view', offer.id);
    });
  }

  /**
   * Setup cart tracking
   */
  function setupCartTracking() {
    // Listen for add to cart events
    document.addEventListener('submit', (e) => {
      if (e.target.matches('form[action*="/cart/add"]')) {
        const formData = new FormData(e.target);
        const quantity = parseInt(formData.get('quantity') || 1);
        
        // Track cart update
        activeOffers.forEach(offer => {
          trackEvent('cart_update', offer.id, {
            quantity: quantity
          });
        });
      }
    });

    // Listen for Shopify Ajax cart events
    if (window.Shopify?.onItemAdded) {
      window.Shopify.onItemAdded = function(line_item) {
        activeOffers.forEach(offer => {
          trackEvent('cart_update', offer.id, {
            quantity: line_item.quantity
          });
        });
      };
    }
  }

  /**
   * Track analytics event
   */
  async function trackEvent(eventName, offerId, metadata = {}) {
    try {
      await fetch(`${API_URL}/analytics/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventName,
          offerId,
          productId: getProductId(),
          timestamp: new Date().toISOString(),
          metadata,
          shop: SHOP_ID
        })
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  /**
   * Track offer views when visible
   */
  function trackOfferViews() {
    widgetInstances.forEach(instance => {
      trackEvent('offer_view', instance.offer.id);
    });
  }

  /**
   * Observe element visibility
   */
  function observeVisibility(element, callback) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback();
          observer.unobserve(element);
        }
      });
    }, { threshold: 0.5 });

    observer.observe(element);
  }

  /**
   * Get current quantity from selector
   */
  function getCurrentQuantity() {
    const quantityInput = document.querySelector('input[name="quantity"]');
    return parseInt(quantityInput?.value || 1);
  }

  /**
   * Update quantity selector
   */
  function updateQuantitySelector(quantity) {
    const quantityInput = document.querySelector('input[name="quantity"]');
    if (quantityInput) {
      quantityInput.value = quantity;
      quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Calculate current savings
   */
  function calculateCurrentSavings(offer) {
    const quantity = getCurrentQuantity();
    const price = getProductPrice();
    const discount = calculateDiscount(offer, quantity);
    
    return (price * quantity * discount) / 100;
  }

  /**
   * Get product price
   */
  function getProductPrice() {
    const priceElement = document.querySelector('.price__current, [data-product-price]');
    if (priceElement) {
      const priceText = priceElement.textContent.replace(/[^0-9.]/g, '');
      return parseFloat(priceText) || 0;
    }
    return 0;
  }

  /**
   * Calculate discount for quantity
   */
  function calculateDiscount(offer, quantity) {
    const sortedTiers = offer.tiers.sort((a, b) => b.quantity - a.quantity);
    
    for (const tier of sortedTiers) {
      if (quantity >= tier.quantity) {
        return tier.discount;
      }
    }
    
    return 0;
  }

  /**
   * Get next tier for progress bar
   */
  function getNextTier(offer, currentQuantity) {
    const sortedTiers = offer.tiers.sort((a, b) => a.quantity - b.quantity);
    
    for (const tier of sortedTiers) {
      if (currentQuantity < tier.quantity) {
        return tier;
      }
    }
    
    return null;
  }

  /**
   * Show bundle modal
   */
  function showBundleModal(offer) {
    // Implementation for modal display
    console.log('Show bundle modal for offer:', offer);
  }

  // Initialize when script loads
  init();

  // Expose public API
  window.SmartOffers = {
    refresh: init,
    trackEvent: trackEvent
  };

})();
