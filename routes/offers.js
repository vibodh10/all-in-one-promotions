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
import { camelize } from "../utils/camelize.js";
import { sendEmail } from "../utils/email.js";

/* ================================
   TOKEN HELPER (CRITICAL FIX)
================================ */
export async function getAccessToken(shop) {
  const result = await pool.query(
      "SELECT access_token FROM shop_tokens WHERE shop = $1",
      [shop]
  );
  return result.rows[0]?.access_token;
}

/* ================================
   SETTINGS
================================ */
async function getShopSettings(shop) {
  const result = await pool.query(
      `SELECT contact_email, email_notifications, weekly_reports
     FROM shop_settings
     WHERE shop_id = $1`,
      [shop]
  );
  return result.rows[0];
}

/* ======================================================
   STOREFRONT (App Proxy)
====================================================== */
router.get("/offers", async (req, res) => {
  const { productId, shop } = req.query;

  if (!productId || !shop) {
    return res.status(400).json({ error: "Missing productId or shop" });
  }

  try {
    const allOffers = await database.getOffers({
      shopId: shop,
      status: "active"
    });

    function sameId(a, b) {
      return a === b || a?.split("/").pop() === b?.split("/").pop();
    }

    const offers = allOffers.filter(o => {

      const mode = o.targeting?.mode || "specific_products";

      // ✅ ALL PRODUCTS
      if (mode === "all") return true;

      // ✅ ALL EXCEPT PRODUCTS
      if (mode === "all_except_products") {
        return !o.targeting?.excludeProducts?.some(p => sameId(p, productId));
      }

      // ✅ SPECIFIC PRODUCTS
      return o.products?.some(p => sameId(p, productId));
    });

    const settingsResult = await pool.query(
        `SELECT show_branding, enable_animations
         FROM shop_settings
         WHERE shop_id = $1`,
        [shop]
    );

    const settings = settingsResult.rows[0] || {};

    res.json({ offers, settings });
  } catch (err) {
    console.error("Error fetching offers:", err);
    res.status(500).json({ error: "Failed to load offers" });
  }
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
router.post("/:id/duplicate", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.shop;

    const original = await database.getOfferById(id, shopId);
    if (!original) {
      return res.status(404).json({ error: "Offer not found" });
    }

    const { id: _id, created_at, updated_at, impressions, clicks, conversions, revenue, ...rest } = original;

    const duplicatedOffer = {
      ...rest,
      shopId: shopId,
      name: `${original.name} (Copy)`,
      status: "draft",

      type: original.type,
      discountType: original.discountType || original.type,
      discountValue: original.discountValue ?? original.discount_value ?? 0
    };

    const created = await database.createOffer(duplicatedOffer);

    res.json({ success: true, data: created });
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
    const shop = req.shop;
    const accessToken = await getAccessToken(shop);

    console.log("SHOP:", shop);
    console.log("TOKEN FROM DB:", accessToken);

    if (!accessToken) {
      return res.status(401).json({ error: "Shop not authenticated" });
    }

    const offer = new Offer({ ...req.body, shopId: shop });

    const validation = offer.validate();
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors.join(", ") });
    }

    const offerData = offer.toJSON();

    /* ============================================
       🔥 OVERLAP CHECK (BEFORE INSERT)
    ============================================ */
    if (offerData.status === "active") {
      const activeOffers = await database.getOffers({
        shopId: shop,
        status: "active"
      });

      function sameId(a, b) {
        return a === b || a?.split("/").pop() === b?.split("/").pop();
      }

      function overlaps(listA = [], listB = []) {
        return listA.some(a => listB.some(b => sameId(a, b)));
      }

      const hasConflict = activeOffers.some(o => {

        const modeA = o.targeting?.mode || "specific_products";
        const modeB = offerData.targeting?.mode || "specific_products";

        const productsA = o.products || [];
        const productsB = offerData.products || [];

        const excludeA = o.targeting?.excludeProducts || [];
        const excludeB = offerData.targeting?.excludeProducts || [];

        // 🔥 ALL vs anything
        if (modeA === "all" || modeB === "all") return true;

        // 🔥 ALL EXCEPT vs ALL EXCEPT
        if (modeA === "all_except_products" && modeB === "all_except_products") {
          return true;
        }

        // 🔥 ALL EXCEPT (A) vs SPECIFIC (B)
        if (modeA === "all_except_products" && modeB === "specific_products") {
          return productsB.some(p =>
              !excludeA.some(ex => sameId(ex, p))
          );
        }

        // 🔥 ALL EXCEPT (B) vs SPECIFIC (A)
        if (modeB === "all_except_products" && modeA === "specific_products") {
          return productsA.some(p =>
              !excludeB.some(ex => sameId(ex, p))
          );
        }

        // ✅ SPECIFIC vs SPECIFIC
        return overlaps(productsA, productsB);
      });

      if (hasConflict) {
        return res.status(400).json({
          error: "Another active offer exists for this product."
        });
      }
    }

    /* ============================================
       ✅ SAFE TO INSERT
    ============================================ */
    const created = await database.createOffer(offerData);

    /* ============================================
       🚀 CREATE SHOPIFY DISCOUNT
    ============================================ */
    if (created.status === "active") {
      const result = await createDiscount({ shop, accessToken }, created);

      await database.updateOffer(created.id, {
        shopify_discount_ids: result.automaticDiscountIds,
      });

      const settings = await getShopSettings(shop);

      if (settings?.email_notifications && settings?.contact_email) {
        const offerName = created.name || "Your offer";

        await sendEmail(
            settings.contact_email,
            "Your offer is now live",
            `<h2>Your offer is now active</h2>
           <p><strong>${offerName}</strong> is now live in your store.</p>`
        );
      }
    }

    const refreshed = await database.getOfferById(created.id, shop);

    res.status(201).json({
      success: true,
      data: refreshed
    });

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
    const shop = req.shop;
    const accessToken = await getAccessToken(shop);

    const existing = await database.getOfferById(id, shop);
    if (!existing) return res.status(404).json({ error: "Offer not found" });

    const saved = await database.updateOffer(id, req.body);

    if (saved.status === "active") {
      const result = await updateDiscount({ shop, accessToken }, saved);

      await database.updateOffer(id, {
        shopify_discount_ids: result.automaticDiscountIds,
      });
    }

    const refreshed = await database.getOfferById(id, shop);
    res.json({ success: true, data: refreshed });

  } catch (error) {
    console.error("PUT offer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ======================================================
   STATUS
====================================================== */
router.patch("/:id/status", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const shop = req.shop;
    const accessToken = await getAccessToken(shop);

    const offer = await database.getOfferById(id, shop);
    if (!offer) return res.status(404).json({ error: "Offer not found" });

    /* 🚨 ADD THIS BLOCK */
    if (status === "active") {

      const activeOffers = await database.getOffers({
        shopId: shop,
        status: "active"
      });

      function sameId(a, b) {
        return a === b || a?.split("/").pop() === b?.split("/").pop();
      }

      function overlaps(listA = [], listB = []) {
        return listA.some(a => listB.some(b => sameId(a, b)));
      }

      const hasConflict = activeOffers.some(o => {

        if (o.id === id) return false;

        const modeA = o.targeting?.mode || "specific_products";
        const modeB = offer.targeting?.mode || "specific_products";

        const productsA = o.products || [];
        const productsB = offer.products || [];

        const excludeA = o.targeting?.excludeProducts || [];
        const excludeB = offer.targeting?.excludeProducts || [];

        // 🔥 ALL vs anything → always conflict
        if (modeA === "all" || modeB === "all") {
          return true;
        }

        // 🔥 ALL EXCEPT vs ALL EXCEPT
        if (modeA === "all_except_products" && modeB === "all_except_products") {
          // conflict unless both exclude the same full set (rare case)
          return true;
        }

        // 🔥 ALL EXCEPT (A) vs SPECIFIC (B)
        if (modeA === "all_except_products" && modeB === "specific_products") {
          // conflict if B includes ANY product NOT excluded by A
          return productsB.some(p =>
              !excludeA.some(ex => sameId(ex, p))
          );
        }

        // 🔥 ALL EXCEPT (B) vs SPECIFIC (A)
        if (modeB === "all_except_products" && modeA === "specific_products") {
          return productsA.some(p =>
              !excludeB.some(ex => sameId(ex, p))
          );
        }

        // ✅ SPECIFIC vs SPECIFIC
        return overlaps(productsA, productsB);
      });

      if (hasConflict) {
        return res.status(400).json({
          error: "Another active offer exists for this product."
        });
      }
    }

    /* ✅ EXISTING LOGIC */
    if (status === "active") {
      const result = await createDiscount({ shop, accessToken }, offer);

      await database.updateOffer(id, {
        status,
        shopify_discount_ids: result.automaticDiscountIds,
      });
    }

    if (status === "paused") {
      await disableDiscount({ shop, accessToken }, offer.shopify_discount_ids);
      await database.updateOffer(id, { status });
    }

    const updated = await database.getOfferById(id, shop);
    res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

/* ======================================================
   DELETE
====================================================== */
router.delete("/:id", verifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const shop = req.shop;
    const accessToken = await getAccessToken(shop);

    const offer = await database.getOfferById(id, shop);

    if (offer?.shopify_discount_ids?.length) {
      await deleteDiscount({ shop, accessToken }, offer.shopify_discount_ids);
    }

    await database.deleteOffer(id, shop);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete offer error:", err);
    res.status(500).json({ error: "Failed to delete offer" });
  }
});

export default router;