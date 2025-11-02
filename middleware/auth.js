import { Shopify } from '@shopify/shopify-api';
import * as billing from '../routes/billing.js';
import database from "../utils/database.js";

/**
 * Shopify OAuth authentication middleware
 */
function createShopifyAuth() {
    return async (req, res) => {
        const shop = req.query.shop;

        if (!shop) {
            return res.status(400).json({ error: 'Missing shop parameter' });
        }

        try {
            // Handle OAuth callback
            if (req.path === '/auth/callback') {
                const session = await Shopify.Auth.validateAuthCallback(
                    req,
                    res,
                    req.query
                );

                // Store session in database
                await storeSession(session);

                // Create billing charge if needed
                await createBillingCharge(session);

                // Redirect to app
                return res.redirect(`/?shop=${shop}&host=${req.query.host}`);
            }

            // Begin OAuth flow
            const authRoute = await Shopify.Auth.beginAuth(
                req,
                res,
                shop,
                '/auth/callback',
                false
            );

            return res.redirect(authRoute);
        } catch (error) {
            console.error('Auth error:', error);
            return res.status(500).json({ error: 'Authentication failed' });
        }
    };
}

/**
 * Verify request middleware
 */
async function verifyRequest(req, res, next) {
    try {
        const session = await Shopify.Utils.loadCurrentSession(req, res, true);

        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        req.session = session;
        next();
    } catch (error) {
        console.error('Verification error:', error);
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

/**
 * Verify webhook middleware
 */
async function verifyWebhook(req, res, next) {
    try {
        const isValid = await Shopify.Webhooks.Registry.process(req, res);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid webhook' });
        }

        next();
    } catch (error) {
        console.error('Webhook verification error:', error);
        return res.status(401).json({ error: 'Invalid webhook' });
    }
}

/**
 * Store session in database
 */
async function storeSession(session) {
    await database.saveSession(session);
}

/**
 * Create billing charge for merchant
 */
async function createBillingCharge(session) {
    // Later implement this
}

export { createShopifyAuth, verifyRequest, verifyWebhook };
