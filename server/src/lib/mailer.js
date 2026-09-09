const nodemailer = require('nodemailer');
const prisma = require('./prisma');
const { decrypt } = require('./crypto');

// The "noreply" account verification emails are sent from/authenticated as — the only one
// of the three configurable identities (noreply/info/support) actually wired to a live
// feature. A super admin-configured account (Email Settings → Noreply → App Password) takes
// priority over the environment's EMAIL_USER/EMAIL_APP_PASSWORD, so the sending account can
// be swapped without touching Render — set once via env vars to bootstrap, then optionally
// overridden from the panel. Built fresh per send (not cached) so a panel change takes
// effect immediately.
async function getEffectiveCredentials() {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  if (settings?.noreplyAppPasswordEnc) {
    return { user: settings.noreplyEmail, pass: decrypt(settings.noreplyAppPasswordEnc), name: settings.noreplyName || 'CaféCampus' };
  }
  if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    return { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD, name: settings?.noreplyName || 'CaféCampus' };
  }
  return null;
}

const COPY = {
  customer_signup: { subject: 'Verify your email — CaféCampus', heading: "Confirm your email to finish creating your account." },
  restaurant_email_change: { subject: 'Confirm your new login email — CaféCampus', heading: "Confirm this is your new restaurant login email." },
  restaurant_password_change: { subject: 'Confirm your password change — CaféCampus', heading: "Confirm it's you before we change your password." },
};

async function sendVerificationEmail({ to, code, link, purpose }) {
  const { subject, heading } = COPY[purpose] || { subject: 'Verify your email', heading: 'Confirm your email address.' };
  const creds = await getEffectiveCredentials();

  if (!creds) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email sending is not configured');
    console.log(`\n📧 [DEV — email not configured] Verification code for ${to} (${purpose}): ${code}${link ? `\n   Link: ${link}` : ''}\n`);
    return;
  }

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: creds.user, pass: creds.pass } });
  await transporter.sendMail({
    from: `"${creds.name}" <${creds.user}>`,
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
