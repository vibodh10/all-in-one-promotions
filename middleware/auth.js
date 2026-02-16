// middleware/auth.js
import express from "express";
import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";

const router = express.Router();

/* --------------------------------------------
   1️⃣ Initialize Shopify instance (ONLY once)
--------------------------------------------- */
const shopify = shopifyApi({
    apiKey: process.env.VITE_SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES.split(","),
    hostName: process.env.HOST.replace(/https?:\/\//, ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
});

/* --------------------------------------------
   2️⃣ Begin OAuth
--------------------------------------------- */
router.get("/auth", async (req, res) => {
    try {
        const shop = req.query.shop;
        if (!shop) return res.status(400).send("Missing shop param");

        await shopify.auth.begin({
            shop,
            callbackPath: "/auth/callback",
            isOnline: false,
            rawRequest: req,
            rawResponse: res,
        });

    } catch (err) {
        console.error("Auth start error:", err);
        return res.status(500).json({ error: "Failed to start OAuth" });
    }
});

/* --------------------------------------------
   3️⃣ OAuth Callback
--------------------------------------------- */
router.get("/auth/callback", async (req, res) => {
    try {
        const session = await shopify.auth.callback({
            rawRequest: req,
            rawResponse: res,
        });

        // 🔥 Store EVERYTHING needed
        req.session.scope = session.scope;
        req.session.host = req.query.host || session.host;

        await new Promise((resolve, reject) =>
            req.session.save(err => (err ? reject(err) : resolve()))
        );

        return res.redirect(`/frontend/?shop=${session.shop}&host=${req.session.host}`);

    } catch (err) {
        console.error("Auth callback error:", err);
        return res.status(500).json({ error: "OAuth callback failed" });
    }
});

/* --------------------------------------------
   4️⃣ Verify Request (USED BY API ROUTES)
--------------------------------------------- */
export async function verifyRequest(req, res, next) {
    try {
        const shop = req.query.shop || req.session?.shop;

        console.log("VERIFY CHECK → shop:", shop);

        if (!shop) {
            console.warn("❌ No shop provided");
            return res.status(401).json({ error: "Unauthorized" });
        }

        req.shop = shop;
        next();

    } catch (error) {
        console.error("Verification error:", error);
        return res.status(401).json({ error: "Unauthorized" });
    }
}

/* --------------------------------------------
   5️⃣ Verify Webhook
--------------------------------------------- */
export async function verifyWebhook(req, res, next) {
    try {
        await shopify.webhooks.process({
            rawBody: req.body,
            rawRequest: req,
            rawResponse: res,
        });

        next();

    } catch (error) {
        console.error("Webhook verification error:", error);
        return res.status(401).json({ error: "Invalid webhook" });
    }
}

/* --------------------------------------------
   6️⃣ Export router
--------------------------------------------- */
export default router;
