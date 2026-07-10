const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const verify = (token) => jwt.verify(token, process.env.JWT_SECRET);
const getToken = (req) => req.headers.authorization?.replace('Bearer ', '');

// Restaurant owner (registered via signup)
const authOwner = async (req, res, next) => {
  try {
    const decoded = verify(getToken(req));
    if (decoded.type !== 'owner') return res.status(403).json({ success: false, error: 'Owner access required' });
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: decoded.restaurantId, isDeleted: false }
    });
    if (!restaurant || !restaurant.isApproved) return res.status(403).json({ success: false, error: 'Account suspended or deleted' });
    req.restaurant = restaurant;
    req.restaurantId = restaurant.id;
    req.decoded = decoded;
    next();
  } catch { res.status(401).json({ success: false, error: 'Invalid token' }); }
};

// Restaurant staff (added by owner)
const authStaff = async (req, res, next) => {
  try {
    const decoded = verify(getToken(req));
    if (!['owner','staff'].includes(decoded.type)) return res.status(403).json({ success: false, error: 'Staff access required' });
    if (decoded.type === 'owner') {
      const restaurant = await prisma.restaurant.findFirst({ where: { id: decoded.restaurantId, isDeleted: false } });
      if (!restaurant) return res.status(403).json({ success: false, error: 'Restaurant not found' });
      req.restaurant = restaurant;
      req.restaurantId = restaurant.id;
      req.staffId = null;
      req.role = 'owner';
    } else {
      const staff = await prisma.restaurantStaff.findUnique({ where: { id: decoded.id }, include: { restaurant: true } });
      if (!staff || !staff.isActive || staff.restaurant.isDeleted) return res.status(403).json({ success: false, error: 'Access denied' });
      req.restaurant = staff.restaurant;
      req.restaurantId = staff.restaurantId;
      req.staffId = staff.id;
      req.role = staff.role;
    }
    req.decoded = decoded;
    next();
  } catch { res.status(401).json({ success: false, error: 'Invalid token' }); }
};

// Customer (registered)
const authCustomer = async (req, res, next) => {
  try {
    const decoded = verify(getToken(req));
    if (decoded.type !== 'customer') return res.status(403).json({ success: false, error: 'Customer access required' });
    const customer = await prisma.customer.findUnique({ where: { id: decoded.id } });
    if (!customer) return res.status(401).json({ success: false, error: 'Account not found' });
    req.customer = customer;
    next();
  } catch { res.status(401).json({ success: false, error: 'Invalid token' }); }
};

// Optional customer — works for both logged-in and guest
const optionalCustomer = async (req, res, next) => {
  try {
    const token = getToken(req);
    if (token) {
      const decoded = verify(token);
      if (decoded.type === 'customer' || decoded.type === 'guest') {
        req.customer = await prisma.customer.findUnique({ where: { id: decoded.id } });
      }
    }
  } catch {}
  next();
};

// Super admin
const authSuperAdmin = async (req, res, next) => {
  try {
    const decoded = verify(getToken(req));
    if (decoded.type !== 'superadmin') return res.status(403).json({ success: false, error: 'Super admin access required' });
    req.decoded = decoded;
    next();
  } catch { res.status(401).json({ success: false, error: 'Invalid token' }); }
};

module.exports = { authOwner, authStaff, authCustomer, optionalCustomer, authSuperAdmin };
