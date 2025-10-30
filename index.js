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


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for Shopify embedded apps
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use((req, res, next) => {
    const shopOrigin = req.query.shop;

    res.setHeader(
        "Content-Security-Policy",
        `default-src 'self'; 
     script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
     style-src 'self' 'unsafe-inline'; 
     img-src 'self' data: https:; 
     connect-src 'self' https://argus.shopifycloud.com; 
     frame-ancestors https://${shopOrigin} https://admin.shopify.com; 
     object-src 'none'; 
     base-uri 'self';`
    );

    next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Authentication routes
app.get('/auth', createShopifyAuth());
app.get('/auth/callback', createShopifyAuth());

// API Routes
app.use('/api/offers', offerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, 'frontend', 'dist'); // or 'build' if React
app.use('/frontend', express.static(frontendPath));

app.get('/frontend/*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Smart Offers & Bundles app running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});

export default app;
