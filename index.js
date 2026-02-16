// index.js (ESM)
import dotenv from "dotenv";
dotenv.config();

import "@shopify/shopify-api/adapters/node";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import pkg from "pg";
import authRouter, { verifyRequest } from "./middleware/auth.js";

import offerRoutes from "./routes/offers.js";
import analyticsRoutes from "./routes/analytics.js";
import billingRoutes from "./routes/billing.js";
import webhookRoutes from "./routes/webhooks.js";

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ One Postgres pool (Neon)
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});
app.locals.pgPool = pgPool;

// ✅ Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Basic CORS (keep it simple)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

// ✅ CSP
app.use((req, res, next) => {
    const shopOrigin = req.query.shop ? `https://${req.query.shop}` : "";
    const csp = `
    default-src 'self' data: blob: https:;
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' data: blob: https:;
    connect-src 'self' https://argus.shopifycloud.com https://*;
    frame-ancestors ${shopOrigin} https://admin.shopify.com;
    object-src 'none';
    base-uri 'self';
  `.replace(/\s{2,}/g, " ").trim();

    res.setHeader("Content-Security-Policy", csp);
    next();
});

// Health
app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// ✅ Auth routes
app.use(authRouter);

// ✅ API routes (must include verifyRequest)
app.use("/api/offers", verifyRequest, offerRoutes);
app.use("/api/analytics", verifyRequest, analyticsRoutes);
app.use("/api/billing", verifyRequest, billingRoutes);

// ✅ Webhooks: IMPORTANT — needs RAW body, so mount with express.raw
app.use("/api/webhooks", express.raw({ type: "application/json" }), webhookRoutes);

// ✅ Frontend serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
    app.use("/frontend", (req, res) => {
        res.redirect(`http://localhost:5173${req.originalUrl.replace("/frontend", "")}`);
    });
} else {
    const frontendPath = path.join(__dirname, "frontend", "dist");
    app.use("/frontend", express.static(frontendPath));
    app.get("/frontend/*", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));
}

// Root: ensure shop exists then go OAuth
app.get("/", (req, res) => {
    const shop = req.query.shop;
    const host = req.query.host;

    if (!shop || !host) {
        return res.status(400).send("Missing shop/host");
    }

    return res.redirect(302, `/frontend/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);
});

// Error handler
app.use((err, req, res, next) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
        error: { message: err.message || "Internal server error", status: err.status || 500 },
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Smart Offers & Bundles app running on port ${PORT}`);
});

export default app;
