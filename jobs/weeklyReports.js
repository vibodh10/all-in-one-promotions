import cron from "node-cron";
import { sendWeeklyReports } from "../services/weeklyReports.js";

cron.schedule("0 9 * * 1", async () => {
    console.log("Running weekly reports...");

    try {
        await sendWeeklyReports();
        console.log("Weekly reports sent");
    } catch (err) {
        console.error("Weekly reports failed:", err);
    }
}, {
    timezone: "UTC"
});