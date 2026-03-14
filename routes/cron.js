import express from "express";
import { sendWeeklyReports } from "../services/weeklyReports.js";

const router = express.Router();

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