// shopify.js
import { Shopify } from "@shopify/shopify-api";

Shopify.Context.initialize({
    API_KEY: process.env.VITE_SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SHOPIFY_SCOPES.split(","),
    HOST_NAME: process.env.HOST.replace(/^https?:\/\//, ""),
    IS_EMBEDDED_APP: true,
    API_VERSION: process.env.API_VERSION || "2024-01",
});

export default Shopify;
