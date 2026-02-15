// shopify.js
import { Shopify } from "@shopify/shopify-api";

// Initialize Shopify API context
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

const shopify = shopifyApi({
  apiKey: process.env.VITE_SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES.split(","),
  hostName: process.env.HOST.replace(/https?:\/\//, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});
({
    API_KEY: process.env.VITE_SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SHOPIFY_SCOPES.split(","),
    HOST_NAME: process.env.HOST.replace(/^https?:\/\//, ""),
    IS_EMBEDDED_APP: true,
    API_VERSION: process.env.API_VERSION || "2024-01",
    SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

export default Shopify;
