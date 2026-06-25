// middleware/auth.js
import dotenv from "dotenv";
dotenv.config();

console.log("AUTH SCOPES =", process.env.SHOPIFY_SCOPES);
console.log("AUTH RESEND =", process.env.RESEND_API_KEY ? "FOUND" : "MISSING");

import express from "express";
import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import pool from "../utils/db.js";
import {
    getValidOfflineAccessToken,
} from "../utils/tokenManager.js";

const router = express.Router();

/**
 * One single Shopify API instance (ONLY here).
 * Do NOT create another instance elsewhere.
 */

const scopes = (
    process.env.SHOPIFY_SCOPES
)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// export const shopify = shopifyApi({
//     apiKey: "YOUR_API_KEY",
//     apiSecretKey: "YOUR_SECRET",
//     scopes: [
//         "write_products",
//         "read_products",
//         "write_discounts",
//         "read_discounts"
//     ],
//     hostName: "your-tunnel.trycloudflare.com",
//     apiVersion: LATEST_API_VERSION,
//     isEmbeddedApp: true,
// });
console.log(scopes);

export const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes,
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
                    address: `${process.env.APP_URL}/api/webhooks/app/uninstalled`,
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
        console.log("AUTH CALLBACK HIT");

        const callbackResponse =
            await shopify.auth.callback({
                rawRequest: req,
                rawResponse: res,
            });

        const session = callbackResponse.session;
        const shop = session?.shop;
        const oldAccessToken = session?.accessToken;

        if (!shop) {
            throw new Error(
                "Missing shop from Shopify auth callback"
            );
        }

        if (!oldAccessToken) {
            throw new Error(
                "Missing offline access token from Shopify auth callback"
            );
        }

        console.log(
            "OAuth offline token received for:",
            shop
        );

        /*
         * Exchange the OAuth token immediately for an
         * expiring offline access/refresh-token pair.
         */
        const exchanged =
            await exchangeOfflineToken({
                shop,
                oldAccessToken,
            });

        console.log(
            "Expiring offline token created for:",
            shop
        );

        await pool.query(
            `
                INSERT INTO shop_tokens (
                    shop,
                    access_token,
                    refresh_token,
                    scope,
                    access_token_expires_at,
                    refresh_token_expires_at,
                    token_type,
                    migrated_at,
                    updated_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    'expiring_offline',
                    now(),
                    now()
                )
                ON CONFLICT (shop)
                DO UPDATE SET
                    access_token =
                        EXCLUDED.access_token,
                    refresh_token =
                        EXCLUDED.refresh_token,
                    scope =
                        EXCLUDED.scope,
                    access_token_expires_at =
                        EXCLUDED.access_token_expires_at,
                    refresh_token_expires_at =
                        EXCLUDED.refresh_token_expires_at,
                    token_type =
                        'expiring_offline',
                    migrated_at =
                        now(),
                    updated_at =
                        now()
            `,
            [
                shop,
                exchanged.accessToken,
                exchanged.refreshToken,
                exchanged.scope ||
                session.scope ||
                null,
                exchanged.accessTokenExpiresAt,
                exchanged.refreshTokenExpiresAt,
            ]
        );

        await pool.query(
            `
                INSERT INTO shops (
                    shop,
                    isGrandfathered
                )
                VALUES ($1, true)
                ON CONFLICT (shop)
                DO NOTHING
            `,
            [shop]
        );

        /*
         * registerWebhooks expects a Shopify session object.
         * Replace the callback's old token with the newly
         * exchanged expiring access token.
         */
        session.accessToken =
            exchanged.accessToken;
        session.expires =
            exchanged.accessTokenExpiresAt;

        await registerWebhooks(session);

        const host = req.query.host;

        return res.redirect(
            `/frontend/?shop=${encodeURIComponent(shop)}` +
            `&host=${encodeURIComponent(host || "")}`
        );
    } catch (error) {
        console.error(
            "Auth callback failed:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "OAuth callback failed",
        });
    }
});

/**
 * Verify middleware for API routes
 * ✅ Reads access token from DB every time.
 */
export async function verifyRequest(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).send("Missing Authorization header");
        }

        if (
            !authHeader ||
            !authHeader.toLowerCase().startsWith("bearer ")
        ) {
            return res.status(401).json({
                success: false,
                error: "Missing Authorization header",
            });
        }

        const token = authHeader.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Missing Shopify session token",
            });
        }

        // ✅ Decode and verify session token
        const decoded = await shopify.session.decodeSessionToken(token);

        // Extract shop domain
        const shop = decoded.dest.replace("https://", "");

        // 🔑 Get offline access token from DB (your existing system)
        const accessToken = await getValidOfflineAccessToken(shop);

        req.shop = shop;
        req.accessToken = accessToken;
        req.sessionToken = token;
        req.sessionTokenPayload = decoded;

        next();
    } catch (error) {
        console.error("Verify error:", error);
        res.status(401).send("Invalid session token");
    }
}

export default router;
