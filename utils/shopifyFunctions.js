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

  const productIds = (offer.products || []).map(p =>
      typeof p === "string" ? p : p.id
  );

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
              productsToAdd: productIds
            }
          },
          value: isPercentage
              ? { percentage: Number(tier.discount) / 100 }
              : {
                discountAmount: {
                  amount: String(tier.discount),
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

    try {
      const response = await shopifyGraphQL(
          shop,
          accessToken,
          mutation,
          { id }
      );

      const payload = response.data.discountAutomaticDelete;

      // If Shopify says it doesn't exist, ignore and continue
      const errs = payload?.userErrors || [];
      const missing = errs.some(e => (e.message || "").includes("does not exist"));

      if (errs.length && !missing) {
        console.error("Delete error:", errs);
        throw new Error(JSON.stringify(errs));
      }

      if (missing) {
        console.warn("Discount already missing, skipping delete:", id);
      }

    } catch (err) {
      // Also tolerate GraphQL-level "does not exist" errors
      const msg = String(err?.message || err);
      if (msg.includes("does not exist")) {
        console.warn("Discount already missing (caught), skipping delete:", id);
        continue;
      }
      throw err;
    }
  }
}

/* ================================
   DISABLE = DELETE
================================ */

export async function disableDiscount(auth, discountIds = []) {
  return await deleteDiscount(auth, discountIds);
}

/* ================================
   UPDATE = DELETE + RECREATE (CLEAN)
================================ */

export async function updateDiscount(context, offer) {
  const discountIds = offer.shopify_discount_ids || [];

  // 1️⃣ Delete existing tier discounts
  if (Array.isArray(discountIds) && discountIds.length > 0) {
    await deleteDiscount(context, discountIds);
  }

  // 2️⃣ Recreate fresh tier discounts
  const result = await createDiscount(context, offer);

  return result;
}