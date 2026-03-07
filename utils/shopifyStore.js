export async function getStoreDefaults(shop, accessToken, shopifyGraphQL) {
    const query = `
    query StoreDefaults {
      shop {
        id
        name
        currencyCode
        ianaTimezone
        email
      }
    }
  `;

    const { data } = await shopifyGraphQL(shop, accessToken, query, {});

    return {
        shopId: data.shop.id,
        storeName: data.shop.name,
        currencyCode: data.shop.currencyCode,
        timezone: data.shop.ianaTimezone,
        email: data.shop.email
    };
}