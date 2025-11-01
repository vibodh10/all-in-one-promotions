// index.js (ESM)
import express from 'express';
import { Shopify } from '@shopify/shopify-api';
import { createShopifyAuth } from './middleware/auth.js';
import offerRoutes from './routes/offers.js';
import analyticsRoutes from './routes/analytics.js';
import billingRoutes from './routes/billing.js';
import webhookRoutes from './routes/webhooks.js';
import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Initialize Shopify API
Shopify.Context.initialize({
    API_KEY: process.env.VITE_SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SHOPIFY_SCOPES.split(','),
    HOST_NAME: process.env.APP_URL.replace(/^https?:\/\//, ''),
    API_VERSION: '2024-01',
    IS_EMBEDDED_APP: true,
    SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
});

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for Shopify embedded apps
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// CSP middleware
app.use((req, res, next) => {
    const shopOrigin = req.query.shop ? `https://${req.query.shop}` : '';

    // Always use a single line, no extra spaces or newlines
    const csp = `
    default-src 'self' data: blob: https:;
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' data: blob: https:;
    connect-src 'self' https://argus.shopifycloud.com https://*;
    frame-ancestors ${shopOrigin} https://admin.shopify.com;
    object-src 'none';
    base-uri 'self';
  `.replace(/\s{2,}/g, ' ').trim(); // cleans up line breaks

    res.setHeader('Content-Security-Policy', csp);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Authentication routes
app.get('/auth', createShopifyAuth());
app.get('/auth/callback', createShopifyAuth());

// API routes
app.use('/api/offers', offerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Vite/React build
const frontendPath = path.join(__dirname, 'frontend', 'dist');

// Serve static files under /frontend
app.use('/frontend', express.static(frontendPath, {
    index: false, // prevents serving index.html for every request
}));

// Redirect root (Shopify loads app at /) and preserve query params
app.get('/', (req, res) => {
    const queryString = req.url.split('?')[1];
    const redirectUrl = `/frontend/${queryString ? '?' + queryString : ''}`;
    res.redirect(302, redirectUrl);
});

// Catch-all for React Router (any path under /frontend that is not a static file)
app.get('/frontend/*', (req, res, next) => {
    // Skip requests for real static files (like JS/CSS/images)
    if (req.path.match(/\.[^\/]+$/)) return next();
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal server error',
            status: err.status || 500
        }
    });
});


// Start server
app.listen(PORT, () => {
    console.log(`🚀 Smart Offers & Bundles app running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});

export default app;
