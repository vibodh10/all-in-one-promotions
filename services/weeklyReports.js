import { Resend } from "resend";
import database from "utils/database.js"

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWeeklyReports() {

    const shops = await database.getAllShops();

    for (const shop of shops) {

        const html = `
      <h2>Weekly Offer Performance</h2>
      <p>Shop: ${shop.shop}</p>
      <p>Your offers generated activity this week.</p>
    `;

        await resend.emails.send({
            from: "hello@gl6.com",
            to: shop.email,
            subject: "Your Weekly Offers Report",
            html
        });

    }

}