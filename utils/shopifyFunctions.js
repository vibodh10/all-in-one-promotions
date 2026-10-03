import { getStoreDefaults } from "./shopifyStore.js";
import {getValidOfflineAccessToken} from "./tokenManager.js";

const API_VERSION = process.env.API_VERSION || "2026-10";

/* ================================
   GraphQL Helper
================================ */

export async function shopifyGraphQL(
    shop,
    query,
    variables = {}
) {
  if (!shop) {
    throw new Error("Shop domain is required");
  }

  if (!query) {
    throw new Error("GraphQL query is required");
  }

  const accessToken =
      await getValidOfflineAccessToken(shop);

  const response = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      }
  );

  const requestId =
      response.headers.get("x-request-id");

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Shopify GraphQL HTTP error:", {
      shop,
      status: response.status,
      requestId,
      response: json,
    });

    throw new Error(
        json?.errors?.[0]?.message ||
        `Shopify API request failed with status ${response.status}`
    );
  }

  if (json?.errors?.length) {
    console.error("Shopify GraphQL errors:", {
      shop,
      requestId,
      errors: json.errors,
    });

    throw new Error(
        json.errors
            .map((error) => error.message)
            .join("; ")
    );
  }

  return json;
}

function getDiscountSchedule(offer) {
  const startValue = offer?.schedule?.startDate;
  const endValue = offer?.schedule?.endDate;

  const start = startValue ? new Date(startValue) : new Date();
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid offer start date");
  }

  const end = endValue ? new Date(endValue) : null;
  if (end && Number.isNaN(end.getTime())) {
    throw new Error("Invalid offer end date");
  }

  if (end && end <= start) {
    throw new Error("Offer end date must be after its start date");
  }

  return {
    startsAt: start.toISOString(),
    endsAt: end ? end.toISOString() : null,
  };
}

/* ================================
   CREATE FUNCTION DISCOUNT
================================ */

export async function createDiscount({ shop, accessToken }, offer) {

  const { startsAt, endsAt } = getDiscountSchedule(offer);

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

  const variables = {
    automaticAppDiscount: {
      title: offer.name || "Promotion",

      functionHandle: "promotions-discount",

      startsAt,
      ...(endsAt ? { endsAt } : {}),

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
      }

    }
  };

  const response = await shopifyGraphQL(
      shop,
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

/* ================================
   DISCOUNT ROLLOUT VISIBILITY
================================ */

export async function isDiscountSafeToPromote(shop, discountId) {
  if (!shop || !discountId) return false;

  const scopesQuery = `
    query CurrentAppScopes {
      currentAppInstallation {
        accessScopes {
          handle
        }
      }
    }
  `;

  try {
    const scopeResponse = await shopifyGraphQL(shop, scopesQuery);
    const scopes =
      scopeResponse?.data?.currentAppInstallation?.accessScopes?.map(
        (scope) => scope.handle
      ) || [];

    // Existing installations may not have granted the new scope yet.
    // Preserve current storefront behaviour until reauthorization occurs.
    if (!scopes.includes("read_rollouts")) {
      console.warn("read_rollouts scope not granted yet; skipping rollout check", {
        shop,
        discountId,
      });
      return true;
    }

    const changeFilter = `discount_id:'${discountId}'`;

    const query = `
      query DiscountRolloutVisibility($id: ID!, $changeFilter: String!) {
        discountNode(id: $id) {
          discount {
            ... on DiscountAutomaticApp {
              status
              rollouts(first: 10, query: "status:ACTIVE") {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  status
                  effectiveTrafficAllocation
                  treatments {
                    id
                    split
                    changes(first: 20, query: $changeFilter) {
                      pageInfo {
                        hasNextPage
                        endCursor
                      }
                      nodes {
                        __typename
                        ... on RolloutDiscountChange {
                          discount {
                            id
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await shopifyGraphQL(shop, query, {
      id: discountId,
      changeFilter,
    });

    const discount = response?.data?.discountNode?.discount;
    if (!discount) return false;

    // Shopify is the source of truth for scheduled activation/expiry.
    // Do not advertise the offer until Shopify reports the discount ACTIVE.
    if (discount.status !== "ACTIVE") return false;

    const rollouts = discount?.rollouts;
    if (!rollouts) return true;

    // If Shopify paginates the active rollout list, fail closed rather than
    // advertising a discount without the full effective-availability picture.
    if (rollouts.pageInfo?.hasNextPage) return false;

    const activeRollouts = rollouts.nodes || [];
    if (!activeRollouts.length) return true;

    return activeRollouts.every((rollout) => {
      if (Number(rollout.effectiveTrafficAllocation) !== 100) {
        return false;
      }

      const treatments = rollout.treatments || [];

      for (const treatment of treatments) {
        if (treatment?.changes?.pageInfo?.hasNextPage) {
          return false;
        }
      }

      // Shopify documents this as the simple safe case for buyer-facing
      // promotion: 100% effective allocation and one 100%-split treatment
      // that activates this discount.
      return treatments.some((treatment) => {
        if (Number(treatment.split) !== 100) return false;

        return (treatment?.changes?.nodes || []).some(
          (change) =>
            change?.__typename === "RolloutDiscountActivateChange" &&
            change?.discount?.id === discountId
        );
      });
    });
  } catch (error) {
    console.error("Failed to determine discount rollout visibility:", {
      shop,
      discountId,
      error: error?.message || error,
    });

    // Once rollout access is granted, uncertainty must not result in an offer
    // being advertised to buyers who might not receive it.
    return false;
  }
}
