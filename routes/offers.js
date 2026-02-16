import express from 'express';
const router = express.Router();

import { loadCurrentSession } from '@shopify/shopify-api';

import { verifyRequest } from '../middleware/auth.js';
import Offer from '../models/Offer.js';
import database from '../utils/database.js';
import * as shopifyFunctions from '../utils/shopifyFunctions.js';

// Apply authentication to all routes
router.use(verifyRequest);

/**
 * GET /api/offers
 * Get all offers for a shop
 */
router.get('/', async (req, res) => {
  try {
    const shopId = req.query.shop;
    const { status, type } = req.query;

    const filters = { shopId };
    if (status) filters.status = status;
    if (type) filters.type = type;

    const offers = await database.getOffers(filters);

    res.json({
      success: true,
      data: offers,
      count: offers.length
    });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch offers'
    });
  }
});

/**
 * GET /api/offers/:id
 * Get a single offer by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.query.shop;

    const offer = await database.getOfferById(id, shopId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    res.json({
      success: true,
      data: offer
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch offer'
    });
  }
});

/**
 * POST /api/offers
 * Create a new offer
 */
router.post('/', verifyRequest, async (req, res) => {
  console.log("BODY RECEIVED:", req.body);
  console.log("QUERY:", req.query);
  console.log("SESSION:", req.session);

  try {
    const shopId = req.query.shop;
    const offerData = {
      ...req.body,
      shopId
    };

    const offer = new Offer(offerData);

    // Validate offer
    const validation = offer.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Save to database
    const savedOffer = await database.createOffer(offer.toJSON());

    // Create Shopify discount if offer is active
    if (savedOffer.status === 'active') {
      const shopifySession = await loadCurrentSession(req, res, false);

      if (!shopifySession) {
        throw new Error("No Shopify session found");
      }

      await shopifyFunctions.createDiscount(shopifySession, savedOffer);
    }

    res.status(201).json({
      success: true,
      data: savedOffer,
      message: 'Offer created successfully'
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create offer'
    });
  }
});

/**
 * PUT /api/offers/:id
 * Update an existing offer
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.query.shop;
    const updates = req.body;

    // Get existing offer
    const existingOffer = await database.getOfferById(id, shopId);
    if (!existingOffer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    // Create updated offer
    const updatedData = {
      ...existingOffer,
      ...updates,
      updatedAt: new Date()
    };

    const offer = new Offer(updatedData);

    // Validate
    const validation = offer.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Save to database
    const savedOffer = await database.updateOffer(id, offer.toJSON());

    // Update Shopify discount
    await shopifyFunctions.updateDiscount(shopId, savedOffer);

    res.json({
      success: true,
      data: savedOffer,
      message: 'Offer updated successfully'
    });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update offer'
    });
  }
});

/**
 * DELETE /api/offers/:id
 * Delete an offer
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.query.shop;

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    // Delete Shopify discount
    await shopifyFunctions.deleteDiscount(shopId, offer);

    // Delete from database
    await database.deleteOffer(id, shopId);

    res.json({
      success: true,
      message: 'Offer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete offer'
    });
  }
});

/**
 * POST /api/offers/:id/duplicate
 * Duplicate an offer
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.query.shop;

    const originalOffer = await database.getOfferById(id, shopId);
    if (!originalOffer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    // Create duplicate
    const duplicateData = {
      ...originalOffer,
      id: null,
      name: `${originalOffer.name} (Copy)`,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const offer = new Offer(duplicateData);
    const savedOffer = await database.createOffer(offer.toJSON());

    res.status(201).json({
      success: true,
      data: savedOffer,
      message: 'Offer duplicated successfully'
    });
  } catch (error) {
    console.error('Error duplicating offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate offer'
    });
  }
});

/**
 * PATCH /api/offers/:id/status
 * Update offer status (activate, pause, etc.)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const shopId = req.query.shop;

    const validStatuses = ['draft', 'active', 'paused', 'scheduled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    // Update status
    const updatedOffer = await database.updateOffer(id, {
      ...offer,
      status,
      updatedAt: new Date()
    });

    // Handle Shopify discount based on status
    if (status === 'active') {
      await shopifyFunctions.createDiscount(shopId, updatedOffer);
    } else if (status === 'paused') {
      await shopifyFunctions.disableDiscount(shopId, updatedOffer);
    }

    res.json({
      success: true,
      data: updatedOffer,
      message: `Offer ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating offer status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update offer status'
    });
  }
});

/**
 * GET /api/offers/:id/preview
 * Get preview data for an offer
 */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const shopId = req.query.shop;

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    // Generate preview HTML
    const previewHTML = generateOfferPreview(offer);

    res.json({
      success: true,
      data: {
        offer,
        preview: previewHTML
      }
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview'
    });
  }
});

/**
 * Generate preview HTML for an offer
 */
function generateOfferPreview(offer) {
  // This would generate the actual widget HTML based on offer configuration
  return `
    <div class="smart-offer-widget" style="
      border: 1px solid ${offer.styling.primaryColor};
      padding: 16px;
      border-radius: ${offer.styling.borderRadius};
      font-family: ${offer.styling.fontFamily};
    ">
      <h3>${offer.name}</h3>
      <p>${offer.description}</p>
      <!-- Additional offer-specific content -->
    </div>
  `;
}

export default router;
