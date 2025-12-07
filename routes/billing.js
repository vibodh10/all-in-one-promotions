// routes/billing.js
import express from "express";
import { verifyRequest } from "../middleware/auth.js";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import database from "../utils/database.js";

const router = express.Router();

// ✅ Create Shopify instance once
const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES.split(","),
    hostName: process.env.HOST.replace(/https?:\/\//, ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
});

// Billing plans
const BILLING_PLANS = {
    free: {
        name: "Free",
        price: 0,
        features: { maxOffers: 1, analytics: "basic", customization: "basic", support: "community" },
    },
    growth: {
        name: "Growth",
        price: 19,
        features: { maxOffers: 10, analytics: "full", customization: "full", support: "email" },
    },
    pro: {
        name: "Pro",
        price: 49,
        features: {
            maxOffers: -1,
            analytics: "full",
            customization: "full",
            aiRecommendations: true,
            cartUpsells: true,
            support: "priority",
        },
    },
};

router.use(verifyRequest);

// ✅ GET /api/billing/plans
router.get("/plans", async (req, res) => {
    res.json({ success: true, data: BILLING_PLANS });
});

// ✅ GET /api/billing/current
router.get("/current", async (req, res) => {
    try {
        const shopId = req.session.shop;
        const subscription = await database.getSubscription(shopId);

        res.json({
            success: true,
            data:
                subscription || {
                    plan: "free",
                    status: "active",
                    startDate: new Date(),
                    features: BILLING_PLANS.free.features,
                },
        });
    } catch (error) {
        console.error("Error fetching subscription:", error);
        res.status(500).json({ success: false, error: "Failed to fetch subscription" });
    }
});

// ✅ POST /api/billing/subscribe
router.post("/subscribe", async (req, res) => {
    try {
        const { plan } = req.body;
        const session = req.session;

        if (!BILLING_PLANS[plan]) {
            return res.status(400).json({ success: false, error: "Invalid plan" });
        }

        if (plan === "free") {
            return res.json({ success: true, message: "Free plan activated", data: { plan: "free" } });
        }

        const planDetails = BILLING_PLANS[plan];
        const client = new shopify.rest.RestClient({ session });

        const response = await client.post({
            path: "recurring_application_charges",
            data: {
                recurring_application_charge: {
                    name: `Smart Offers & Bundles - ${planDetails.name}`,
                    price: planDetails.price,
                    return_url: `${process.env.APP_URL}/api/billing/callback?plan=${plan}`,
                    test: process.env.NODE_ENV !== "production",
                    trial_days: 7,
                },
            },
            type: "application/json",
        });

        const charge = response.body.recurring_application_charge;

        await database.savePendingCharge({
            shopId: session.shop,
            chargeId: charge.id,
            plan,
            status: "pending",
            confirmationUrl: charge.confirmation_url,
            createdAt: new Date(),
        });

        res.json({ success: true, data: { confirmationUrl: charge.confirmation_url } });
    } catch (error) {
        console.error("Error creating subscription:", error);
        res.status(500).json({ success: false, error: "Failed to create subscription" });
    }
});

// ✅ GET /api/billing/callback
router.get("/callback", async (req, res) => {
    try {
        const { charge_id, plan } = req.query;
        const session = req.session;
        if (!charge_id) return res.redirect("/?error=missing_charge_id");

        const client = new shopify.rest.RestClient({ session });

        const activate = await client.post({
            path: `recurring_application_charges/${charge_id}/activate`,
            type: "application/json",
        });

        const charge = activate.body.recurring_application_charge;
        if (charge.status !== "active") return res.redirect("/?error=not_active");

        await database.saveSubscription({
            shopId: session.shop,
            plan,
            chargeId: charge.id,
            status: "active",
            price: charge.price,
            startDate: new Date(),
            billingOn: charge.billing_on,
            trialEndsOn: charge.trial_ends_on,
            features: BILLING_PLANS[plan].features,
        });

        res.redirect("/?subscription=success");
    } catch (error) {
        console.error("Error activating subscription:", error);
        res.redirect("/?error=activation_failed");
    }
});

// ✅ POST /api/billing/cancel
router.post("/cancel", async (req, res) => {
    try {
        const session = req.session;
        const subscription = await database.getSubscription(session.shop);

        if (!subscription || subscription.plan === "free") {
            return res.status(400).json({ success: false, error: "No active subscription" });
        }

        const client = new shopify.rest.RestClient({ session });
        await client.delete({ path: `recurring_application_charges/${subscription.chargeId}` });

        await database.saveSubscription({
            shopId: session.shop,
            plan: "free",
            status: "cancelled",
            cancelledAt: new Date(),
            features: BILLING_PLANS.free.features,
        });

        res.json({ success: true, message: "Subscription cancelled" });
    } catch (error) {
        console.error("Error cancelling subscription:", error);
        res.status(500).json({ success: false, error: "Failed to cancel subscription" });
    }
});

export default router;
export { BILLING_PLANS };
