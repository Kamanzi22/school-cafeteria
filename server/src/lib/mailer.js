const nodemailer = require('nodemailer');
const prisma = require('./prisma');

let transporter;
// Lazily built so a missing EMAIL_USER/EMAIL_APP_PASSWORD doesn't crash the whole
// process at boot — only the routes that actually need to send mail see the failure.
function getTransporter() {
  if (transporter !== undefined) return transporter;
  transporter = (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD)
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD } })
    : null;
  return transporter;
}

async function getSenderIdentity() {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  return {
    name: settings?.senderName || 'CaféCampus',
    replyTo: settings?.senderEmail || process.env.EMAIL_USER,
  };
}

const COPY = {
  customer_signup: { subject: 'Verify your email — CaféCampus', heading: "Confirm your email to finish creating your account." },
  restaurant_email_change: { subject: 'Confirm your new login email — CaféCampus', heading: "Confirm this is your new restaurant login email." },
  restaurant_password_change: { subject: 'Confirm your password change — CaféCampus', heading: "Confirm it's you before we change your password." },
};

async function sendVerificationEmail({ to, code, link, purpose }) {
  const t = getTransporter();
  const { subject, heading } = COPY[purpose] || { subject: 'Verify your email', heading: 'Confirm your email address.' };

  if (!t) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email sending is not configured');
    console.log(`\n📧 [DEV — email not configured] Verification code for ${to} (${purpose}): ${code}${link ? `\n   Link: ${link}` : ''}\n`);
    return;
  }

  const { name, replyTo } = await getSenderIdentity();
  await t.sendMail({
    from: `"${name}" <${process.env.EMAIL_USER}>`,
    replyTo,
    to,
    subject,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:28px 24px">
        <p style="font-size:15px;color:#111;margin:0 0 16px">${heading}</p>
        <p style="font-size:13px;color:#666;margin:0 0 6px">Enter this code in the app:</p>
        <p style="font-size:34px;font-weight:700;letter-spacing:8px;color:#111;margin:0 0 16px">${code}</p>
        ${link ? `<p style="margin:0 0 16px"><a href="${link}" style="display:inline-block;background:#f97316;color:#fff;padding:11px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Verify Email</a></p>` : ''}
        <p style="font-size:12px;color:#999;margin:0">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>`,
  });
}

module.exports = { sendVerificationEmail };
