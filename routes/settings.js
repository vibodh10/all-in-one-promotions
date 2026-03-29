import express from "express";
import pool from "../utils/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const shop = req.shop;

        const result = await pool.query(
            `SELECT *
             FROM shop_settings
             WHERE shop_id = $1`,
            [shop]
        );

        if (!result.rows.length) {
            return res.json({});
        }

        const row = result.rows[0];

        // ✅ map DB → frontend format
        res.json({
            contactEmail: row.contact_email,
            showBranding: row.show_branding,
            enableAnimations: row.enable_animations,
            emailNotifications: row.email_notifications,
            weeklyReports: row.weekly_reports
        });

    } catch (err) {
        console.error("Error fetching settings:", err);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

router.post("/", async (req, res) => {

    const shop = req.shop;
    const {
        contactEmail,
        showBranding,
        enableAnimations,
        emailNotifications,
        weeklyReports
    } = req.body;

    await pool.query(
        `
            INSERT INTO shop_settings
            (shop_id, contact_email, show_branding, enable_animations, email_notifications, weekly_reports)
            VALUES ($1,$2,$3,$4,$5,$6)

                ON CONFLICT (shop_id)
        DO UPDATE SET
                contact_email = EXCLUDED.contact_email,
                               show_branding = EXCLUDED.show_branding,
                               enable_animations = EXCLUDED.enable_animations,
                               email_notifications = EXCLUDED.email_notifications,
                               weekly_reports = EXCLUDED.weekly_reports,
                               updated_at = NOW()
        `,
        [
            shop,
            contactEmail,
            showBranding,
            enableAnimations,
            emailNotifications,
            weeklyReports
        ]
    );

    res.json({ success: true });

});

export default router;