require('dotenv').config();
const express = require('express');
const { Shopify } = require('@shopify/shopify-api');
console.log('Shopify package:', Shopify);
console.log('Shopify version:', require('@shopify/shopify-api/package.json').version);
process.exit();
const { createShopifyAuth } = require('./middleware/auth');
const offerRoutes = require('./routes/offers');
const analyticsRoutes = require('./routes/analytics');
const billingRoutes = require('./routes/billing');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Shopify API
Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SHOPIFY_SCOPES.split(','),
  HOST_NAME: process.env.APP_URL.replace(/https?:\/\//, ''),
  API_VERSION: '2024-01',
  IS_EMBEDDED_APP: true,
  SESSION_STORAGE: new Shopify.Session.CustomSessionStorage(
    // Implement session storage (Firebase or PostgreSQL)
    require('./utils/sessionStorage')
  ),
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Smart Offers & Bundles app running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
