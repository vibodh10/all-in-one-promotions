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
            SELECT * FROM offers
            WHERE status IN ('scheduled', 'active')
        `);

        for (const row of offers.rows) {

            const offer = new Offer(row);

            const start = offer.schedule?.startDate
                ? new Date(offer.schedule.startDate)
                : null;

            const end = offer.schedule?.endDate
                ? new Date(offer.schedule.endDate)
                : null;

            const shop = row.shop_id;
            const accessToken = await getAccessToken(shop);

            // ✅ ACTIVATE (with guard)
            if (
                offer.status === "scheduled" &&
                start &&
                now >= start
            ) {

                // 🔒 GUARD: only create if not already created
                if (!row.shopify_discount_ids) {

                    const result = await createDiscount({ shop, accessToken }, offer);

                    await pool.query(
                        `UPDATE offers SET status = 'active', shopify_discount_ids = $1 WHERE id = $2`,
                        [result.automaticDiscountIds, offer.id]
                    );

                } else {
                    // fallback: already has discount but status not updated
                    await pool.query(
                        `UPDATE offers SET status = 'active' WHERE id = $1`,
                        [offer.id]
                    );
                }
            }

            // ✅ EXPIRE
            if (
                offer.status === "active" &&
                end &&
                now >= end
            ) {

                if (row.shopify_discount_ids) {
                    await deleteDiscount({ shop, accessToken }, row.shopify_discount_ids);
                }

                await pool.query(
                    `UPDATE offers SET status = 'paused' WHERE id = $1`,
                    [offer.id]
                );
            }
        }

        res.send("Offers processed");

    } catch (error) {
        console.error(error);
        res.status(500).send("Failed");
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