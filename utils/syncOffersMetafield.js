export async function syncActiveOffers(context, offers) {
    const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }
  `;

    const variables = {
        metafields: [
            {
                ownerId: context.shopGid,
                namespace: "promotions",
                key: "active_offers",
                type: "json",
                value: JSON.stringify(offers),
            },
        ],
    };

    await shopifyGraphQL(context.shop, context.accessToken, mutation, variables);
}