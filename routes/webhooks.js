import express from 'express';
import { verifyWebhook } from '../middleware/auth.js';
import database from '../utils/database.js'; // ESM import for database utils
import pkg from '@shopify/shopify-api';
const { Shopify } = pkg;
const router = express.Router();

/**
 * POST /api/webhooks/app/uninstalled
 */
router.post('/app/uninstalled', verifyWebhook, async (req, res) => {
    try {
        const shop = req.body.domain;
        console.log(`App uninstalled for shop: ${shop}`);

        await database.deleteShopData(shop);

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling uninstall webhook:', error);
        res.status(500).send('Error');
    }
});

/**
 * POST /api/webhooks/shop/update
 */
router.post('/shop/update', verifyWebhook, async (req, res) => {
    try {
        const shop = req.body;
        console.log(`Shop updated: ${shop.domain}`);

        await database.updateShop({
            shopId: shop.domain,
            name: shop.name,
            email: shop.email,
            currency: shop.currency,
            timezone: shop.iana_timezone,
            plan: shop.plan_name,
            updatedAt: new Date(),
        });

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling shop update webhook:', error);
        res.status(500).send('Error');
    }
});

/**
 * POST /api/webhooks/orders/create
 */
router.post('/orders/create', verifyWebhook, async (req, res) => {
    try {
        const order = req.body;
        console.log(`New order created: ${order.id}`);

        const lineItems = order.line_items || [];

        for (const item of lineItems) {
            const offerMetadata = item.properties?.find(p => p.name === '_offer_id');

            if (offerMetadata) {
                await database.saveAnalyticsEvent({
                    eventName: 'purchase_complete',
                    offerId: offerMetadata.value,
                    productId: item.product_id,
                    cartValue: parseFloat(order.total_price),
                    currency: order.currency,
                    metadata: { orderId: order.id, orderNumber: order.order_number },
                    timestamp: new Date(),
                    shopId: order.shop_domain || order.domain,
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
 */
router.post('/products/update', verifyWebhook, async (req, res) => {
    try {
        const product = req.body;
        console.log(`Product updated: ${product.id}`);

        const offers = await database.getOffersByProduct(product.id);

        for (const offer of offers) {
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
 */
router.post('/products/delete', verifyWebhook, async (req, res) => {
    try {
        const product = req.body;
        console.log(`Product deleted: ${product.id}`);

        const offers = await database.getOffersByProduct(product.id);

        for (const offer of offers) {
            const updatedProducts = offer.products.filter(p => p !== product.id.toString());

            if (updatedProducts.length === 0) {
                await database.updateOffer(offer.id, { status: 'draft', products: updatedProducts, updatedAt: new Date() });
            } else {
                await database.updateOffer(offer.id, { products: updatedProducts, updatedAt: new Date() });
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
 */
router.post('/checkouts/create', verifyWebhook, async (req, res) => {
    try {
        const checkout = req.body;
        console.log(`Checkout created: ${checkout.token}`);

        const lineItems = checkout.line_items || [];

        for (const item of lineItems) {
            const offerMetadata = item.properties?.find(p => p.name === '_offer_id');

            if (offerMetadata) {
                await database.saveAnalyticsEvent({
                    eventName: 'cart_update',
                    offerId: offerMetadata.value,
                    productId: item.product_id,
                    cartValue: parseFloat(checkout.total_price),
                    currency: checkout.currency,
                    metadata: { checkoutToken: checkout.token, quantity: item.quantity },
                    timestamp: new Date(),
                    shopId: checkout.shop_domain || checkout.domain,
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
export async function registerWebhooks(session) {
    const client = new shopify.clients
.Rest(session.shop, session.accessToken);

    const webhooks = [
        { topic: 'app/uninstalled', address: `${process.env.APP_URL}/api/webhooks/app/uninstalled` },
        { topic: 'shop/update', address: `${process.env.APP_URL}/api/webhooks/shop/update` },
        { topic: 'orders/create', address: `${process.env.APP_URL}/api/webhooks/orders/create` },
        { topic: 'products/update', address: `${process.env.APP_URL}/api/webhooks/products/update` },
        { topic: 'products/delete', address: `${process.env.APP_URL}/api/webhooks/products/delete` },
        { topic: 'checkouts/create', address: `${process.env.APP_URL}/api/webhooks/checkouts/create` },
    ];

    for (const webhook of webhooks) {
        try {
            await client.post({
                path: 'webhooks',
                data: { webhook: { topic: webhook.topic, address: webhook.address, format: 'json' } },
                type: Shopify.DataType.JSON,
            });

            console.log(`Registered webhook: ${webhook.topic}`);
        } catch (error) {
            console.error(`Error registering webhook ${webhook.topic}:`, error);
        }
    }
}

export default router;
