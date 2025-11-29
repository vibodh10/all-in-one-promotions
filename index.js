// index.js (ESM)
import '@shopify/shopify-api/adapters/node';
import express from 'express';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { createShopifyAuth } from './middleware/auth.js';
import offerRoutes from './routes/offers.js';
import analyticsRoutes from './routes/analytics.js';
import billingRoutes from './routes/billing.js';
import webhookRoutes from './routes/webhooks.js';
import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from 'url';
import pgSession from 'connect-pg-simple';
import pkg from 'pg';
const { Pool } = pkg;

const PgSession = pgSession(session);

const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

import cookieParser from 'cookie-parser';
import session from 'express-session';

app.use(cookieParser());
app.use(
    session({
        store: new PgSession({
            pool: pgPool,
            tableName: 'user_sessions',
        }),
        secret: process.env.SESSION_SECRET || 'something-strong',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        },
    })
);

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Initialize Shopify API
const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES.split(","),
    hostName: process.env.HOST.replace(/https?:\/\//, ""),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
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
app.get('/auth', (req, res, next) => {
    if (req.query.host) {
        req.session.host = req.query.host;
    }
    next();
}, createShopifyAuth());
app.get('/auth/callback', createShopifyAuth());

// API routes
app.use('/api/offers', offerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendPath = path.join(__dirname, "frontend", "dist");

// Serve frontend static assets
app.use("/frontend", express.static(frontendPath));

// --- Handle root requests (Shopify entry point) ---
app.get("/", (req, res) => {
    const shop = req.query.shop || req.session.shop;
    const host = req.query.host || req.session.host;

    if (!shop || !host) {
        // Persist shop for later if present
        if (shop) req.session.shop = shop;
        return res.redirect(`/auth?shop=${shop || ""}`);
    }

    // ✅ Always store latest host + shop in session
    req.session.shop = shop;
    req.session.host = host;

    // ✅ Explicitly forward params to frontend
    return res.redirect(302, `/frontend/?shop=${shop}&host=${host}`);
});

// --- Serve frontend files (React/Vite) ---
app.get("/frontend/*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
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

app.get("/debug-session", (req, res) => {
    res.json({
        query: req.query,
        session: req.session,
        cookies: req.cookies
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Smart Offers & Bundles app running on port ${PORT}`);
});

export default app;
