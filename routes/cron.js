import express from "express";
import { sendWeeklyReports } from "../services/weeklyReports.js";
import pool from "../utils/db.js";
import { refreshOfflineToken } from "../utils/tokenManager.js";

const router = express.Router();

router.get("/process-offers", async (req, res) => {
    if (req.query.key !== process.env.CRON_SECRET) {
        return res.status(403).send("Unauthorized");
    }

    return res.status(200).json({
        success: true,
        scheduler: "shopify",
        message:
            "Offer activation and expiry are handled by Shopify startsAt/endsAt; no database polling is required."
    });
});

router.get("/weekly-report", async (req, res) => {

    if (req.query.key !== process.env.CRON_SECRET) {
        return res.status(403).send("Unauthorized");
    }

    try {
        await sendWeeklyReports();
        res.send("Reports sent");
    } catch (error) {
        console.error(error);
        res.status(500).send("Failed");
    }

});

router.get("/refresh-expiring-tokens", async (req, res) => {
    if (req.query.key !== process.env.CRON_SECRET) {
        return res.status(403).send("Unauthorized");
    }

    try {
        const tokens = await pool.query(`
            SELECT
                shop,
                refresh_token,
                refresh_token_expires_at
            FROM shop_tokens
            WHERE token_type = 'expiring_offline'
              AND refresh_token IS NOT NULL
              AND refresh_token_expires_at > NOW()
              AND refresh_token_expires_at <= NOW() + INTERVAL '14 days'
        `);

        const results = [];

        for (const row of tokens.rows) {
            try {
                await refreshOfflineToken(
                    row.shop,
                    row.refresh_token
                );

                console.log(
                    `Refresh-token safety cron succeeded for ${row.shop}`
                );

                results.push({
                    shop: row.shop,
                    refreshed: true
                });
            } catch (error) {
                console.error(
                    `Refresh-token safety cron failed for ${row.shop}:`,
                    error
                );

                results.push({
                    shop: row.shop,
                    refreshed: false,
                    error: error?.message || String(error)
                });
            }
        }

        return res.status(200).json({
            success: true,
            checked: tokens.rows.length,
            refreshed: results.filter(
                result => result.refreshed
            ).length,
            failed: results.filter(
                result => !result.refreshed
            ).length,
            results
        });
    } catch (error) {
        console.error(
            "Refresh-token safety cron failed:",
            error
        );

        return res.status(500).json({
            success: false,
            error: error?.message || "Failed"
        });
    }
});

export default router;