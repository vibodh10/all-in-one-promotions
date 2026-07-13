import express from "express";
import { sendWeeklyReports } from "../services/weeklyReports.js";
import pool from "../utils/db.js";
import Offer from "../models/Offer.js";
import {createDiscount, deleteDiscount} from "../utils/shopifyFunctions.js";
import {getAccessToken} from "./offers.js";

const router = express.Router();

router.get("/process-offers", async (req, res) => {
    if (req.query.key !== process.env.CRON_SECRET) {
        return res.status(403).send("Unauthorized");
    }

    try {
        const now = new Date();

        const offers = await pool.query(`
            SELECT o.*
            FROM offers o
            WHERE o.status IN ('scheduled', 'active')
              AND EXISTS (
                SELECT 1
                FROM shop_tokens st
                WHERE st.shop = o.shop_id
                  AND st.access_token IS NOT NULL
            )
        `);

        let processed = 0;
        let skipped = 0;

        for (const row of offers.rows) {
            try {
                const offer = new Offer(row);

                const start = offer.schedule?.startDate
                    ? new Date(offer.schedule.startDate)
                    : null;

                const end = offer.schedule?.endDate
                    ? new Date(offer.schedule.endDate)
                    : null;

                const shop = row.shop_id;
                const accessToken = await getAccessToken(shop);

                // ACTIVATE
                if (
                    offer.status === "scheduled" &&
                    start &&
                    now >= start
                ) {
                    if (!row.shopify_discount_ids) {
                        const result = await createDiscount(
                            { shop, accessToken },
                            offer
                        );

                        await pool.query(
                            `
                                UPDATE offers
                                SET
                                    status = 'active',
                                    shopify_discount_ids = $1
                                WHERE id = $2
                            `,
                            [
                                JSON.stringify(result.automaticDiscountIds),
                                offer.id
                            ]
                        );
                    } else {
                        await pool.query(
                            `
                                UPDATE offers
                                SET status = 'active'
                                WHERE id = $1
                            `,
                            [offer.id]
                        );
                    }

                    processed++;
                }

                // EXPIRE
                if (
                    offer.status === "active" &&
                    end &&
                    now >= end
                ) {
                    if (row.shopify_discount_ids) {
                        await deleteDiscount(
                            { shop, accessToken },
                            row.shopify_discount_ids
                        );
                    }

                    await pool.query(
                        `
                            UPDATE offers
                            SET status = 'paused'
                            WHERE id = $1
                        `,
                        [offer.id]
                    );

                    processed++;
                }
            } catch (error) {
                skipped++;

                console.error("Skipping offer during cron:", {
                    offerId: row.id,
                    shop: row.shop_id,
                    error: error?.message || error
                });

                continue;
            }
        }

        return res.status(200).json({
            success: true,
            checked: offers.rows.length,
            processed,
            skipped
        });
    } catch (error) {
        console.error("Process offers cron failed:", error);
        return res.status(500).send("Failed");
    }
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

export default router;