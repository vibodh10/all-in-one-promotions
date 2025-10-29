import express from 'express';
const router = express.Router();

import { verifyRequest } from '../middleware/auth.js';
import { Shopify } from '@shopify/shopify-api';

// Billing plans configuration
const BILLING_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      maxOffers: 1,
      analytics: 'basic',
      customization: 'basic',
      support: 'community'
    }
  },
  growth: {
    name: 'Growth',
    price: 19,
    features: {
      maxOffers: 10,
      analytics: 'full',
      customization: 'full',
      support: 'email'
    }
  },
  pro: {
    name: 'Pro',
    price: 49,
    features: {
      maxOffers: -1, // unlimited
      analytics: 'full',
      customization: 'full',
      aiRecommendations: true,
      cartUpsells: true,
      support: 'priority'
    }
  }
};

// Apply authentication to all routes
router.use(verifyRequest);

/**
 * GET /api/billing/plans
 * Get available billing plans
 */
router.get('/plans', async (req, res) => {
  try {
    res.json({
      success: true,
      data: BILLING_PLANS
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing plans'
    });
  }
});

/**
 * GET /api/billing/current
 * Get current subscription for shop
 */
router.get('/current', async (req, res) => {
  try {
    const shopId = req.session.shop;
    const db = require('../utils/database');
    
    const subscription = await db.getSubscription(shopId);

    res.json({
      success: true,
      data: subscription || {
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        features: BILLING_PLANS.free.features
      }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription'
    });
  }
});

/**
 * POST /api/billing/subscribe
 * Create a new subscription
 */
router.post('/subscribe', async (req, res) => {
  try {
    const { plan } = req.body;
    const session = req.session;

    if (!BILLING_PLANS[plan]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan selected'
      });
    }

    // Don't create charge for free plan
    if (plan === 'free') {
      return res.json({
        success: true,
        message: 'Free plan activated',
        data: { plan: 'free' }
      });
    }

    const planDetails = BILLING_PLANS[plan];

    // Create recurring application charge
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
    
    const response = await client.post({
      path: 'recurring_application_charges',
      data: {
        recurring_application_charge: {
          name: `Smart Offers & Bundles - ${planDetails.name}`,
          price: planDetails.price,
          return_url: `${process.env.APP_URL}/billing/callback?plan=${plan}`,
          test: process.env.NODE_ENV !== 'production',
          trial_days: 7
        }
      },
      type: Shopify.DataType.JSON
    });

    const charge = response.body.recurring_application_charge;

    // Save pending charge to database
    const db = require('../utils/database');
    await db.savePendingCharge({
      shopId: session.shop,
      chargeId: charge.id,
      plan,
      status: 'pending',
      confirmationUrl: charge.confirmation_url,
      createdAt: new Date()
    });

    res.json({
      success: true,
      data: {
        confirmationUrl: charge.confirmation_url,
        chargeId: charge.id
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription'
    });
  }
});

/**
 * GET /api/billing/callback
 * Handle subscription callback from Shopify
 */
router.get('/callback', async (req, res) => {
  try {
    const { charge_id, plan } = req.query;
    const session = req.session;

    if (!charge_id) {
      return res.redirect('/?error=missing_charge_id');
    }

    // Activate the charge
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
    
    const activateResponse = await client.post({
      path: `recurring_application_charges/${charge_id}/activate`,
      type: Shopify.DataType.JSON
    });

    const charge = activateResponse.body.recurring_application_charge;

    if (charge.status !== 'active') {
      return res.redirect('/?error=charge_not_active');
    }

    // Save subscription to database
    const db = require('../utils/database');
    await db.saveSubscription({
      shopId: session.shop,
      plan,
      chargeId: charge.id,
      status: 'active',
      price: charge.price,
      startDate: new Date(),
      billingOn: charge.billing_on,
      trialEndsOn: charge.trial_ends_on,
      features: BILLING_PLANS[plan].features
    });

    res.redirect('/?subscription=success');
  } catch (error) {
    console.error('Error activating subscription:', error);
    res.redirect('/?error=activation_failed');
  }
});

/**
 * POST /api/billing/cancel
 * Cancel current subscription
 */
router.post('/cancel', async (req, res) => {
  try {
    const session = req.session;
    const db = require('../utils/database');

    const subscription = await db.getSubscription(session.shop);

    if (!subscription || subscription.plan === 'free') {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }

    // Cancel the charge in Shopify
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
    
    await client.delete({
      path: `recurring_application_charges/${subscription.chargeId}`
    });

    // Update subscription in database
    await db.saveSubscription({
      shopId: session.shop,
      plan: 'free',
      status: 'cancelled',
      cancelledAt: new Date(),
      features: BILLING_PLANS.free.features
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

/**
 * GET /api/billing/usage
 * Get current usage stats for the shop
 */
router.get('/usage', async (req, res) => {
  try {
    const shopId = req.session.shop;
    const db = require('../utils/database');

    const subscription = await db.getSubscription(shopId);
    const offers = await db.getOffers({ shopId });

    const usage = {
      currentPlan: subscription?.plan || 'free',
      offersUsed: offers.length,
      offersLimit: subscription?.features.maxOffers || 1,
      percentageUsed: 0
    };

    if (usage.offersLimit > 0) {
      usage.percentageUsed = (usage.offersUsed / usage.offersLimit) * 100;
    }

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage'
    });
  }
});

/**
 * Check if shop can create more offers based on plan
 */
async function canCreateOffer(shopId) {
  const db = require('../utils/database');
  
  const subscription = await db.getSubscription(shopId);
  const offers = await db.getOffers({ shopId });

  const plan = subscription?.plan || 'free';
  const maxOffers = BILLING_PLANS[plan].features.maxOffers;

  // -1 means unlimited
  if (maxOffers === -1) return true;

  return offers.length < maxOffers;
}

export default router;
export { canCreateOffer, BILLING_PLANS };
