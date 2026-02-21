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

    const offerData = {
      ...req.body,
      shopId,
    };

    const offer = new Offer(offerData);

    const validation = offer.validate();
    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const savedOffer = await database.createOffer(offer.toJSON());

    // 🚀 If active → create Shopify discount
    if (savedOffer.status === "active") {
      const disc = await createDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          savedOffer
      );

      const updated = await database.updateOffer(savedOffer.id, {
        shopifyDiscountId: disc.priceRuleId,
        shopifyDiscountCode: disc.discountCode,
      });

      return res.status(201).json({
        success: true,
        data: updated,
        message: "Offer created successfully",
      });
    }

    return res.status(201).json({
      success: true,
      data: savedOffer,
      message: "Offer created successfully",
    });
  } catch (error) {
    console.error("Error creating offer:", error);
    res.status(500).json({ success: false, error: "Failed to create offer" });
  }
});

/**
 * PUT /api/offers/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const existingOffer = await database.getOfferById(id, shopId);
    if (!existingOffer) {
      return res.status(404).json({ success: false, error: "Offer not found" });
    }

    const updatedData = {
      ...existingOffer,
      ...req.body,
      shopId,
      updatedAt: new Date(),
    };

    const offer = new Offer(updatedData);

    const validation = offer.validate();
    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors });
    }

    const savedOffer = await database.updateOffer(id, offer.toJSON());

    if (savedOffer.status === "active") {
      const disc = await updateDiscount(
          { shop: req.shop, accessToken: req.accessToken },
          savedOffer
      );

      const updated = await database.updateOffer(savedOffer.id, {
        ...savedOffer,
        shopifyDiscountId: disc.priceRuleId,
        shopifyDiscountCode: disc.discountCode,
        updatedAt: new Date(),
      });

      return res.json({
        success: true,
        data: updated,
        message: "Offer updated successfully",
      });
    }

    res.json({
      success: true,
      data: savedOffer,
      message: "Offer updated successfully",
    });
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(500).json({ success: false, error: "Failed to update offer" });
  }
});

/**
 * DELETE /api/offers/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({ success: false, error: "Offer not found" });
    }

    await deleteDiscount(
        { shop: req.shop, accessToken: req.accessToken },
        offer
    );

    await database.deleteOffer(id, shopId);

    res.json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(500).json({ success: false, error: "Failed to delete offer" });
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

export default router;
