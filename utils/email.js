import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to, subject, html) {

    await resend.email.send({
        from: "onboarding@resend.dev",
        to,
        subject,
        html
    });

}