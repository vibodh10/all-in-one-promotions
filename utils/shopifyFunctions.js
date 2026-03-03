const API_VERSION = process.env.API_VERSION || "2024-01";

/* ================================
   GraphQL Helper
================================ */

async function shopifyGraphQL(shop, accessToken, query, variables) {
  const res = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      }
  );

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error("Shopify GraphQL Error:", json);
    throw new Error(JSON.stringify(json));
  }

  return json;
}

/* ================================
   CREATE AUTOMATIC DISCOUNTS
   (one per tier)
================================ */

export async function createDiscount({ shop, accessToken }, offer) {
  const tiers = offer.tiers || [];
  const createdIds = [];

  const type = (offer.discountType || offer.discount_type || "").toLowerCase();

  const isPercentage = type === "percentage";
  const isFixed = type === "fixed_amount";

  for (const tier of tiers) {
    const mutation = `
      mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
          automaticDiscountNode { id }
          userErrors { field message }
        }
      }
    `;

    const variables = {
      automaticBasicDiscount: {
        title: `${offer.name} - Buy ${tier.quantity}`,
        startsAt: new Date().toISOString(),

        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false
        },

        minimumRequirement: {
          quantity: {
            greaterThanOrEqualToQuantity: String(tier.quantity)
          }
        },

        customerGets: {
          items: {
            products: {
              productsToAdd: (offer.products || []).map(p =>
                  typeof p === "string" ? p : p.id
              )
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

    const response = await shopifyGraphQL(
        shop,
        accessToken,
        mutation,
        variables
    );

    const payload = response.data.discountAutomaticBasicCreate;

    if (payload.userErrors.length) {
      throw new Error(JSON.stringify(payload.userErrors));
    }

    createdIds.push(payload.automaticDiscountNode.id);
  }

  return { automaticDiscountIds: createdIds };
}

/* ================================
   DELETE AUTOMATIC DISCOUNTS
================================ */

export async function deleteDiscount({ shop, accessToken }, discountIds = []) {
  if (!Array.isArray(discountIds)) return;

  const mutation = `
    mutation discountAutomaticDelete($id: ID!) {
      discountAutomaticDelete(id: $id) {
        deletedAutomaticDiscountId
        userErrors { field message }
      }
    }
  `;

  for (const id of discountIds) {
    if (!id) continue;

    const response = await shopifyGraphQL(
        shop,
        accessToken,
        mutation,
        { id }
    );

    const payload = response.data.discountAutomaticDelete;

    if (payload.userErrors.length) {
      console.error("Delete error:", payload.userErrors);
      throw new Error(JSON.stringify(payload.userErrors));
    }
  }
}

/* ================================
   DISABLE = DELETE (for automatic)
================================ */

export async function disableDiscount(auth, discountIds = []) {
  return await deleteDiscount(auth, discountIds);
}

/* ================================
   UPDATE = DELETE + RECREATE
================================ */

export async function updateDiscount(auth, offer) {
  // delete previous automatic discounts
  if (offer.shopify_discount_ids?.length) {
    await deleteDiscount(auth, offer.shopify_discount_ids);
  }

  // recreate new ones
  return await createDiscount(auth, offer);
}