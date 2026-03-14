import express from "express";
import database from "../utils/database.js";

const router = express.Router();

router.post("/event", async (req, res) => {
    try {

        const { eventName, offerId, metadata, shop } = req.body;

        if (!eventName || !shop) {
            return res.status(400).json({ error: "Missing eventName or shop" });
        }

        await database.saveAnalyticsEvent({
            eventName,
            offerId,
            metadata,
            shopId: shop
        });

        res.json({ success: true });

    } catch (err) {
        console.error("Storefront analytics error:", err);
        res.status(500).json({ error: "Analytics failed" });
    }
});

export default router;