import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || 'Canvas App <noreply@example.com>';

const isSmtpConfigured = !!(smtpHost && smtpUser && smtpPass);

function getTransporter() {
  if (!isSmtpConfigured) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

/**
 * Send an email. Falls back to console.log when SMTP is not configured.
 * Returns true if the email was sent (or logged in dev), false on error.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[Email] SMTP not configured — logging email instead:`);
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body (HTML): ${html}`);
    return true;
  }

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('[Email] Failed to send email:', err);
    return false;
  }
}

/**
 * Send an email verification email with a branded HTML template.
 * Falls back to console.log when SMTP is not configured.
 */
export async function sendVerificationEmail(
  to: string,
  verifyLink: string,
): Promise<boolean> {
  const subject = 'Verify your Canvas App email';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #4f46e5; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Canvas App</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1a1a2e; font-size: 20px; font-weight: 600;">Verify Your Email</h2>
              <p style="margin: 0 0 16px; color: #4a4a68; font-size: 15px; line-height: 1.6;">
                Thanks for signing up! Please verify your email address by clicking the button below. This link will expire in <strong>24 hours</strong>.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #4f46e5;">
                    <a href="${verifyLink}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600;">Verify Email</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; color: #4a4a68; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; word-break: break-all; color: #4f46e5; font-size: 13px;">${verifyLink}</p>
              <hr style="border: none; border-top: 1px solid #e8e8ed; margin: 24px 0;" />
              <p style="margin: 0; color: #8e8ea0; font-size: 13px; line-height: 1.5;">
                If you did not create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafc; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #8e8ea0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Canvas App. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return sendEmail(to, subject, html);
}

/**
 * Send a password reset email with a branded HTML template.
 * Falls back to console.log when SMTP is not configured.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
): Promise<boolean> {
  const subject = 'Reset your Canvas App password';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #4f46e5; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Canvas App</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1a1a2e; font-size: 20px; font-weight: 600;">Password Reset Request</h2>
              <p style="margin: 0 0 16px; color: #4a4a68; font-size: 15px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #4f46e5;">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; color: #4a4a68; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; word-break: break-all; color: #4f46e5; font-size: 13px;">${resetLink}</p>
              <hr style="border: none; border-top: 1px solid #e8e8ed; margin: 24px 0;" />
              <p style="margin: 0; color: #8e8ea0; font-size: 13px; line-height: 1.5;">
                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafc; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #8e8ea0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Canvas App. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  return sendEmail(to, subject, html);
}
