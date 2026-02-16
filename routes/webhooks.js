import express from "express";
import { verifyWebhook } from "../middleware/auth.js";

const router = express.Router();

// NOTE: index.js mounts this router with express.raw({type:'application/json'})
router.post("/app/uninstalled", verifyWebhook, async (req, res) => {
    try {
        // req.body is Buffer (raw)
        // You can parse if you need: JSON.parse(req.body.toString("utf8"))
        console.log("✅ Webhook received: APP_UNINSTALLED");
        res.status(200).send("OK");
    } catch (err) {
        console.error("Webhook handler error:", err);
        res.status(500).send("Error");
    }
});

export default router;
