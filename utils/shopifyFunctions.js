/**
 * Shopify Functions utility
 * Handles discount creation and management via Shopify Functions API
 */

import ShopifyPkg from '@shopify/shopify-api';
const { Shopify } = ShopifyPkg;

/**
 * Create a discount for an offer
 */
async function createDiscount(session, offer) {
  try {
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    // Determine discount type and create accordingly
    if (offer.type === 'quantity_break' || offer.type === 'volume_discount') {
      return await createQuantityDiscount(client, offer);
    } else if (offer.type === 'bundle') {
      return await createBundleDiscount(client, offer);
    } else if (offer.type === 'cross_sell') {
      return await createCrossSellDiscount(client, offer);
    }

    return null;
  } catch (error) {
    console.error('Error creating discount:', error);
    throw error;
  }
}

/**
 * Create quantity-based discount
 */
async function createQuantityDiscount(client, offer) {
  const discountCode = `SMARTOFFER_${offer.id}`;

  // Create automatic discount using Functions
  const response = await client.post({
    path: 'price_rules',
    data: {
      price_rule: {
        title: offer.name,
        target_type: 'line_item',
        target_selection: 'entitled',
        allocation_method: 'across',
        value_type: offer.discountType === 'percentage' ? 'percentage' : 'fixed_amount',
        value: offer.discountType === 'percentage' ? `-${offer.discountValue}` : `-${offer.discountValue}`,
        customer_selection: 'all',
        entitled_product_ids: offer.products,
        starts_at: offer.schedule.startDate || new Date().toISOString(),
        ends_at: offer.schedule.endDate,
        prerequisite_quantity_range: {
          greater_than_or_equal_to: offer.tiers && offer.tiers.length > 0 ? offer.tiers[0].quantity : 1
        }
      }
    },
    type: Shopify.DataType.JSON
  });

  const priceRule = response.body.price_rule;

  // Create discount code
  await client.post({
    path: `price_rules/${priceRule.id}/discount_codes`,
    data: {
      discount_code: {
        code: discountCode
      }
    },
    type: Shopify.DataType.JSON
  });

  return {
    priceRuleId: priceRule.id,
    discountCode
  };
}

/**
 * Create bundle discount
 */
async function createBundleDiscount(client, offer) {
  const discountCode = `BUNDLE_${offer.id}`;

  const response = await client.post({
    path: 'price_rules',
    data: {
      price_rule: {
        title: offer.name,
        target_type: 'line_item',
        target_selection: 'entitled',
        allocation_method: 'across',
        value_type: offer.discountType === 'percentage' ? 'percentage' : 'fixed_amount',
        value: offer.discountType === 'percentage' ? `-${offer.discountValue}` : `-${offer.discountValue}`,
        customer_selection: 'all',
        entitled_product_ids: offer.products,
        prerequisite_quantity_range: {
          greater_than_or_equal_to: offer.bundleConfig.minItems
        },
        starts_at: offer.schedule.startDate || new Date().toISOString(),
        ends_at: offer.schedule.endDate
      }
    },
    type: Shopify.DataType.JSON
  });

  const priceRule = response.body.price_rule;

  await client.post({
    path: `price_rules/${priceRule.id}/discount_codes`,
    data: {
      discount_code: {
        code: discountCode
      }
    },
    type: Shopify.DataType.JSON
  });

  return {
    priceRuleId: priceRule.id,
    discountCode
  };
}

/**
 * Create cross-sell discount
 */
async function createCrossSellDiscount(client, offer) {
  const discountCode = `CROSSSELL_${offer.id}`;

  const response = await client.post({
    path: 'price_rules',
    data: {
      price_rule: {
        title: offer.name,
        target_type: 'line_item',
        target_selection: 'entitled',
        allocation_method: 'across',
        value_type: offer.discountType === 'percentage' ? 'percentage' : 'fixed_amount',
        value: offer.discountType === 'percentage' ? `-${offer.discountValue}` : `-${offer.discountValue}`,
        customer_selection: 'all',
        entitled_product_ids: offer.products,
        starts_at: offer.schedule.startDate || new Date().toISOString(),
        ends_at: offer.schedule.endDate
      }
    },
    type: Shopify.DataType.JSON
  });

  const priceRule = response.body.price_rule;

  await client.post({
    path: `price_rules/${priceRule.id}/discount_codes`,
    data: {
      discount_code: {
        code: discountCode
      }
    },
    type: Shopify.DataType.JSON
  });

  return {
    priceRuleId: priceRule.id,
    discountCode
  };
}

/**
 * Update existing discount
 */
async function updateDiscount(session, offer) {
  try {
    // Delete existing discount
    if (offer.shopifyDiscountId) {
      await deleteDiscount(session, offer);
    }

    // Create new discount
    return await createDiscount(session, offer);
  } catch (error) {
    console.error('Error updating discount:', error);
    throw error;
  }
}

/**
 * Delete discount
 */
async function deleteDiscount(session, offer) {
  try {
    if (!offer.shopifyDiscountId) return;

    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    await client.delete({
      path: `price_rules/${offer.shopifyDiscountId}`
    });
  } catch (error) {
    console.error('Error deleting discount:', error);
    // Don't throw - discount might already be deleted
  }
}

/**
 * Disable discount temporarily
 */
async function disableDiscount(session, offer) {
  try {
    if (!offer.shopifyDiscountId) return;

    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    // Set end date to now to disable
    await client.put({
      path: `price_rules/${offer.shopifyDiscountId}`,
      data: {
        price_rule: {
          ends_at: new Date().toISOString()
        }
      },
      type: Shopify.DataType.JSON
    });
  } catch (error) {
    console.error('Error disabling discount:', error);
    throw error;
  }
}

/**
 * Get product details from Shopify
 */
async function getProduct(session, productId) {
  try {
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    const response = await client.get({
      path: `products/${productId}`
    });

    return response.body.product;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

/**
 * Get collection details from Shopify
 */
async function getCollection(session, collectionId) {
  try {
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    const response = await client.get({
      path: `collections/${collectionId}`
    });

    return response.body.collection;
  } catch (error) {
    console.error('Error fetching collection:', error);
    return null;
  }
}

/**
 * Get products from collection
 */
async function getProductsFromCollection(session, collectionId) {
  try {
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    const response = await client.get({
      path: `collections/${collectionId}/products`
    });

    return response.body.products;
  } catch (error) {
    console.error('Error fetching collection products:', error);
    return [];
  }
}

/**
 * Apply discount at checkout via Shopify Functions
 */
async function applyCheckoutDiscount(session, offer, cartItems) {
  try {
    const discount = offer.calculateDiscount(
      cartItems.reduce((sum, item) => sum + item.quantity, 0),
      cartItems
    );

    if (discount > 0) {
      return {
        type: offer.discountType,
        value: discount,
        code: `SMARTOFFER_${offer.id}`
      };
    }

    return null;
  } catch (error) {
    console.error('Error applying checkout discount:', error);
    return null;
  }
}

export {
  createDiscount,
  updateDiscount,
  deleteDiscount,
  disableDiscount,
  getProduct,
  getCollection,
  getProductsFromCollection,
  applyCheckoutDiscount
};
