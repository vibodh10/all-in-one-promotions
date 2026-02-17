import express from 'express';
const router = express.Router();

import { verifyRequest } from '../middleware/auth.js';
import database from '../utils/database.js';

// Apply authentication to all routes
router.use(verifyRequest);

/**
 * POST /api/analytics/event
 * Track an analytics event
 */
router.post('/event', async (req, res) => {
  try {
    const {
      eventName,
      offerId,
      productId,
      cartValue,
      currency,
      metadata
    } = req.body;

    // Validate event name
    const validEvents = [
      'offer_view',
      'offer_click',
      'offer_applied',
      'cart_update',
      'purchase_complete'
    ];

    if (!validEvents.includes(eventName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event name'
      });
    }

    // Create event record
    const event = {
      eventName,
      offerId,
      productId,
      cartValue,
      currency,
      metadata,
      timestamp: new Date(),
      shopId: req.shop
    };

    // Save event to database
    await database.saveAnalyticsEvent(event);

    // Update offer analytics counters
    if (offerId) {
      await updateOfferAnalytics(offerId, eventName, cartValue);
    }

    res.json({
      success: true,
      message: 'Event tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track event'
    });
  }
});

/**
 * GET /api/analytics/offers/:id
 * Get analytics for a specific offer
 */
router.get('/offers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const shopId = req.shop;

    const offer = await database.getOfferById(id, shopId);
    if (!offer) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    // Get events for date range
    const events = await database.getAnalyticsEvents({
      offerId: id,
      shopId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });

    // Calculate metrics
    const metrics = calculateOfferMetrics(events, offer);

    res.json({
      success: true,
      data: {
        offer: {
          id: offer.id,
          name: offer.name,
          type: offer.type
        },
        metrics,
        events: events.length
      }
    });
  } catch (error) {
    console.error('Error fetching offer analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

/**
 * GET /api/analytics/dashboard
 * Get dashboard summary analytics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const shopId = req.shop;
    const { period = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get all offers
    const offers = await database.getOffers({ shopId, status: 'active' });

    // Get all events in date range
    const events = await database.getAnalyticsEvents({
      shopId,
      startDate,
      endDate
    });

    // Calculate aggregate metrics
    const metrics = {
      totalOffers: offers.length,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      conversionRate: 0,
      clickThroughRate: 0,
      averageOrderValue: 0,
      topPerformingOffers: []
    };

    // Aggregate events
    events.forEach(event => {
      switch (event.eventName) {
        case 'offer_view':
          metrics.totalImpressions++;
          break;
        case 'offer_click':
          metrics.totalClicks++;
          break;
        case 'purchase_complete':
          metrics.totalConversions++;
          metrics.totalRevenue += event.cartValue || 0;
          break;
      }
    });

    // Calculate rates
    if (metrics.totalImpressions > 0) {
      metrics.clickThroughRate = (metrics.totalClicks / metrics.totalImpressions) * 100;
      metrics.conversionRate = (metrics.totalConversions / metrics.totalImpressions) * 100;
    }

    if (metrics.totalConversions > 0) {
      metrics.averageOrderValue = metrics.totalRevenue / metrics.totalConversions;
    }

    // Get top performing offers
    const offerPerformance = {};
    events.forEach(event => {
      if (event.offerId) {
        if (!offerPerformance[event.offerId]) {
          offerPerformance[event.offerId] = {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0
          };
        }
        
        if (event.eventName === 'offer_view') {
          offerPerformance[event.offerId].impressions++;
        } else if (event.eventName === 'offer_click') {
          offerPerformance[event.offerId].clicks++;
        } else if (event.eventName === 'purchase_complete') {
          offerPerformance[event.offerId].conversions++;
          offerPerformance[event.offerId].revenue += event.cartValue || 0;
        }
      }
    });

    // Sort by revenue and get top 5
    metrics.topPerformingOffers = Object.entries(offerPerformance)
      .map(([offerId, stats]) => {
        const offer = offers.find(o => o.id === offerId);
        return {
          offerId,
          offerName: offer?.name || 'Unknown',
          ...stats,
          conversionRate: stats.impressions > 0 ? (stats.conversions / stats.impressions) * 100 : 0
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({
      success: true,
      data: metrics,
      period: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard analytics'
    });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data as CSV
 */
router.get('/export', async (req, res) => {
  try {
    const shopId = req.shop;
    const { startDate, endDate, offerIds } = req.query;

    const filters = {
      shopId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    };

    if (offerIds) {
      filters.offerIds = offerIds.split(',');
    }

    const events = await database.getAnalyticsEvents(filters);

    // Generate CSV
    const csv = generateCSV(events);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics'
    });
  }
});

/**
 * Update offer analytics counters
 */
async function updateOfferAnalytics(offerId, eventName, cartValue = 0) {
  const offer = await database.getOfferById(offerId);
  if (!offer) return;

  const updates = { ...offer.analytics };

  switch (eventName) {
    case 'offer_view':
      updates.impressions = (updates.impressions || 0) + 1;
      break;
    case 'offer_click':
      updates.clicks = (updates.clicks || 0) + 1;
      break;
    case 'purchase_complete':
      updates.conversions = (updates.conversions || 0) + 1;
      updates.revenue = (updates.revenue || 0) + cartValue;
      break;
  }

  await database.updateOffer(offerId, { analytics: updates });
}

/**
 * Calculate metrics from events
 */
function calculateOfferMetrics(events, offer) {
  const metrics = {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    clickThroughRate: 0,
    conversionRate: 0,
    averageOrderValue: 0
  };

  events.forEach(event => {
    switch (event.eventName) {
      case 'offer_view':
        metrics.impressions++;
        break;
      case 'offer_click':
        metrics.clicks++;
        break;
      case 'purchase_complete':
        metrics.conversions++;
        metrics.revenue += event.cartValue || 0;
        break;
    }
  });

  if (metrics.impressions > 0) {
    metrics.clickThroughRate = (metrics.clicks / metrics.impressions) * 100;
    metrics.conversionRate = (metrics.conversions / metrics.impressions) * 100;
  }

  if (metrics.conversions > 0) {
    metrics.averageOrderValue = metrics.revenue / metrics.conversions;
  }

  return metrics;
}

/**
 * Generate CSV from events data
 */
function generateCSV(events) {
  const headers = ['Date', 'Event', 'Offer ID', 'Product ID', 'Cart Value', 'Currency'];
  const rows = events.map(event => [
    event.timestamp.toISOString(),
    event.eventName,
    event.offerId || '',
    event.productId || '',
    event.cartValue || '',
    event.currency || ''
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

export default router;
