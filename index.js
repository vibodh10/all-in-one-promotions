// index.js (ESM)

// ✅ 1. Always load env vars FIRST
import dotenv from 'dotenv';
dotenv.config();

// ✅ 2. Imports
import '@shopify/shopify-api/adapters/node';
import express from 'express';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import offerRoutes from './routes/offers.js';
import analyticsRoutes from './routes/analytics.js';
import billingRoutes from './routes/billing.js';
import webhookRoutes from './routes/webhooks.js';
import path from 'path';
import { fileURLToPath } from 'url';
import pgSession from 'connect-pg-simple';
import pkg from 'pg';
const { Pool } = pkg;
import cookieParser from 'cookie-parser';
import session from 'express-session';
import authRouter from './middleware/auth.js';

// ✅ 3. Setup DB connection *after dotenv*
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// ✅ 4. Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ 5. Express session middleware — must come before routes
const PgSession = pgSession(session);

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

// ✅ 6. Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ✅ 7. Initialize Shopify
const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES.split(','),
    hostName: process.env.HOST.replace(/https?:\/\//, ''),
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
});

// ✅ 8. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 9. CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    );
    next();
});

// ✅ 10. CSP middleware
app.use((req, res, next) => {
    const shopOrigin = req.query.shop ? `https://${req.query.shop}` : '';
    const csp = `
    default-src 'self' data: blob: https:;
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' data: blob: https:;
    connect-src 'self' https://argus.shopifycloud.com https://*;
    frame-ancestors ${shopOrigin} https://admin.shopify.com;
    object-src 'none';
    base-uri 'self';
  `.replace(/\s{2,}/g, ' ').trim();

    res.setHeader('Content-Security-Policy', csp);
    next();
});

// ✅ 11. Health check
app.get('/health', (req, res) => {
    res
        .status(200)
        .json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ✅ 12. Routes (auth before everything else)
app.use(authRouter);
app.use('/api/offers', offerRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);

// ✅ 13. Frontend serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, 'frontend', 'dist');

app.use('/frontend', express.static(frontendPath));

// --- Handle root requests ---
app.get('/', (req, res) => {
    const shop = req.query.shop || req.session.shop;
    const host = req.query.host || req.session.host;

    if (!shop || !host) {
        if (shop) req.session.shop = shop;
        return res.redirect(`/auth?shop=${shop || ''}`);
    }

    req.session.shop = shop;
    req.session.host = host;

    return res.redirect(302, `/frontend/?shop=${shop}&host=${host}`);
});

// --- Serve React/Vite frontend ---
app.get('/frontend/*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ✅ 14. Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal server error',
            status: err.status || 500,
        },
    });
});

// ✅ 15. Debug route — use same instance `shopify`
app.get('/debug-session', async (req, res) => {
    try {
        const shopifySession = await shopify.utils.loadCurrentSession(req, res, true);

        res.json({
            session: req.session,
            shopifySession,
        });
    } catch (err) {
        console.error('Debug session error:', err);
        res.status(500).json({ error: 'Failed to load session' });
    }
});

// ✅ 16. Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Smart Offers & Bundles app running on port ${PORT}`);
});

export default app;
