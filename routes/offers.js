// routes/offers.js
import express from "express";
const router = express.Router();

import { verifyRequest } from "../middleware/auth.js";
import Offer from "../models/Offer.js";
import database from "../utils/database.js";
import {
  createDiscount,
  updateDiscount,
  deleteDiscount,
  disableDiscount,
} from "../utils/shopifyFunctions.js";
import pool from "../utils/db.js";
import {camelize} from "../utils/camelize.js";

/* ======================================================
   STOREFRONT (App Proxy)
====================================================== */
router.get("/offers", async (req, res) => {
  const { productId, shop } = req.query;

  if (!productId || !shop) {
    return res.status(400).json({ error: "Missing productId or shop" });
  }

  const offers = await database.getOffersByProduct(productId, shop);
  res.json({ offers });
});

/* ======================================================
   GET ALL OFFERS
====================================================== */
router.get("/", verifyRequest, async (req, res) => {
  try {
    const shopId = req.shop;
    const { status, type } = req.query;

    const filters = { shopId };
    if (status) filters.status = status;
    if (type) filters.type = type;

    const offers = await database.getOffers(filters);

    res.json({
      success: true,
      data: camelize(offers),
      count: offers.length,
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
});

/* ======================================================
   DUPLICATE OFFER
====================================================== */
router.post("/:id/duplicate", async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const original = await database.getOfferById(id, shopId);

    if (!original) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const {
      id: _id,
      created_at,
      updated_at,
      impressions,
      clicks,
      conversions,
      revenue,
      ...rest
    } = original;

    const duplicatedOffer = {
      ...rest,
      shopId: shopId, // ✅ IMPORTANT
      name: `${original.name} (Copy)`,
      status: "draft"
    };

    const created = await database.createOffer(duplicatedOffer);

    res.json({
      success: true,
      data: created
    });

  } catch (err) {
    console.error("Duplicate offer error:", err);
    res.status(500).json({ error: "Failed to duplicate offer" });
  }
});

/* ======================================================
   GET SINGLE OFFER
====================================================== */
router.get("/:id", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    res.json({ success: true, data: camelize(offer) });
  } catch (error) {
    console.error("Error fetching offer:", error);
    res.status(500).json({ error: "Failed to fetch offer" });
  }
});

/* ======================================================
   CREATE OFFER
====================================================== */
router.post("/", verifyRequest, async (req, res) => {
  try {
    const shopId = req.shop;

    const offer = new Offer({
      ...req.body,
      shopId,
    });

    const validation = offer.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(", "),
      });
    }

    const created = await database.createOffer(offer.toJSON());

    // If active → create Shopify automatic discount
    if (created.status === "active") {
      const result = await createDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          created
      );

      await database.updateOffer(created.id, {
        shopify_discount_ids: result.automaticDiscountIds,
      });
    }

    const refreshed = await database.getOfferById(created.id, shopId);

    res.status(201).json({ success: true, data: refreshed });

  } catch (error) {
    console.error("POST offer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ======================================================
   UPDATE OFFER
====================================================== */
router.put("/:id", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const existing = await database.getOfferById(id, shopId);
    if (!existing) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const updatedOffer = new Offer({
      ...req.body,
      shopId,
      id,
    });

    const validation = updatedOffer.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(", "),
      });
    }

    const cleanData = {
      ...req.body,
      discount_value: Number(req.body.discountValue ?? req.body.discount_value ?? 0),

      bundle_config: req.body.bundleConfig || {},
      display_settings: req.body.displaySettings || {},
      styling: req.body.styling || {}
    };

    Object.keys(cleanData).forEach(k => {
      if (cleanData[k] === undefined) delete cleanData[k];
    });

    // 1️⃣ Save updated offer fields first
    const saved = await database.updateOffer(id, cleanData);

    /* ---------- ACTIVE ---------- */
    if (saved.status === "active") {

      let result;

      const hasDiscount =
          Array.isArray(saved.shopify_discount_ids) &&
          saved.shopify_discount_ids.length > 0;

      if (hasDiscount) {
        // 🔁 UPDATE = delete + recreate (your architecture)
        result = await updateDiscount(
            { shop: req.shop, accessToken: req.accessToken },
            saved
        );
      } else {
        // 🆕 CREATE fresh
        result = await createDiscount(
            { shop: req.shop, accessToken: req.accessToken },
            saved
        );
      }

      // ✅ ALWAYS overwrite DB with fresh IDs
      await database.updateOffer(id, {
        shopify_discount_ids: result.automaticDiscountIds,
      });
    }

    /* ---------- NOT ACTIVE ---------- */
    if (
        saved.status !== "active" &&
        Array.isArray(saved.shopify_discount_ids) &&
        saved.shopify_discount_ids.length > 0
    ) {
      await disableDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          saved.shopify_discount_ids
      );

      // 🔥 Clear IDs in DB to prevent stale delete later
      await database.updateOffer(id, {
        shopify_discount_ids: [],
      });
    }

    const refreshed = await database.getOfferById(id, shopId);

    res.json({ success: true, data: refreshed });

  } catch (error) {
    console.error("PUT offer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ======================================================
   PATCH STATUS
====================================================== */
router.patch("/:id/status", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const shopId = req.shop;

    if (!["active", "paused", "draft"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    /* Duplicate protection */
    if (status === "active") {
      const productIds = offer.products || [];

      for (const productId of productIds) {
        const conflicts = await pool.query(
            `
              SELECT id FROM offers
              WHERE shop_id = $1
                AND status = 'active'
                AND id != $2
                AND products @> $3::jsonb
            `,
            [shopId, id, JSON.stringify([productId])]
        );

        if (conflicts.rows.length > 0) {
          return res.status(400).json({
            error: "Another active offer exists for this product.",
          });
        }
      }
    }

    /* ACTIVATE */
    if (status === "active") {
      const result = await createDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          offer
      );

      await database.updateOffer(id, {
        status: "active",
        shopify_discount_ids: result.automaticDiscountIds,
      });
    }

    /* PAUSE */
    if (status === "paused" && offer.shopify_discount_ids?.length) {
      await disableDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          offer.shopify_discount_ids
      );
      await database.updateOffer(id, { status: "paused" });
    }

    /* DRAFT */
    if (status === "draft") {
      await database.updateOffer(id, { status: "draft" });
    }

    const updated = await database.getOfferById(id, shopId);

    res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

/* ======================================================
   DELETE OFFER
====================================================== */
router.delete("/:id", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const offer = await database.getOfferById(id, shopId);

    if (offer?.shopify_discount_ids?.length) {
      await deleteDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          offer.shopify_discount_ids
      );
    }

    await database.deleteOffer(id, shopId);

    res.json({ success: true });

  } catch (err) {
    console.error("Delete offer error:", err);
    res.status(500).json({ error: "Failed to delete offer" });
  }
});

export default router;