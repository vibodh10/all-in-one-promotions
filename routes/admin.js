// routes/admin.js
import express from "express";
import pool from "../utils/db.js";
import { verifyRequest, shopify } from "../middleware/auth.js";
import { getValidOfflineAccessToken } from "../utils/tokenManager.js";

const router = express.Router();

const TOKEN_EXCHANGE_GRANT =
    "urn:ietf:params:oauth:grant-type:token-exchange";
const SUBJECT_TOKEN_TYPE =
    "urn:ietf:params:oauth:token-type:id_token";
const OFFLINE_TOKEN_TYPE =
    "urn:shopify:params:oauth:token-type:offline-access-token";

// Keep the first migration restricted to the test store.
// Set TOKEN_MIGRATION_ALLOWED_SHOP in Render when you are ready to test
// another store or remove this check when the migration is ready for rollout.
const ALLOWED_MIGRATION_SHOP =
    process.env.TOKEN_MIGRATION_ALLOWED_SHOP ||
    "freshstartdevelopment.myshopify.com";

router.use(verifyRequest);

function addSeconds(seconds) {
    const parsedSeconds = Number(seconds);

    if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
        throw new Error(`Invalid Shopify token expiry value: ${seconds}`);
    }

    return new Date(Date.now() + parsedSeconds * 1000);
}

function getBearerToken(req) {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.toLowerCase().startsWith("bearer ")) {
        return null;
    }

    return authHeader.slice(7).trim() || null;
}

function migrationAllowedForShop(shop) {
    return true;
}

export default router;
