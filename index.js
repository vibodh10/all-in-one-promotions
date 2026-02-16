// index.js (ESM)
import dotenv from "dotenv";
dotenv.config();

import "@shopify/shopify-api/adapters/node";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import cookieParser from "cookie-parser";
import session from "express-session";

import pgSession from "connect-pg-simple";
import pkg from "pg";

import authRouter from "./middleware/auth.js";
import offerRoutes from "./routes/offers.js";
import analyticsRoutes from "./routes/analytics.js";
import billingRoutes from "./routes/billing.js";
import webhookRoutes from "./routes/webhooks.js";

import { verifyRequest } from "./middleware/auth.js";

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

/* -----------------------------
   Postgres pool (for express-session store)
------------------------------ */
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const PgSession = pgSession(session);

/* -----------------------------
   Middleware (order matters)
------------------------------ */
app.use(cookieParser());

app.use(
    session({
        store: new PgSession({
            pool: pgPool,
            tableName: "user_sessions",
            // connect-pg-simple creates it if missing when `createTableIfMissing: true`
            createTableIfMissing: true,
        }),
        secret: process.env.SESSION_SECRET || "change-me",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: true,
            httpOnly: true,
            sameSite: "none",
            maxAge: 24 * 60 * 60 * 1000,
        },
    })
);

app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -----------------------------
   CORS (embedded app)
------------------------------ */
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

/* -----------------------------
   CSP
------------------------------ */
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

/* -----------------------------
   Health
------------------------------ */
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

/* -----------------------------
   Auth routes (must be mounted)
------------------------------ */
app.use(authRouter);

/* -----------------------------
   API routes
------------------------------ */
app.use("/api/offers", verifyRequest, offerRoutes);
app.use("/api/analytics", verifyRequest, analyticsRoutes);
app.use("/api/billing", verifyRequest, billingRoutes);
app.use("/api/webhooks", webhookRoutes);

/* -----------------------------
   Frontend serving
------------------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
    console.log("🔥 DEVELOPMENT — redirecting /frontend to Vite");
    app.use("/frontend", (req, res) => {
        res.redirect(`http://localhost:5173${req.originalUrl.replace("/frontend", "")}`);
    });
} else {
    console.log("🚀 PRODUCTION — serving built frontend");
    const frontendPath = path.join(__dirname, "frontend", "dist");
    app.use("/frontend", express.static(frontendPath));
    app.get("/frontend/*", (_req, res) => {
        res.sendFile(path.join(frontendPath, "index.html"));
    });
}

/* -----------------------------
   Root route: ensure shop+host then go frontend
------------------------------ */
app.get("/", (req, res) => {
    const shop = req.query.shop || req.session.shop;
    const host = req.query.host || req.session.host;

    if (!shop) return res.status(400).send("Missing shop");

    if (!host) {
        // No host? push through OAuth to get proper embedded params
        return res.redirect(`/auth?shop=${shop}`);
    }

    req.session.shop = shop;
    req.session.host = host;

    return res.redirect(302, `/frontend/?shop=${shop}&host=${host}`);
});

/* -----------------------------
   Error handler
------------------------------ */
app.use((err, _req, res, _next) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
        error: {
            message: err.message || "Internal server error",
            status: err.status || 500,
        },
    });
});

/* -----------------------------
   Start
------------------------------ */
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Smart Offers & Bundles app running on port ${PORT}`);
});

export default app;
