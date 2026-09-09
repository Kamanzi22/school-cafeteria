const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { authStaff, blockViewer } = require('../middleware/auth');
const { sendVerificationEmail } = require('../lib/mailer');
const { createVerification, consumeVerification, VERIFY_ERROR_MESSAGES } = require('../lib/verification');
const prisma = require('../lib/prisma');

const sign = (payload, expiresIn = process.env.JWT_EXPIRES_IN) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

// Keeps someone from hammering a mailbox with codes — generous enough for a genuine
// user retrying a typo'd code a few times.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification requests — try again later' },
});

const CLIENT_URL = (process.env.CLIENT_URL || '').split(',')[0]?.trim() || '';
const verifyErr = (code) => VERIFY_ERROR_MESSAGES[code] || 'Verification failed';

// ══════════════════════════════════════════════════════
// CUSTOMER SIGNUP — step 1: validate details, email a code to the address entered.
// Nothing is written to the customers table until the code is confirmed.
// ══════════════════════════════════════════════════════
router.post('/customer-signup/request', requestLimiter, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

    const exists = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ success: false, error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const { code } = await createVerification({
      email, purpose: 'customer_signup',
      payload: { name: name.trim(), email: email.toLowerCase().trim(), passwordHash, phone: phone?.trim() || null },
    });
    const link = CLIENT_URL ? `${CLIENT_URL}/auth?verifyEmail=${encodeURIComponent(email.toLowerCase().trim())}&verifyCode=${code}` : null;
    await sendVerificationEmail({ to: email, code, link, purpose: 'customer_signup' });
    res.json({ success: true, data: { message: 'Verification code sent' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// step 2: confirm the code, create the account.
router.post('/customer-signup/confirm', requestLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, error: 'Email and code required' });

    const result = await consumeVerification({ purpose: 'customer_signup', email, code });
    if (result.error) return res.status(400).json({ success: false, error: verifyErr(result.error) });

    const exists = await prisma.customer.findUnique({ where: { email: result.payload.email } });
    if (exists) return res.status(409).json({ success: false, error: 'Email already registered' });

    const customer = await prisma.customer.create({ data: { accountType: 'registered', ...result.payload } });
    const token = sign({ type: 'customer', id: customer.id });
    const { passwordHash: _, ...safe } = customer;
    res.status(201).json({ success: true, data: { token, customer: safe } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// RESTAURANT — change login email. Owner only. Code goes to the NEW address, since that's
// the one we need to prove they control; the current password already proves it's them.
// ══════════════════════════════════════════════════════
router.post('/restaurant-email/request', authStaff, blockViewer, requestLimiter, async (req, res) => {
  try {
    if (req.role !== 'owner') return res.status(403).json({ success: false, error: 'Only the owner can change the login email' });
    const { currentPassword, newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ success: false, error: 'New email required' });

    const restaurant = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
    const valid = await bcrypt.compare(currentPassword || '', restaurant.passwordHash);
    if (!valid) return res.status(400).json({ success: false, error: 'Current password is incorrect' });

    const taken = await prisma.restaurant.findUnique({ where: { ownerEmail: newEmail.toLowerCase() } });
    if (taken && taken.id !== req.restaurantId) return res.status(409).json({ success: false, error: 'That email is already in use' });

    const { code } = await createVerification({
      email: newEmail, purpose: 'restaurant_email_change', restaurantId: req.restaurantId,
      payload: { newEmail: newEmail.toLowerCase().trim() },
    });
    const link = CLIENT_URL ? `${CLIENT_URL}/admin/settings?verifyCode=${code}&verifyContext=email` : null;
    await sendVerificationEmail({ to: newEmail, code, link, purpose: 'restaurant_email_change' });
    res.json({ success: true, data: { message: 'Verification code sent to your new email' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/restaurant-email/confirm', authStaff, blockViewer, requestLimiter, async (req, res) => {
  try {
    if (req.role !== 'owner') return res.status(403).json({ success: false, error: 'Only the owner can change the login email' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Code required' });

    const result = await consumeVerification({ purpose: 'restaurant_email_change', restaurantId: req.restaurantId, code });
    if (result.error) return res.status(400).json({ success: false, error: verifyErr(result.error) });

    const updated = await prisma.restaurant.update({ where: { id: req.restaurantId }, data: { ownerEmail: result.payload.newEmail } });
    const { passwordHash: _, ...safe } = updated;
    res.json({ success: true, data: { message: 'Email updated', restaurant: safe } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// RESTAURANT — change password. Owner only. No new email is entered here, so the code goes
// to the account's current email as an extra check beyond the current-password requirement.
// ══════════════════════════════════════════════════════
router.post('/restaurant-password/request', authStaff, blockViewer, requestLimiter, async (req, res) => {
  try {
    if (req.role !== 'owner') return res.status(403).json({ success: false, error: 'Only the owner can change the password' });
    const { currentPassword, newPassword } = req.body;
    if (newPassword?.length < 6) return res.status(400).json({ success: false, error: 'Min 6 characters' });

    const restaurant = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
    const valid = await bcrypt.compare(currentPassword || '', restaurant.passwordHash);
    if (!valid) return res.status(400).json({ success: false, error: 'Current password is incorrect' });

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    const { code } = await createVerification({
      email: restaurant.ownerEmail, purpose: 'restaurant_password_change', restaurantId: req.restaurantId,
      payload: { newPasswordHash },
    });
    const link = CLIENT_URL ? `${CLIENT_URL}/admin/settings?verifyCode=${code}&verifyContext=password` : null;
    await sendVerificationEmail({ to: restaurant.ownerEmail, code, link, purpose: 'restaurant_password_change' });
    res.json({ success: true, data: { message: 'Verification code sent to your email' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/restaurant-password/confirm', authStaff, blockViewer, requestLimiter, async (req, res) => {
  try {
    if (req.role !== 'owner') return res.status(403).json({ success: false, error: 'Only the owner can change the password' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Code required' });

    const restaurant = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
    const result = await consumeVerification({ purpose: 'restaurant_password_change', restaurantId: req.restaurantId, code });
    if (result.error) return res.status(400).json({ success: false, error: verifyErr(result.error) });

    await prisma.restaurant.update({ where: { id: req.restaurantId }, data: { passwordHash: result.payload.newPasswordHash } });
    res.json({ success: true, data: { message: 'Password updated' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
