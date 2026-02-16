// routes/webhooks.js
import express from "express";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import database from "../utils/database.js";

const router = express.Router();

const shopify = shopifyApi({
    apiKey: process.env.VITE_SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES.split(","),
    hostName: process.env.HOST.replace(/https?:\/\//, ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
});

// ✅ App uninstalled
router.post("/app/uninstalled", async (req, res) => {
    try {
        const shop = req.body.domain;
        console.log(`App uninstalled for shop: ${shop}`);
        await database.deleteShopData(shop);
        res.status(200).send("OK");
    } catch (err) {
        console.error("Error handling uninstall:", err);
        res.status(500).send("Error");
    }
});

// ✅ Shop update
router.post("/shop/update", async (req, res) => {
    try {
        const shop = req.body;
        console.log(`Shop updated: ${shop.domain}`);
        await database.updateShop({
            shopId: shop.domain,
            name: shop.name,
            email: shop.email,
            currency: shop.currency,
            timezone: shop.iana_timezone,
            plan: shop.plan_name,
            updatedAt: new Date(),
        });
        res.status(200).send("OK");
    } catch (err) {
        console.error("Error handling shop update:", err);
        res.status(500).send("Error");
    }
});

// ✅ Orders create
router.post("/orders/create", async (req, res) => {
    try {
        const order = req.body;
        console.log(`New order created: ${order.id}`);

        const lineItems = order.line_items || [];
        for (const item of lineItems) {
            const offerMetadata = item.properties?.find((p) => p.name === "_offer_id");
            if (offerMetadata) {
                await database.saveAnalyticsEvent({
                    eventName: "purchase_complete",
                    offerId: offerMetadata.value,
                    productId: item.product_id,
                    cartValue: parseFloat(order.total_price),
                    currency: order.currency,
                    metadata: { orderId: order.id, orderNumber: order.order_number },
                    timestamp: new Date(),
                    shopId: order.shop_domain || order.domain,
                });
            }
        }
        res.status(200).send("OK");
    } catch (err) {
        console.error("Error handling order create:", err);
        res.status(500).send("Error");
    }
});

// ✅ Register webhooks for a shop
export async function registerWebhooks(session) {
    const client = new shopify.rest.RestClient({ session });

    const topics = [
        { topic: "app/uninstalled", address: `${process.env.APP_URL}/api/webhooks/app/uninstalled` },
        { topic: "shop/update", address: `${process.env.APP_URL}/api/webhooks/shop/update` },
        { topic: "orders/create", address: `${process.env.APP_URL}/api/webhooks/orders/create` },
    ];

    for (const w of topics) {
        try {
            await client.post({
                path: "webhooks",
                data: { webhook: { topic: w.topic, address: w.address, format: "json" } },
                type: "application/json",
            });
            console.log(`Registered webhook: ${w.topic}`);
        } catch (err) {
            console.error(`Error registering webhook ${w.topic}:`, err);
        }
    }
}

export default router;
