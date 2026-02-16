// utils/shopifyFunctions.js
/**
 * Shopify Functions utility
 * Uses the SINGLE shopify instance from middleware/auth.js
 */
import { shopify } from "../middleware/auth.js";

/** Convert GID -> numeric id (required by REST price_rules API) */
function toNumericId(gidOrNumber) {
  if (gidOrNumber == null) return null;
  const s = String(gidOrNumber);
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split("/");
  const last = parts[parts.length - 1];
  return /^\d+$/.test(last) ? Number(last) : null;
}

/** Build a Shopify Session object from express-session (no DB storage needed) */
export function buildShopifySessionFromReq(req) {
  const shop = req.query.shop || req.session?.shop;
  const accessToken = req.session?.accessToken;

  if (!shop || !accessToken) return null;

  const id = `offline_${shop}`;
  const s = new shopify.session.Session({
    id,
    shop,
    state: "n/a",
    isOnline: false,
  });

  s.accessToken = accessToken;
  return s;
}

/** Create REST client using Shopify Session */
function restClient(req) {
  return new shopify.clients.Rest({
    session: {
      shop: req.shop,
      accessToken: req.accessToken,
    },
  });
}

/* ==========================================================
   Create Discount (Price Rules + Discount Code)
   NOTE: Price rules are old API. For now OK for tests/dev stores.
   ========================================================== */
export async function createDiscount(session, offer) {
  const client = restClient(session);

  // Your frontend sends products as objects: [{id,title,images...}]
  const entitledProductIds = (offer.products || [])
      .map((p) => toNumericId(p.id ?? p))
      .filter(Boolean);

  // If you want collections support later, you’ll need to expand to product ids.

  const discountCode = `SMARTOFFER_${offer.id || Date.now()}`;

  const valueType = offer.discountType === "percentage" ? "percentage" : "fixed_amount";
  const value = `-${Number(offer.discountValue || 0)}`;

  const minQty =
      Array.isArray(offer.tiers) && offer.tiers.length > 0
          ? Number(offer.tiers[0].quantity || 1)
          : 1;

  const startsAt = offer?.schedule?.startDate || new Date().toISOString();
  const endsAt = offer?.schedule?.endDate || null;

  // Basic guard
  if (entitledProductIds.length === 0) {
    throw new Error("No entitled products selected (entitled_product_ids is empty).");
  }

  // 1) Create price rule
  const pr = await client.post({
    path: "price_rules",
    data: {
      price_rule: {
        title: offer.name || "Smart Offer",
        target_type: "line_item",
        target_selection: "entitled",
        allocation_method: "across",
        value_type: valueType,
        value,
        customer_selection: "all",
        entitled_product_ids: entitledProductIds,
        starts_at: startsAt,
        ends_at: endsAt,
        prerequisite_quantity_range: {
          greater_than_or_equal_to: minQty,
        },
      },
    },
    type: "application/json",
  });

  const priceRule = pr?.body?.price_rule;
  if (!priceRule?.id) throw new Error("Failed to create price rule");

  // 2) Create discount code under price rule
  await client.post({
    path: `price_rules/${priceRule.id}/discount_codes`,
    data: { discount_code: { code: discountCode } },
    type: "application/json",
  });

  return { priceRuleId: priceRule.id, discountCode };
}

export async function deleteDiscount(session, offer) {
  if (!offer?.shopifyDiscountId) return;
  const client = restClient(session);
  await client.delete({ path: `price_rules/${offer.shopifyDiscountId}` });
}

export async function disableDiscount(session, offer) {
  if (!offer?.shopifyDiscountId) return;
  const client = restClient(session);
  await client.put({
    path: `price_rules/${offer.shopifyDiscountId}`,
    data: { price_rule: { ends_at: new Date().toISOString() } },
    type: "application/json",
  });
}

export async function updateDiscount(session, offer) {
  // simplest: delete + recreate
  if (offer?.shopifyDiscountId) {
    await deleteDiscount(session, offer);
  }
  return createDiscount(session, offer);
}
