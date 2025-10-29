const express = require('express');
const router = express.Router();
const { verifyWebhook } = require('../middleware/auth');
const db = require('../utils/database');

/**
 * POST /api/webhooks/app/uninstalled
 * Handle app uninstallation
 */
router.post('/app/uninstalled', verifyWebhook, async (req, res) => {
  try {
    const shop = req.body.domain;
    
    console.log(`App uninstalled for shop: ${shop}`);

    // Clean up shop data
    await db.deleteShopData(shop);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling uninstall webhook:', error);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/webhooks/shop/update
 * Handle shop updates
 */
router.post('/shop/update', verifyWebhook, async (req, res) => {
  try {
    const shop = req.body;
    
    console.log(`Shop updated: ${shop.domain}`);

    // Update shop details in database
    await db.updateShop({
      shopId: shop.domain,
      name: shop.name,
      email: shop.email,
      currency: shop.currency,
      timezone: shop.iana_timezone,
      plan: shop.plan_name,
      updatedAt: new Date()
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling shop update webhook:', error);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/webhooks/orders/create
 * Handle new orders
 */
router.post('/orders/create', verifyWebhook, async (req, res) => {
  try {
    const order = req.body;
    
    console.log(`New order created: ${order.id}`);

    // Track conversion for offers in the order
    const lineItems = order.line_items || [];
    
    for (const item of lineItems) {
      // Check if item was part of an offer
      const offerMetadata = item.properties?.find(p => p.name === '_offer_id');
      
      if (offerMetadata) {
        const offerId = offerMetadata.value;
        
        // Track purchase complete event
        await db.saveAnalyticsEvent({
          eventName: 'purchase_complete',
          offerId,
          productId: item.product_id,
          cartValue: parseFloat(order.total_price),
          currency: order.currency,
          metadata: {
            orderId: order.id,
            orderNumber: order.order_number
          },
          timestamp: new Date(),
          shopId: order.shop_domain || order.domain
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling order create webhook:', error);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/webhooks/products/update
 * Handle product updates
 */
router.post('/products/update', verifyWebhook, async (req, res) => {
  try {
    const product = req.body;
    
    console.log(`Product updated: ${product.id}`);

    // Update offers that include this product
    const offers = await db.getOffersByProduct(product.id);
    
    for (const offer of offers) {
      // Validate offer is still valid with updated product
      // Could trigger notification if product is out of stock, etc.
      console.log(`Checking offer ${offer.id} for product ${product.id}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling product update webhook:', error);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/webhooks/products/delete
 * Handle product deletion
 */
router.post('/products/delete', verifyWebhook, async (req, res) => {
  try {
    const product = req.body;
    
    console.log(`Product deleted: ${product.id}`);

    // Find offers that include this product
    const offers = await db.getOffersByProduct(product.id);
    
    for (const offer of offers) {
      // Remove product from offer
      const updatedProducts = offer.products.filter(p => p !== product.id.toString());
      
      if (updatedProducts.length === 0) {
        // If no products left, deactivate offer
        await db.updateOffer(offer.id, {
          status: 'draft',
          products: updatedProducts,
          updatedAt: new Date()
        });
      } else {
        // Just remove the product
        await db.updateOffer(offer.id, {
          products: updatedProducts,
          updatedAt: new Date()
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling product delete webhook:', error);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/webhooks/checkouts/create
 * Handle checkout creation
 */
router.post('/checkouts/create', verifyWebhook, async (req, res) => {
  try {
    const checkout = req.body;
    
    console.log(`Checkout created: ${checkout.token}`);

    // Track cart_update event
    const lineItems = checkout.line_items || [];
    
    for (const item of lineItems) {
      const offerMetadata = item.properties?.find(p => p.name === '_offer_id');
      
      if (offerMetadata) {
        await db.saveAnalyticsEvent({
          eventName: 'cart_update',
          offerId: offerMetadata.value,
          productId: item.product_id,
          cartValue: parseFloat(checkout.total_price),
          currency: checkout.currency,
          metadata: {
            checkoutToken: checkout.token,
            quantity: item.quantity
          },
          timestamp: new Date(),
          shopId: checkout.shop_domain || checkout.domain
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling checkout create webhook:', error);
    res.status(500).send('Error');
  }
});

/**
 * Register all webhooks for a shop
 */
async function registerWebhooks(session) {
  const { Shopify } = require('@shopify/shopify-api');
  const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

  const webhooks = [
    {
      topic: 'app/uninstalled',
      address: `${process.env.APP_URL}/api/webhooks/app/uninstalled`
    },
    {
      topic: 'shop/update',
      address: `${process.env.APP_URL}/api/webhooks/shop/update`
    },
    {
      topic: 'orders/create',
      address: `${process.env.APP_URL}/api/webhooks/orders/create`
    },
    {
      topic: 'products/update',
      address: `${process.env.APP_URL}/api/webhooks/products/update`
    },
    {
      topic: 'products/delete',
      address: `${process.env.APP_URL}/api/webhooks/products/delete`
    },
    {
      topic: 'checkouts/create',
      address: `${process.env.APP_URL}/api/webhooks/checkouts/create`
    }
  ];

  for (const webhook of webhooks) {
    try {
      await client.post({
        path: 'webhooks',
        data: {
          webhook: {
            topic: webhook.topic,
            address: webhook.address,
            format: 'json'
          }
        },
        type: Shopify.DataType.JSON
      });
      
      console.log(`Registered webhook: ${webhook.topic}`);
    } catch (error) {
      console.error(`Error registering webhook ${webhook.topic}:`, error);
    }
  }
}

module.exports = router;
module.exports.registerWebhooks = registerWebhooks;
