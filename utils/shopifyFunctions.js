/**
 * Shopify Functions utility
 * Uses direct Admin REST calls (no RestClient / no internal imports).
 */

const API_VERSION = process.env.API_VERSION || "2024-01";

function gidToNumericId(gid) {
  if (!gid) return null;
  // gid://shopify/Product/123 -> 123
  const parts = String(gid).split("/");
  const maybe = parts[parts.length - 1];
  const num = Number(maybe);
  return Number.isFinite(num) ? num : null;
}

async function shopifyRest({ shop, accessToken, method, path, data }) {
  const url = `https://${shop}/admin/api/${API_VERSION}/${path}.json`;

  const res = await fetch(url, {
    method,
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = `Shopify REST error ${res.status} on ${path}: ${JSON.stringify(json)}`;
    throw new Error(msg);
  }

  return json;
}

export async function createDiscount(auth, offer) {
  const { shop, accessToken } = auth || {};
  if (!shop || !accessToken) throw new Error("Missing shop or access token");

  // Convert offer.products from objects -> numeric ids
  const entitledIds =
      Array.isArray(offer.products)
          ? offer.products
              .map(p => (typeof p === "object" ? gidToNumericId(p.id) : gidToNumericId(p)))
              .filter(Boolean)
          : [];

  // Basic price rule + discount code (legacy, but works)
  const discountCode =
      offer.type === "bundle" ? `BUNDLE_${offer.id}` :
          offer.type === "cross_sell" ? `CROSSSELL_${offer.id}` :
              `SMARTOFFER_${offer.id}`;

  const valueType = offer.discountType === "percentage" ? "percentage" : "fixed_amount";
  const value = `-${Number(offer.discountValue || 0)}`;

  const startsAt = offer.schedule?.startDate || new Date().toISOString();
  const endsAt = offer.schedule?.endDate || null;

  const priceRulePayload = {
    price_rule: {
      title: offer.name,
      target_type: "line_item",
      target_selection: "entitled",
      allocation_method: "across",
      value_type: valueType,
      value,
      customer_selection: "all",
      entitled_product_ids: entitledIds,
      starts_at: startsAt,
      ends_at: endsAt,
    },
  };

  // Quantity prereq if exists
  const minQty =
      offer.type === "bundle"
          ? (offer.bundleConfig?.minItems || 2)
          : (offer.tiers?.[0]?.quantity || 1);

  priceRulePayload.price_rule.prerequisite_quantity_range = {
    greater_than_or_equal_to: minQty,
  };

  const priceRuleRes = await shopifyRest({
    shop,
    accessToken,
    method: "POST",
    path: "price_rules",
    data: priceRulePayload,
  });

  const priceRuleId = priceRuleRes?.price_rule?.id;
  if (!priceRuleId) throw new Error("Price rule not created");

  await shopifyRest({
    shop,
    accessToken,
    method: "POST",
    path: `price_rules/${priceRuleId}/discount_codes`,
    data: { discount_code: { code: discountCode } },
  });

  return { priceRuleId, discountCode };
}

export async function deleteDiscount(auth, offer) {
  const { shop, accessToken } = auth || {};
  if (!shop || !accessToken) throw new Error("Missing shop or access token");
  if (!offer.shopifyDiscountId) return;

  await shopifyRest({
    shop,
    accessToken,
    method: "DELETE",
    path: `price_rules/${offer.shopifyDiscountId}`,
  });
}

export async function disableDiscount(auth, offer) {
  const { shop, accessToken } = auth || {};
  if (!shop || !accessToken) throw new Error("Missing shop or access token");
  if (!offer.shopifyDiscountId) return;

  await shopifyRest({
    shop,
    accessToken,
    method: "PUT",
    path: `price_rules/${offer.shopifyDiscountId}`,
    data: { price_rule: { ends_at: new Date().toISOString() } },
  });
}

export async function updateDiscount(auth, offer) {
  if (offer.shopifyDiscountId) {
    await deleteDiscount(auth, offer);
  }
  return await createDiscount(auth, offer);
}
