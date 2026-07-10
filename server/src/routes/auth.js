const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { authStaff, authSuperAdmin } = require('../middleware/auth');
const prisma = new PrismaClient();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only'))
});

const sign = (payload, expiresIn = process.env.JWT_EXPIRES_IN) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ══════════════════════════════════════════════════════
// RESTAURANT — SELF REGISTRATION
// ══════════════════════════════════════════════════════
router.post('/restaurant/register', logoUpload.single('logo'), async (req, res) => {
  try {
    const { ownerName, ownerEmail, ownerPhone, password, restaurantName, description, phone, venueType } = req.body;
    if (!ownerName || !ownerEmail || !password || !restaurantName)
      return res.status(400).json({ success: false, error: 'Name, email, password and restaurant name are required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

    const exists = await prisma.restaurant.findUnique({ where: { ownerEmail: ownerEmail.toLowerCase() } });
    if (exists) return res.status(409).json({ success: false, error: 'An account with this email already exists' });

    let baseSlug = slugify(restaurantName);
    let slug = baseSlug;
    let attempt = 1;
    while (await prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${attempt++}`;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const restaurant = await prisma.restaurant.create({
      data: {
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.toLowerCase().trim(),
        ownerPhone: ownerPhone?.trim(),
        passwordHash,
        name: restaurantName.trim(),
        slug,
        description: description?.trim() || '',
        phone: phone?.trim(),
        venueType: venueType === 'MARKETPLACE' ? 'MARKETPLACE' : 'CAFETERIA',
        logo: req.file ? `/uploads/${req.file.filename}` : null,
      }
    });

    const token = sign({ type: 'owner', restaurantId: restaurant.id, ownerEmail: restaurant.ownerEmail });
    const { passwordHash: _, ...safe } = restaurant;
    res.status(201).json({ success: true, data: { token, restaurant: safe } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// RESTAURANT — OWNER LOGIN
// ══════════════════════════════════════════════════════
router.post('/restaurant/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });

    const restaurant = await prisma.restaurant.findUnique({ where: { ownerEmail: email.toLowerCase() } });
    if (!restaurant || restaurant.isDeleted)
      return res.status(401).json({ success: false, error: 'No account found with this email' });
    if (!restaurant.isApproved)
      return res.status(403).json({ success: false, error: 'Your account has been suspended. Contact support.' });

    const valid = await bcrypt.compare(password, restaurant.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: 'Incorrect password' });

    const token = sign({ type: 'owner', restaurantId: restaurant.id, ownerEmail: restaurant.ownerEmail });
    const { passwordHash, ...safe } = restaurant;
    res.json({ success: true, data: { token, restaurant: safe } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// RESTAURANT — STAFF LOGIN
// ══════════════════════════════════════════════════════
router.post('/restaurant/staff/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const staff = await prisma.restaurantStaff.findUnique({
      where: { username: username.toLowerCase() },
      include: { restaurant: true }
    });
    if (!staff || !staff.isActive || staff.restaurant.isDeleted)
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, staff.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: 'Incorrect password' });

    await prisma.restaurantStaff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
    const token = sign({ type: 'staff', id: staff.id, restaurantId: staff.restaurantId, role: staff.role });
    const { passwordHash, restaurant: { passwordHash: _, ...safeRestaurant } } = staff;
    res.json({ success: true, data: { token, staff: { ...staff, passwordHash: undefined }, restaurant: safeRestaurant } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// CUSTOMER — REGISTER
// ══════════════════════════════════════════════════════
router.post('/customer/register', async (req, res) => {
  try {
    const { name, email, password, phone, studentId, year, department } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

    const exists = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ success: false, error: 'Email already registered' });

    if (studentId) {
      const sExists = await prisma.customer.findUnique({ where: { studentId: studentId.toUpperCase() } });
      if (sExists) return res.status(409).json({ success: false, error: 'Student ID already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const customer = await prisma.customer.create({
      data: {
        accountType: 'registered',
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone?.trim(),
        studentId: studentId ? studentId.trim().toUpperCase() : null,
        year, department
      }
    });
    const token = sign({ type: 'customer', id: customer.id });
    const { passwordHash: _, ...safe } = customer;
    res.status(201).json({ success: true, data: { token, customer: safe } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// CUSTOMER — LOGIN (email or student ID)
// ══════════════════════════════════════════════════════
router.post('/customer/login', async (req, res) => {
  try {
    const { email, studentId, password } = req.body;
    let customer;
    if (email) {
      customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
    } else if (studentId) {
      customer = await prisma.customer.findUnique({ where: { studentId: studentId.toUpperCase() } });
    } else {
      return res.status(400).json({ success: false, error: 'Email or Student ID required' });
    }

    if (!customer || customer.accountType === 'guest')
      return res.status(401).json({ success: false, error: 'No account found' });
    if (!customer.passwordHash)
      return res.status(400).json({ success: false, error: 'Account has no password set' });

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: 'Incorrect password' });

    const token = sign({ type: 'customer', id: customer.id });
    const { passwordHash: _, ...safe } = customer;
    res.json({ success: true, data: { token, customer: safe } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// GUEST — get or create session
// ══════════════════════════════════════════════════════
router.post('/guest/session', async (req, res) => {
  try {
    const { guestToken, name } = req.body;
    if (!guestToken) return res.status(400).json({ success: false, error: 'Guest token required' });

    let customer = await prisma.customer.findUnique({ where: { guestToken } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { accountType: 'guest', name: name || 'Guest', guestToken }
      });
    }
    const token = sign({ type: 'guest', id: customer.id }, '30d');
    const { passwordHash, ...safe } = customer;
    res.json({ success: true, data: { token, customer: safe } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// RESTAURANT — add staff (owner only)
// ══════════════════════════════════════════════════════
router.post('/restaurant/staff', authStaff, async (req, res) => {
  try {
    if (req.role !== 'owner') return res.status(403).json({ success: false, error: 'Only the owner can add staff' });
    const { name, username, password, role } = req.body;
    if (!name || !username || !password) return res.status(400).json({ success: false, error: 'All fields required' });
    const exists = await prisma.restaurantStaff.findUnique({ where: { username: username.toLowerCase() } });
    if (exists) return res.status(409).json({ success: false, error: 'Username taken' });
    const passwordHash = await bcrypt.hash(password, 12);
    const staff = await prisma.restaurantStaff.create({
      data: { restaurantId: req.restaurantId, name, username: username.toLowerCase(), passwordHash, role: role || 'staff' }
    });
    const { passwordHash: _, ...safe } = staff;
    res.json({ success: true, data: safe });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// RESTAURANT — change own password
// ══════════════════════════════════════════════════════
router.put('/restaurant/password', authStaff, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (newPassword?.length < 6) return res.status(400).json({ success: false, error: 'Min 6 characters' });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
    const valid = await bcrypt.compare(currentPassword, restaurant.passwordHash);
    if (!valid) return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    await prisma.restaurant.update({ where: { id: req.restaurantId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
    res.json({ success: true, data: { message: 'Password updated' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════
// SUPER ADMIN — login
// ══════════════════════════════════════════════════════
router.post('/superadmin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await prisma.superAdmin.findUnique({ where: { username } });
    if (!admin) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const token = sign({ type: 'superadmin', id: admin.id });
    res.json({ success: true, data: { token, admin: { id: admin.id, username: admin.username } } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
