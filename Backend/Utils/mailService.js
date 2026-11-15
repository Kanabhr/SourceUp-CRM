import nodemailer from "nodemailer";

/**
 * Mail service for SourceUp CRM.
 *
 * Reads SMTP configuration from environment variables:
 *   SMTP_HOST   e.g. "smtp.gmail.com"
 *   SMTP_PORT   e.g. 587
 *   SMTP_USER   e.g. "you@gmail.com"
 *   SMTP_PASS   e.g. Gmail app-password or SMTP password
 *   SMTP_FROM   e.g. "SourceUp CRM <you@gmail.com>"  (falls back to SMTP_USER)
 *
 * A fresh transporter is created on each send so that env-var changes
 * (e.g. after a hot-reload in dev) are always picked up without restart.
 */

/** Returns true when all required SMTP env vars are present. */
const isMailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/** The From address — uses SMTP_FROM if set, otherwise SMTP_USER. */
const getFromAddress = () =>
  process.env.SMTP_FROM || process.env.SMTP_USER || "SourceUp CRM <noreply@sourceup.in>";

/**
 * Send an email.
 *
 * @param {object} opts
 * @param {string} opts.to        recipient email address
 * @param {string} opts.subject   email subject line
 * @param {string} [opts.text]    plain-text body
 * @param {string} [opts.html]    HTML body (optional, overrides text)
 * @param {Array}  [opts.attachments]  nodemailer attachments [{ filename, content (Buffer), contentType }]
 * @returns {Promise<{ messageId: string }>}
 */
async function sendMail({ to, subject, text, html, attachments = [] }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "Email sending is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in Backend/.env.local",
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
    attachments,
  });

  return { messageId: info.messageId };
}

export { sendMail, isMailConfigured, getFromAddress };
