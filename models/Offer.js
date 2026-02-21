/**
 * Offer Model
 * Handles all offer types: Quantity Breaks, Bundles, Volume Discounts, Cross-sells
 */

class Offer {
  constructor(data) {
    this.id = data.id || null;
    this.shopId = data.shopId;
    this.type = data.type; // 'quantity_break', 'bundle', 'volume_discount', 'cross_sell', 'cart_upsell'
    this.name = data.name;
    this.description = data.description || '';
    this.status = data.status || 'draft'; // 'draft', 'active', 'paused', 'scheduled'

    // Product selection
    this.products = data.products || []; // Array of product IDs
    this.collections = data.collections || []; // Array of collection IDs
    
    // Discount configuration
    this.discountType = data.discountType; // 'percentage', 'fixed_amount', 'free_gift'
    this.discountValue = data.discountValue;
    this.tiers = data.tiers || []; // For quantity breaks and volume discounts
    
    // Bundle-specific
    this.bundleConfig = data.bundleConfig || {
      minItems: 1,
      maxItems: null,
      allowMixMatch: false,
      requiredProducts: []
    };
    
    // Free gift configuration
    this.freeGift = data.freeGift || {
      enabled: false,
      productId: null,
      variantId: null,
      threshold: null
    };
    
    // Display settings
    this.displaySettings = data.displaySettings || {
      widget: 'inline', // 'inline', 'modal', 'drawer'
      position: 'below_atc', // 'below_atc', 'above_atc', 'product_tabs'
      showProgressBar: true,
      showSavings: true,
      customCSS: ''
    };
    
    // Styling
    this.styling = data.styling || {
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      fontFamily: 'inherit',
      borderRadius: '4px',
      buttonStyle: 'solid'
    };
    
    // Schedule
    this.schedule = data.schedule || {
      startDate: null,
      endDate: null,
      timezone: 'UTC'
    };
    
    // Targeting
    this.targeting = data.targeting || {
      customerGroups: [],
      countries: [],
      excludeProducts: []
    };
    
    // Analytics
    this.analytics = data.analytics || {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0
    };
    
    // Timestamps
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validate offer configuration
   */
  validate() {
    const errors = [];

    if (!this.name || this.name.trim() === '') {
      errors.push('Offer name is required');
    }

    if (!this.type || !this.isValidType()) {
      errors.push('Invalid offer type');
    }

    if (!this.shopId) {
      errors.push('Shop ID is required');
    }

    if (this.products.length === 0 && this.collections.length === 0) {
      errors.push('At least one product or collection must be selected');
    }

    if (this.type === 'quantity_break' && this.tiers.length === 0) {
      errors.push('Quantity breaks require at least one tier');
    }

    if (this.type === 'bundle' && this.bundleConfig.minItems < 1) {
      errors.push('Bundle must require at least 1 item');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if offer type is valid
   */
  isValidType() {
    const validTypes = ['quantity_break', 'bundle', 'volume_discount', 'cross_sell', 'cart_upsell'];
    return validTypes.includes(this.type);
  }

  /**
   * Calculate discount for given quantity and cart
   */
  calculateDiscount(quantity, cartItems = []) {
    if (this.type === 'quantity_break') {
      return this.calculateQuantityBreakDiscount(quantity);
    } else if (this.type === 'volume_discount') {
      return this.calculateVolumeDiscount(cartItems);
    } else if (this.type === 'bundle') {
      return this.calculateBundleDiscount(cartItems);
    }
    
    return 0;
  }

  /**
   * Calculate quantity break discount
   */
  calculateQuantityBreakDiscount(quantity) {
    // Sort tiers by quantity descending
    const sortedTiers = [...this.tiers].sort((a, b) => b.quantity - a.quantity);
    
    // Find applicable tier
    for (const tier of sortedTiers) {
      if (quantity >= tier.quantity) {
        if (this.discountType === 'percentage') {
          return tier.discount;
        } else if (this.discountType === 'fixed_amount') {
          return tier.discount * quantity;
        }
      }
    }
    
    return 0;
  }

  /**
   * Calculate volume discount across multiple products
   */
  calculateVolumeDiscount(cartItems) {
    const relevantItems = cartItems.filter(item => 
      this.products.includes(item.productId)
    );
    
    const totalQuantity = relevantItems.reduce((sum, item) => sum + item.quantity, 0);
    
    return this.calculateQuantityBreakDiscount(totalQuantity);
  }

  /**
   * Calculate bundle discount
   */
  calculateBundleDiscount(cartItems) {
    const bundleItems = cartItems.filter(item => 
      this.products.includes(item.productId)
    );
    
    if (bundleItems.length >= this.bundleConfig.minItems) {
      const subtotal = bundleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      if (this.discountType === 'percentage') {
        return (subtotal * this.discountValue) / 100;
      } else if (this.discountType === 'fixed_amount') {
        return this.discountValue;
      }
    }
    
    return 0;
  }

  /**
   * Check if offer should be displayed for current cart state
   */
  shouldDisplay(cartItems, customerSegment = null) {
    // Check if active
    if (this.status !== 'active') {
      return false;
    }

    // Check schedule
    if (!this.isWithinSchedule()) {
      return false;
    }

    // Check customer targeting
    if (customerSegment && this.targeting.customerGroups.length > 0) {
      if (!this.targeting.customerGroups.includes(customerSegment)) {
        return false;
      }
    }

    // Check if relevant products in cart
    const hasRelevantProducts = cartItems.some(item => 
      this.products.includes(item.productId) || 
      this.collections.some(col => item.collections?.includes(col))
    );

    return hasRelevantProducts;
  }

  /**
   * Check if offer is within scheduled timeframe
   */
  isWithinSchedule() {
    const now = new Date();
    
    if (this.schedule.startDate && new Date(this.schedule.startDate) > now) {
      return false;
    }
    
    if (this.schedule.endDate && new Date(this.schedule.endDate) < now) {
      return false;
    }
    
    return true;
  }

  /**
   * Increment analytics counter
   */
  trackEvent(eventType) {
    if (this.analytics[eventType] !== undefined) {
      this.analytics[eventType]++;
    }
  }

  /**
   * Convert to JSON for storage
   */
  toJSON() {
    return {
      id: this.id,
      shopId: this.shopId,
      type: this.type,
      name: this.name,
      description: this.description,
      status: this.status,
      products: this.products,
      collections: this.collections,
      discountType: this.discountType,
      discountValue: this.discountValue,
      tiers: this.tiers,
      bundleConfig: this.bundleConfig,
      freeGift: this.freeGift,
      displaySettings: this.displaySettings,
      styling: this.styling,
      schedule: this.schedule,
      targeting: this.targeting,
      analytics: this.analytics,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export default Offer;
