import express from "express";
import pkg from "@shopify/shopify-api";
import * as billing from "../routes/billing.js";
import database from "../utils/database.js";

const { Shopify } = pkg;
const router = express.Router();

export async function verifyRequest(req, res, next) {
    try {
        const session = await Shopify.Utils.loadCurrentSession(req, res, true);
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.session = session;
        next();
    } catch (error) {
        console.error('Verification error:', error);
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

// Begin OAuth
router.get("/auth", async (req, res) => {
    try {
        const shop = req.query.shop;
        if (!shop) return res.status(400).send("Missing shop param");

        const authRoute = await Shopify.Auth.beginAuth(req, res, shop, "/auth/callback", false);
        return res.redirect(authRoute);
    } catch (err) {
        console.error("Auth start error:", err);
        return res.status(500).json({ error: "Failed to start OAuth" });
    }
});

// Handle OAuth callback
router.get("/auth/callback", async (req, res) => {
    console.log("🔥 Inside /auth/callback");

    try {
        const session = await Shopify.Auth.validateAuthCallback(req, res, req.query);

        // Save session data
        req.session.shop = session.shop;
        req.session.host = req.query.host || session.host;
        await new Promise((resolve, reject) =>
            req.session.save(err => (err ? reject(err) : resolve()))
        );
        console.log("✅ Saved session:", req.session);

        await createBillingCharge(session);

        return res.redirect(`/frontend/?shop=${req.session.shop}&host=${req.session.host}`);
    } catch (err) {
        console.error("Auth callback error:", err);
        return res.status(500).json({ error: "OAuth callback failed" });
    }
});

async function createBillingCharge(session) {
    // TODO: implement billing later
}

export default router;
