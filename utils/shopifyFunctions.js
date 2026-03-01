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
  const { shop, accessToken } = auth;
  if (!shop || !accessToken) {
    throw new Error("Missing shop or access token");
  }

  const discountType = offer.discount_type || offer.discountType;
  const discountValue = offer.discount_value || offer.discountValue;
  const bundleConfig = offer.bundle_config || offer.bundleConfig;
  const tiers = offer.tiers || [];

  const minQty =
      offer.type === "bundle"
          ? bundleConfig?.minItems || 2
          : tiers?.[0]?.quantity || 1;

  const entitledProductGids = (offer.products || []).map(p =>
      typeof p === "string" ? p : p.id
  );

  const discountCode =
      offer.type === "bundle"
          ? `BUNDLE_${offer.id}`
          : offer.type === "cross_sell"
              ? `CROSSSELL_${offer.id}`
              : `SMARTOFFER_${offer.id}`;

  const mutation = `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    basicCodeDiscount: {
      title: offer.name,
      code: discountCode,
      startsAt: new Date().toISOString(),
      customerSelection: {
        all: true
      },
      customerGets: {
        items: {
          products: {
            productsToAdd: entitledProductGids
          }
        },
        value: discountType === "percentage"
            ? { percentage: discountValue / 100 }
            : {
              discountAmount: {
                amount: discountValue.toString(),
                appliesOnEachItem: false
              }
            }
      },
      minimumRequirement: {
        quantity: {
          greaterThanOrEqualToQuantity: String(minQty)
        }
      }
    }
  };

  const response = await fetch(
      `https://${shop}/admin/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken
        },
        body: JSON.stringify({ query: mutation, variables })
      }
  );

  const result = await response.json();

  if (result.errors) {
    console.error("GraphQL errors:", result.errors);
    throw new Error("GraphQL discount creation failed");
  }

  const userErrors =
      result.data.discountCodeBasicCreate.userErrors;

  if (userErrors.length > 0) {
    console.error("Discount user errors:", userErrors);
    throw new Error(userErrors[0].message);
  }

  const node =
      result.data.discountCodeBasicCreate.codeDiscountNode;

  return {
    priceRuleId: node.id,
    discountCode
  };
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
