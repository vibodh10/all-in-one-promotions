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
    const { productId, startDate, endDate } = req.body;

    if (!productId || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    if (newStart >= newEnd) {
      return res.status(400).json({ error: "Start date must be before end date" });
    }

    // 🔥 Check for overlapping offers
    const overlapping = await db.query.offers.findFirst({
      where: (offers, { and, eq, lte, gte }) =>
          and(
              eq(offers.productId, productId),

              // overlap condition
              lte(offers.startDate, newEnd),
              gte(offers.endDate, newStart)
          )
    });

    if (overlapping) {
      return res.status(400).json({
        error: "An overlapping offer already exists for this product"
      });
    }

    const created = await db.insert(offers).values({
      productId,
      startDate: newStart,
      endDate: newEnd,
      ...req.body
    }).returning();

    res.status(201).json(created[0]);

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
    const { productId, startDate, endDate } = req.body;

    if (!productId || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newStart = new Date(startDate);
    const newEnd = new Date(endDate);

    if (newStart >= newEnd) {
      return res.status(400).json({ error: "Start date must be before end date" });
    }

    // 🔥 Check overlap but EXCLUDE current offer
    const overlapping = await db.query.offers.findFirst({
      where: (offers, { and, eq, lte, gte, ne }) =>
          and(
              eq(offers.productId, productId),
              ne(offers.id, Number(id)), // 👈 critical line

              lte(offers.startDate, newEnd),
              gte(offers.endDate, newStart)
          )
    });

    if (overlapping) {
      return res.status(400).json({
        error: "Another overlapping offer already exists"
      });
    }

    const updated = await db.update(offers)
        .set({
          productId,
          startDate: newStart,
          endDate: newEnd,
          ...req.body
        })
        .where(eq(offers.id, Number(id)))
        .returning();

    res.json(updated[0]);

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

export default router;
