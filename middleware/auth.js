// middleware/auth.js
import express from "express";
import * as billing from "../routes/billing.js";
import database from "../utils/database.js";
import Shopify from '@shopify/shopify-api';

const { shopifyApi, LATEST_API_VERSION, loadCurrentSession } = Shopify;

const router = express.Router();

// ✅ Initialize Shopify instance once
const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES.split(","),
    hostName: process.env.HOST.replace(/https?:\/\//, ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
});

/* --------------------------------------------
   1️⃣ Begin OAuth
--------------------------------------------- */
router.get("/auth", async (req, res) => {
    try {
        const shop = req.query.shop;
        if (!shop) return res.status(400).send("Missing shop param");

        const redirectUrl = await shopify.auth.begin({
            shop,
            callbackPath: "/auth/callback",
            isOnline: false,
            rawRequest: req,
            rawResponse: res,
        });

        return res.redirect(redirectUrl);
    } catch (err) {
        console.error("Auth start error:", err);
        return res.status(500).json({ error: "Failed to start OAuth" });
    }
});

/* --------------------------------------------
   2️⃣ OAuth Callback
--------------------------------------------- */
router.get("/auth/callback", async (req, res) => {
    console.log("🔥 Inside /auth/callback");
    try {
        const session = await shopify.auth.callback({
            rawRequest: req,
            rawResponse: res,
        });

        // ✅ Persist essential data
        req.session.shop = session.shop;
        req.session.host = req.query.host || session.host;
        await new Promise((resolve, reject) =>
            req.session.save(err => (err ? reject(err) : resolve()))
        );

        console.log("✅ Saved session:", req.session);

        await createBillingCharge(session);

        return res.redirect(`/frontend/?shop=${session.shop}&host=${req.session.host}`);
    } catch (err) {
        console.error("Auth callback error:", err);
        return res.status(500).json({ error: "OAuth callback failed" });
    }
});

/* --------------------------------------------
   3️⃣ Verify Request Middleware
--------------------------------------------- */
export async function verifyRequest(req, res, next) {
    try {
        const session = await loadCurrentSession(req, res, true);
        if (!session || !session.accessToken) {
            console.warn("❌ No active session found");
            return res.status(401).json({ error: "Unauthorized" });
        }
        req.session = session;
        next();
    } catch (error) {
        console.error("Verification error:", error);
        return res.status(401).json({ error: "Unauthorized" });
    }
}

/* --------------------------------------------
   4️⃣ Verify Webhook Middleware
--------------------------------------------- */
export async function verifyWebhook(req, res, next) {
    try {
        const result = await shopify.webhooks.process({
            rawBody: req.body,
            rawRequest: req,
            rawResponse: res,
        });

        if (!result) {
            return res.status(401).json({ error: "Invalid webhook" });
        }

        next();
    } catch (error) {
        console.error("Webhook verification error:", error);
        return res.status(401).json({ error: "Invalid webhook" });
    }
}

/* --------------------------------------------
   5️⃣ Billing placeholder
--------------------------------------------- */
async function createBillingCharge(session) {
    // TODO: implement billing later
}

/* --------------------------------------------
   6️⃣ Export router
--------------------------------------------- */
export default router;
