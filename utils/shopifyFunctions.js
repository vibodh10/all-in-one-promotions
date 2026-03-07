import { getStoreDefaults } from "./shopifyStore.js";

const API_VERSION = process.env.API_VERSION || "2026-01";

/* ================================
   GraphQL Helper
================================ */

export async function shopifyGraphQL(shop, accessToken, query, variables) {
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

  /* ⭐ GET STORE DEFAULT CURRENCY */

  const storeDefaults = await getStoreDefaults(shop, accessToken, shopifyGraphQL);
  const currencyCode = storeDefaults.currencyCode;

  /* --------------------------------
     1️⃣ SAVE OFFER INTO SHOP METAFIELD
  -------------------------------- */

  const metafieldMutation = `
    mutation metafieldsSet($metafields:[MetafieldsSetInput!]!) {
      metafieldsSet(metafields:$metafields) {
        metafields { key namespace }
        userErrors { field message }
      }
    }
  `;

  await shopifyGraphQL(
      shop,
      accessToken,
      metafieldMutation,
      {
        metafields: [
          {
            ownerId: storeDefaults.shopId,
            namespace: "promotions",
            key: "active_offers",
            type: "json",
            value: JSON.stringify([offer])
          }
        ]
      }
  );

  /* --------------------------------
     2️⃣ CREATE AUTOMATIC DISCOUNT
  -------------------------------- */

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

  /* ⭐ FIXED DISCOUNT VALUE SUPPORT */

  let discountValue = null;

  if (offer.discountType === "fixed") {
    discountValue = {
      fixedAmount: {
        amount: offer.discountValue,
        currencyCode: currencyCode
      }
    };
  }

  const variables = {
    automaticAppDiscount: {
      title: offer.name || "Promotion",

      functionHandle: "promotions-discount",

      startsAt: new Date().toISOString(),

      metafields: [
        {
          namespace: "$app:promotions",
          key: "config",
          type: "json",
          value: JSON.stringify([offer])
        }
      ],

      combinesWith: {
        productDiscounts: true,
        orderDiscounts: true,
        shippingDiscounts: true
      },

      /* ⭐ attach value if fixed discount */
      ...(discountValue && { value: discountValue })

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