// middleware/auth.js
import express from "express";
import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";

const router = express.Router();

/**
 * SINGLE Shopify instance for the whole backend
 * (Do NOT re-initialize Shopify in other files)
 */
export const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY, // ✅ backend env (NOT VITE_)
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SHOPIFY_SCOPES || "").split(",").map((s) => s.trim()).filter(Boolean),
    hostName: (process.env.HOST || "").replace(/^https?:\/\//, ""),
    apiVersion: process.env.SHOPIFY_API_VERSION || LATEST_API_VERSION,
    isEmbeddedApp: true,
});

/* --------------------------------------------
   OAuth start
--------------------------------------------- */
router.get("/auth", async (req, res) => {
    try {
        const { shop } = req.query;
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
   OAuth callback
--------------------------------------------- */
router.get("/auth/callback", async (req, res) => {
    try {
        const session = await shopify.auth.callback({
            rawRequest: req,
            rawResponse: res,
        });

        // ✅ store what YOU need in express-session
        req.session.shop = session.shop;
        req.session.accessToken = session.accessToken;
        req.session.scope = session.scope;
        req.session.isOnline = session.isOnline || false;
        req.session.host = req.query.host || session.host || req.session.host;

        await new Promise((resolve, reject) =>
            req.session.save((err) => (err ? reject(err) : resolve()))
        );

        return res.redirect(`/frontend/?shop=${session.shop}&host=${req.session.host}`);
    } catch (err) {
        console.error("Auth callback error:", err);
        return res.status(500).json({ error: "OAuth callback failed" });
    }
});

/* --------------------------------------------
   Verify middleware
--------------------------------------------- */
export function verifyRequest(req, res, next) {
    const shop = req.query.shop || req.session?.shop;
    const accessToken = req.session?.accessToken;

    // Helpful logs while debugging
    console.log("VERIFY CHECK → shop:", shop, "hasToken:", Boolean(accessToken));

    if (!shop || !accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    req.shop = shop;
    next();
}

export default router;
