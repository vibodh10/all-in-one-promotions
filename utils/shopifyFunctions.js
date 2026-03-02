const API_VERSION = process.env.API_VERSION || "2024-01";

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
    throw new Error(JSON.stringify(json));
  }

  return json;
}

export async function createDiscount({ shop, accessToken }, offer) {
  const tiers = offer.tiers || [];
  const createdIds = [];

  const isPercentage =
      offer.discountType === "percentage" ||
      offer.discount_type === "percentage";

  for (const tier of tiers) {
    const mutation = `
      mutation discountAutomaticBasicCreate($automaticDiscount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticDiscount: $automaticDiscount) {
          automaticDiscountNode { id }
          userErrors { field message }
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

    const response = await shopifyGraphQL(
        shop,
        accessToken,
        mutation,
        variables
    );

    const node =
        response.data.discountAutomaticBasicCreate.automaticDiscountNode;

    if (node?.id) {
      createdIds.push(node.id);
    }
  }

  return { automaticDiscountIds: createdIds };
}

export async function deleteDiscount() {
  // Not needed for automatic discounts
}

export async function disableDiscount() {
  // Not needed for automatic discounts
}

export async function updateDiscount(auth, offer) {
  return await createDiscount(auth, offer);
}