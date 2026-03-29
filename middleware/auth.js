// middleware/auth.js
import express from "express";
import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import database from "../utils/database.js";
import pool from "../utils/db.js";

const router = express.Router();

/**
 * One single Shopify API instance (ONLY here).
 * Do NOT create another instance elsewhere.
 */

export const shopify = shopifyApi({
    apiKey: process.env.VITE_SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SHOPIFY_SCOPES || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
    hostName: (process.env.HOST || "").replace(/https?:\/\//, ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
});

async function registerWebhooks(session) {
    const client = new shopify.clients.Rest({ session });

    try {
        console.log("🔁 Registering webhooks for:", session.shop);

        await client.post({
            path: "webhooks",
            data: {
                webhook: {
                    topic: "app/uninstalled",
                    address: `${process.env.HOST}/api/webhooks/app/uninstalled`,
                    format: "json",
                },
            },
        });

        console.log("✅ Webhook registered: APP_UNINSTALLED");

    } catch (err) {
        console.error("❌ Webhook registration failed:", err?.response?.body || err);
    }
}

/**
 * Start OAuth
 */
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
        res.status(500).json({ error: "Failed to start OAuth" });
    }
});

/**
 * OAuth callback
 * ✅ Store token in Postgres (Neon) instead of relying on cookies.
 */
router.get("/auth/callback", async (req, res) => {
    try {
        console.log("CALLBACK HIT");

        const callbackResponse = await shopify.auth.callback({
            rawRequest: req,
            rawResponse: res,
        });

        const session = callbackResponse.session;

        console.log("Session shop:", session?.shop);
        console.log("Session token:", session?.accessToken);

        if (!session?.shop || !session?.accessToken) {
            throw new Error("Session missing shop or accessToken");
        }

        const host = req.query.host;

        await pool.query(
            `
                insert into shop_tokens (shop, access_token, scope, updated_at)
                values ($1, $2, $3, now())
                    on conflict (shop)
            do update set access_token = excluded.access_token,
                                       scope = excluded.scope,
                                       updated_at = now()
            `,
            [session.shop, session.accessToken, session.scope || null]
        );

        await pool.query(
            `
              INSERT INTO shops (shop, plan)
              VALUES ($1, 'grandfathered')
              ON CONFLICT (shop) DO NOTHING
            `,
            [session.shop]
        );

        // AFTER saving token
        await registerWebhooks(session);

        return res.redirect(
            `/frontend/?shop=${encodeURIComponent(session.shop)}&host=${encodeURIComponent(host)}`
        );

    } catch (err) {
        console.error("Auth callback error:", err);
        res.status(500).json({ error: "OAuth callback failed" });
    }
});

/**
 * Verify middleware for API routes
 * ✅ Reads access token from DB every time.
 */
export async function verifyRequest(req, res, next) {
    try {
        const shop =
            req.query.shop ||
            req.headers["x-shopify-shop-domain"];

        if (!shop) {
            return res.status(401).send("Missing shop");
        }

        const shopRecord = await database.getShopByDomain(shop);

        if (!shopRecord || !shopRecord.access_token) {
            console.log("⚠️ No token found, redirecting to auth:", shop);
            return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
        }

        req.shop = shop;
        req.accessToken = shopRecord.access_token;

        next();
    } catch (error) {
        console.error("Verify error:", error);
        res.status(500).send("Auth error");
    }
}

export default router;
