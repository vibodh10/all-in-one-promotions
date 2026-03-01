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

// Storefront offers (App Proxy)
router.get("/offers", async (req, res) => {
  const { productId, shop } = req.query;

  if (!productId || !shop) {
    return res.status(400).json({ error: "Missing productId or shop" });
  }

  const offers = await database.getOffersByProduct(productId, shop);

  res.json({ offers });
});

/**
 * GET /api/offers
 */
router.get("/", verifyRequest, async (req, res) => {
  try {
    const shopId = req.shop;

    const { status, type } = req.query;
    const filters = { shopId };
    if (status) filters.status = status;
    if (type) filters.type = type;

    const offers = await database.getOffers(filters);

    res.json({ success: true, data: offers, count: offers.length });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ success: false, error: "Failed to fetch offers" });
  }
});

/**
 * GET /api/offers/:id
 */
router.get("/:id", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Offer not found" });
    }

    res.json({ success: true, data: offer });
  } catch (error) {
    console.error("Error fetching offer:", error);
    res.status(500).json({ success: false, error: "Failed to fetch offer" });
  }
});

/**
 * POST /api/offers
 */
router.post("/", verifyRequest, async (req, res) => {
  try {
    const shopId = req.shop;

    const offer = new Offer({
      ...req.body,
      shopId
    });

    const validation = offer.validate();

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(", ")
      });
    }

    // 🚨 DUPLICATE ACTIVE OFFER CHECK
    // Only block if new offer is being created as ACTIVE
    if (offer.status === "active" && offer.products?.length > 0) {
      for (const productId of offer.products) {
        const conflicts = await database.getOffersByProduct(productId, shopId);

        if (conflicts.length > 0) {
          return res.status(400).json({
            error: "An active offer already exists for one or more selected products."
          });
        }
      }
    }

    const created = await database.createOffer(offer.toJSON());

    res.status(201).json({
      success: true,
      data: created
    });

  } catch (error) {
    console.error("POST offer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/offers/:id
 */
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
      id
    });

    const validation = updatedOffer.validate();

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(", ")
      });
    }

    const saved = await database.updateOffer(id, updatedOffer.toJSON());

    res.json({
      success: true,
      data: saved
    });

  } catch (error) {
    console.error("PUT offer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/offers/:id/status
 */
router.patch("/:id/status", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const shopId = req.shop;

    if (!["active", "paused", "draft"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // 🚨 If activating, check duplicates
    if (status === "active") {
      const offer = await database.getOfferById(id, shopId);

      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

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
            error: "Another active offer already exists for this product."
          });
        }
      }
    }

    const updated = await database.updateOffer(id, { status });

    res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.delete("/:id", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    await database.deleteOffer(id, shopId);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete offer error:", err);
    res.status(500).json({ error: "Failed to delete offer" });
  }
});

/**
 * GET /api/offers/active-for-product/:productId
 * Returns active offers for a specific product
 */
router.get("/active-for-product/:productId", verifyRequest, async (req, res) => {
  try {
    const shopId = req.shop;
    const { productId } = req.params;

    // Get all offers for shop that include this product
    const offers = await database.getOffersByProduct(productId, shopId);

    const activeOffers = offers.filter(o => {
      const offer = new Offer(o);

      // Only return active offers
      if (offer.status !== "active") return false;

      // Check schedule + targeting logic
      return offer.shouldDisplay([{ productId }]);
    });

    res.json({ success: true, data: activeOffers });

  } catch (err) {
    console.error("Error fetching active offers:", err);
    res.status(500).json({ error: "Failed to fetch offers" });
  }
});

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

export default router;
