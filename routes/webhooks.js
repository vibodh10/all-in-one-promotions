import express from "express";
import crypto from "crypto";

const router = express.Router();

/**
 * Verify Shopify webhook HMAC using the raw request body
 */
function verifyWebhook(req, res, next) {
    try {
        const hmac = req.get("X-Shopify-Hmac-Sha256");
        const digest = crypto
            .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
            .update(req.body, "utf8")
            .digest("base64");

        if (!hmac || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac))) {
            console.error("❌ Invalid webhook signature");
            return res.status(401).send("Invalid webhook signature");
        }

        next();
    } catch (err) {
        console.error("Webhook verification error:", err);
        res.status(401).send("Webhook verification failed");
    }
}

/**
 * APP_UNINSTALLED
 * Shopify sends this when the merchant removes your app
 */
router.post("/app/uninstalled", verifyWebhook, async (req, res) => {
    try {
        const payload = JSON.parse(req.body.toString("utf8"));

        console.log("✅ Webhook received: APP_UNINSTALLED");
        console.log(payload);

        // TODO: delete shop token / data from DB if needed

        res.status(200).send("OK");
    } catch (err) {
        console.error("Webhook handler error:", err);
        res.status(500).send("Error");
    }
});

/**
 * GDPR: Customer data request
 */
router.post("/customers/data_request", verifyWebhook, async (req, res) => {
    try {
        const payload = JSON.parse(req.body.toString("utf8"));

        console.log("📩 GDPR webhook: CUSTOMERS_DATA_REQUEST");
        console.log(payload);

        res.status(200).send("OK");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("Error");
    }
});

/**
 * GDPR: Customer data deletion
 */
router.post("/customers/redact", verifyWebhook, async (req, res) => {
    try {
        const payload = JSON.parse(req.body.toString("utf8"));

        console.log("📩 GDPR webhook: CUSTOMERS_REDACT");
        console.log(payload);

        res.status(200).send("OK");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("Error");
    }
});

/**
 * GDPR: Shop data deletion
 */
router.post("/shop/redact", verifyWebhook, async (req, res) => {
    try {
        const payload = JSON.parse(req.body.toString("utf8"));

        console.log("📩 GDPR webhook: SHOP_REDACT");
        console.log(payload);

        // TODO: delete shop data from DB if stored

        res.status(200).send("OK");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("Error");
    }
});

export default router;