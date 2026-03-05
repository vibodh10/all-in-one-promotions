const API_VERSION = process.env.API_VERSION || "2026-01";

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
   CREATE FUNCTION DISCOUNT
================================ */

export async function createDiscount({ shop, accessToken }, offer) {

  const mutation = `
    mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
        automaticAppDiscount {
          discountId
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    automaticAppDiscount: {
      title: offer.name || "Promotion",
      functionHandle: "promotions-discount",

      startsAt: new Date().toISOString(),

      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      }
    }
  };

  const response = await shopifyGraphQL(
      shop,
      accessToken,
      mutation,
      variables
  );

  const payload = response.data.discountAutomaticAppCreate;

  if (payload.userErrors.length) {
    throw new Error(JSON.stringify(payload.userErrors));
  }

  return {
    automaticDiscountIds: [
      payload.automaticAppDiscount.discountId
    ]
  };
}

/* ================================
   DELETE AUTOMATIC DISCOUNT
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

      const errs = payload?.userErrors || [];

      const missing = errs.some(e =>
          (e.message || "").includes("does not exist")
      );

      if (errs.length && !missing) {
        console.error("Delete error:", errs);
        throw new Error(JSON.stringify(errs));
      }

      if (missing) {
        console.warn("Discount already missing:", id);
      }

    } catch (err) {

      const msg = String(err?.message || err);

      if (msg.includes("does not exist")) {
        console.warn("Discount already missing (caught):", id);
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
   UPDATE = DELETE + RECREATE
================================ */

export async function updateDiscount(context, offer) {

  const discountIds = offer.shopify_discount_ids || [];

  if (Array.isArray(discountIds) && discountIds.length > 0) {
    await deleteDiscount(context, discountIds);
  }

  const result = await createDiscount(context, offer);

  return result;
}