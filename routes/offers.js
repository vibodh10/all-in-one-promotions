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

// 🔒 All routes protected
router.use(verifyRequest);

/**
 * GET /api/offers
 */
router.get("/", async (req, res) => {
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
router.get("/:id", async (req, res) => {
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
router.post("/", async (req, res) => {
  try {
    const shopId = req.shop;

    const offer = new Offer({
      ...req.body,
      shopId
    });

    const validation = offer.validate();
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(", ") });
    }

    const overlap = await database.hasOverlappingOffer(
        shopId,
        offer.products,
        offer.schedule
    );

    if (overlap) {
      return res.status(400).json({
        error: "An overlapping offer already exists for one or more selected products"
      });
    }

    const created = await database.createOffer(offer.toJSON());

    res.status(201).json({ success: true, data: created });

  } catch (error) {
    console.error("POST offer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/offers/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const existing = await database.getOfferById(id, shopId);
    if (!existing) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const updatedOffer = new Offer({
      ...existing,
      ...req.body,
      shopId
    });

    const validation = updatedOffer.validate();
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(", ") });
    }

    const overlap = await database.hasOverlappingOffer(
        shopId,
        updatedOffer.products,
        updatedOffer.schedule,
        id
    );

    if (overlap) {
      return res.status(400).json({
        error: "Another overlapping offer already exists"
      });
    }

    const saved = await database.updateOffer(id, updatedOffer.toJSON());

    res.json({ success: true, data: saved });

  } catch (error) {
    console.error("PUT offer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/offers/:id/status
 */
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const shopId = req.shop;

    const validStatuses = ["draft", "active", "paused", "scheduled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Offer not found" });
    }

    const updatedOffer = await database.updateOffer(id, {
      ...offer,
      status,
      updatedAt: new Date(),
    });

    if (status === "active") {
      const disc = await createDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          updatedOffer
      );

      await database.updateOffer(updatedOffer.id, {
        ...updatedOffer,
        shopifyDiscountId: disc.priceRuleId,
        shopifyDiscountCode: disc.discountCode,
        updatedAt: new Date(),
      });
    } else if (status === "paused") {
      await disableDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          updatedOffer
      );
    }

    res.json({
      success: true,
      data: updatedOffer,
      message: `Offer ${status} successfully`,
    });
  } catch (error) {
    console.error("Error updating offer status:", error);
    res.status(500).json({ success: false, error: "Failed to update offer status" });
  }
});

/**
 * GET /api/offers/active-for-product/:productId
 * Returns active offers for a specific product
 */
router.get("/active-for-product/:productId", async (req, res) => {
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

export default router;
