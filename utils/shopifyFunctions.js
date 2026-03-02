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

async function createDiscount({ shop, accessToken }, offer) {
  const tiers = offer.tiers || [];

  for (const tier of tiers) {

    const isPercentage =
        offer.discountType === "percentage" ||
        offer.discount_type === "percentage";

    const mutation = `
      mutation discountAutomaticBasicCreate($automaticDiscount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticDiscount: $automaticDiscount) {
          automaticDiscountNode {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      automaticDiscount: {
        title: `${offer.name} - Buy ${tier.quantity}`,
        startsAt: new Date().toISOString(),
        customerSelection: { all: true },
        minimumRequirement: {
          quantity: {
            greaterThanOrEqualToQuantity: String(tier.quantity)
          }
        },
        customerGets: {
          items: {
            products: {
              productsToAdd: offer.products
            }
          },
          value: isPercentage
              ? { percentage: tier.discount / 100 }
              : {
                discountAmount: {
                  amount: tier.discount.toString(),
                  appliesOnEachItem: false
                }
              }
        }
      }
    };

    await shopifyGraphQL(shop, accessToken, mutation, variables);
  }
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
