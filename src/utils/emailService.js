import nodemailer from "nodemailer";

/**
 * Creates a Nodemailer transporter using Gmail OAuth2
 */
const createTransporter = async () => {
    // Let nodemailer handle the OAuth2 token refreshing natively
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: process.env.GMAIL_USER_EMAIL,
            clientId: process.env.GMAIL_CLIENT_ID,
            clientSecret: process.env.GMAIL_CLIENT_SECRET,
            refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        },
    });

    return transporter;
};

/**
 * Sends an email with an optional attachment
 */
export const sendEmail = async ({ to, subject, text, html, attachments }) => {
    try {
        const transporter = await createTransporter();

        const mailOptions = {
            from: process.env.GMAIL_USER_EMAIL,
            to,
            subject,
            text,
            html,
            attachments,
        };

        const result = await transporter.sendMail(mailOptions);
        return result;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};
