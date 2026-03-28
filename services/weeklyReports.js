import { Resend } from "resend";
import pool from "../utils/db.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWeeklyReports() {

    const shops = await pool.query(`
  SELECT shop_id AS shop, contact_email AS email
  FROM shop_settings
  WHERE weekly_reports = true
    AND contact_email IS NOT NULL
`);

    for (const shop of shops.rows) {

        const stats = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE event_name='offer_view') AS impressions,
                COUNT(*) FILTER (WHERE event_name='offer_click') AS clicks,
                COUNT(*) FILTER (WHERE event_name='purchase_complete') AS conversions,
                COALESCE(SUM(cart_value),0) AS revenue
            FROM analytics_events
            WHERE shop_id=$1
              AND timestamp >= NOW() - INTERVAL '7 days'
        `, [shop.shop]);

        const data = stats.rows[0];

        const impressions = Number(data.impressions || 0);
        const clicks = Number(data.clicks || 0);
        const conversions = Number(data.conversions || 0);
        const revenue = Number(data.revenue || 0);

        const ctr = impressions ? ((clicks/impressions)*100).toFixed(2) : 0;
        const conversionRate = impressions ? ((conversions/impressions)*100).toFixed(2) : 0;

        const html = `
      <h2>Weekly Offer Performance</h2>

      <p><strong>Store:</strong> ${shop.shop}</p>

      <ul>
        <li>Impressions: ${impressions}</li>
        <li>Clicks: ${clicks}</li>
        <li>Conversions: ${conversions}</li>
        <li>Revenue generated: $${revenue.toFixed(2)}</li>
      </ul>

      <p>
        CTR: ${ctr}% <br/>
        Conversion rate: ${conversionRate}%
      </p>

      <p>View full analytics inside your Oban All-in-One Offers dashboard.</p>
    `;

        await resend.emails.send({
            from: "ghimab@gmail.com",
            to: shop.email,
            subject: "Your Weekly Offer Performance Report",
            html
        });

    }

}