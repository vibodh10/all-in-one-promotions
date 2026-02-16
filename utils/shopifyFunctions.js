/**
 * Shopify Functions utility
 * Handles discount creation and management via Shopify REST API (v11+)
 */

import { RestClient } from "@shopify/shopify-api";

/**
 * Helper: create authenticated REST client for current session
 */
function restClient(session) {
  return new RestClient(session.shop, session.accessToken);
}

/* ==========================================================
   1️⃣ Create Discount
   ========================================================== */
export async function createDiscount(shop, offer) {
  try {
    const client = restClient(shop);

    if (offer.type === "quantity_break" || offer.type === "volume_discount") {
      return await createQuantityDiscount(client, offer);
    } else if (offer.type === "bundle") {
      return await createBundleDiscount(client, offer);
    } else if (offer.type === "cross_sell") {
      return await createCrossSellDiscount(client, offer);
    }

    return null;
  } catch (error) {
    console.error("Error creating discount:", error);
    throw error;
  }
}

/* ==========================================================
   2️⃣ Quantity-based Discount
   ========================================================== */
async function createQuantityDiscount(client, offer) {
  const discountCode = `SMARTOFFER_${offer.id}`;

  const response = await client.post({
    path: "price_rules",
    data: {
      price_rule: {
        title: offer.name,
        target_type: "line_item",
        target_selection: "entitled",
        allocation_method: "across",
        value_type: offer.discountType === "percentage" ? "percentage" : "fixed_amount",
        value:
            offer.discountType === "percentage"
                ? `-${offer.discountValue}`
                : `-${offer.discountValue}`,
        customer_selection: "all",
        entitled_product_ids: offer.products || [],
        starts_at: offer.schedule?.startDate || new Date().toISOString(),
        ends_at: offer.schedule?.endDate || null,
        prerequisite_quantity_range: {
          greater_than_or_equal_to:
              offer.tiers?.length > 0 ? offer.tiers[0].quantity : 1,
        },
      },
    },
    type: "application/json",
  });

  const priceRule = response.body.price_rule;

  await client.post({
    path: `price_rules/${priceRule.id}/discount_codes`,
    data: { discount_code: { code: discountCode } },
    type: "application/json",
  });

  return { priceRuleId: priceRule.id, discountCode };
}

/* ==========================================================
   3️⃣ Bundle Discount
   ========================================================== */
async function createBundleDiscount(client, offer) {
  const discountCode = `BUNDLE_${offer.id}`;

  const response = await client.post({
    path: "price_rules",
    data: {
      price_rule: {
        title: offer.name,
        target_type: "line_item",
        target_selection: "entitled",
        allocation_method: "across",
        value_type: offer.discountType === "percentage" ? "percentage" : "fixed_amount",
        value:
            offer.discountType === "percentage"
                ? `-${offer.discountValue}`
                : `-${offer.discountValue}`,
        customer_selection: "all",
        entitled_product_ids: offer.products || [],
        prerequisite_quantity_range: {
          greater_than_or_equal_to: offer.bundleConfig?.minItems || 2,
        },
        starts_at: offer.schedule?.startDate || new Date().toISOString(),
        ends_at: offer.schedule?.endDate || null,
      },
    },
    type: "application/json",
  });

  const priceRule = response.body.price_rule;

  await client.post({
    path: `price_rules/${priceRule.id}/discount_codes`,
    data: { discount_code: { code: discountCode } },
    type: "application/json",
  });

  return { priceRuleId: priceRule.id, discountCode };
}

/* ==========================================================
   4️⃣ Cross-sell Discount
   ========================================================== */
async function createCrossSellDiscount(client, offer) {
  const discountCode = `CROSSSELL_${offer.id}`;

  const response = await client.post({
    path: "price_rules",
    data: {
      price_rule: {
        title: offer.name,
        target_type: "line_item",
        target_selection: "entitled",
        allocation_method: "across",
        value_type: offer.discountType === "percentage" ? "percentage" : "fixed_amount",
        value:
            offer.discountType === "percentage"
                ? `-${offer.discountValue}`
                : `-${offer.discountValue}`,
        customer_selection: "all",
        entitled_product_ids: offer.products || [],
        starts_at: offer.schedule?.startDate || new Date().toISOString(),
        ends_at: offer.schedule?.endDate || null,
      },
    },
    type: "application/json",
  });

  const priceRule = response.body.price_rule;

  await client.post({
    path: `price_rules/${priceRule.id}/discount_codes`,
    data: { discount_code: { code: discountCode } },
    type: "application/json",
  });

  return { priceRuleId: priceRule.id, discountCode };
}

/* ==========================================================
   5️⃣ Update, Delete, Disable
   ========================================================== */
export async function updateDiscount(session, offer) {
  try {
    if (offer.shopifyDiscountId) await deleteDiscount(session, offer);
    return await createDiscount(session, offer);
  } catch (error) {
    console.error("Error updating discount:", error);
    throw error;
  }
}

export async function deleteDiscount(session, offer) {
  try {
    if (!offer.shopifyDiscountId) return;
    const client = restClient(session);
    await client.delete({ path: `price_rules/${offer.shopifyDiscountId}` });
  } catch (error) {
    console.error("Error deleting discount:", error);
  }
}

export async function disableDiscount(session, offer) {
  try {
    if (!offer.shopifyDiscountId) return;
    const client = restClient(session);
    await client.put({
      path: `price_rules/${offer.shopifyDiscountId}`,
      data: { price_rule: { ends_at: new Date().toISOString() } },
      type: "application/json",
    });
  } catch (error) {
    console.error("Error disabling discount:", error);
    throw error;
  }
}

/* ==========================================================
   6️⃣ Product & Collection Helpers
   ========================================================== */
export async function getProduct(session, productId) {
  try {
    const client = restClient(session);
    const response = await client.get({ path: `products/${productId}` });
    return response.body.product;
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}

export async function getCollection(session, collectionId) {
  try {
    const client = restClient(session);
    const response = await client.get({ path: `collections/${collectionId}` });
    return response.body.collection;
  } catch (error) {
    console.error("Error fetching collection:", error);
    return null;
  }
}

export async function getProductsFromCollection(session, collectionId) {
  try {
    const client = restClient(session);
    const response = await client.get({ path: `collections/${collectionId}/products` });
    return response.body.products;
  } catch (error) {
    console.error("Error fetching collection products:", error);
    return [];
  }
}

/* ==========================================================
   7️⃣ Checkout Discount (Local Calculation)
   ========================================================== */
export async function applyCheckoutDiscount(session, offer, cartItems) {
  try {
    const discount = offer.calculateDiscount(
        cartItems.reduce((sum, item) => sum + item.quantity, 0),
        cartItems
    );

    if (discount > 0) {
      return {
        type: offer.discountType,
        value: discount,
        code: `SMARTOFFER_${offer.id}`,
      };
    }

    return null;
  } catch (error) {
    console.error("Error applying checkout discount:", error);
    return null;
  }
}
