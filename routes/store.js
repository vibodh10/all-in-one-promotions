import express from "express";
import { verifyRequest } from "../middleware/auth.js";
import { getStoreDefaults } from "../utils/shopifyStore.js";
import { shopifyGraphQL } from "../utils/shopifyFunctions.js";

const router = express.Router();

router.get("/defaults", verifyRequest, async (req, res) => {
    try {

        const defaults = await getStoreDefaults(
            req.shop,
            req.accessToken,
            shopifyGraphQL
        );

        res.json(defaults);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load store defaults" });
    }
});

export default router;