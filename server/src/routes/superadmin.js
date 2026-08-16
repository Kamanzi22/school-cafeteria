const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authSuperAdmin } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/restaurants', authSuperAdmin, async (req, res) => {
  try {
    const r = await prisma.restaurant.findMany({ include:{ _count:{ select:{ orders:true, items:true } } }, orderBy:{ createdAt:'desc' } });
    res.json({ success:true, data: r.map(({ passwordHash, ...safe }) => safe) });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.patch('/restaurants/:id/approve', authSuperAdmin, async (req, res) => {
  try {
    const r = await prisma.restaurant.findUnique({ where:{ id:req.params.id } });
    const updated = await prisma.restaurant.update({ where:{ id:req.params.id }, data:{ isApproved:!r.isApproved } });
    res.json({ success:true, data:{ isApproved:updated.isApproved } });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.delete('/restaurants/:id', authSuperAdmin, async (req, res) => {
  try {
    await prisma.restaurant.update({ where:{ id:req.params.id }, data:{ isDeleted:true, isOpen:false, deletedAt:new Date() } });
    res.json({ success:true, data:null });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// Mint a short-lived, read-only token that lets the super admin browse a store's own
// admin portal exactly as its owner would see it — without ever granting write access
// (enforced server-side by blockViewer on every mutating route, not just hidden client-side).
router.post('/restaurants/:id/view-token', authSuperAdmin, async (req, res) => {
  try {
    const r = await prisma.restaurant.findFirst({ where: { id: req.params.id, isDeleted: false } });
    if (!r) return res.status(404).json({ success: false, error: 'Store not found or deleted' });
    const token = jwt.sign({ type: 'viewer', restaurantId: r.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
    const { passwordHash, ...safe } = r;
    res.json({ success: true, data: { token, restaurant: safe } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/stats', authSuperAdmin, async (req, res) => {
  try {
    const [totalRestaurants, activeRestaurants, totalOrders, totalCustomers] = await Promise.all([
      prisma.restaurant.count({ where:{ isDeleted:false } }),
      prisma.restaurant.count({ where:{ isDeleted:false, isOpen:true } }),
      prisma.order.count({ where:{ status:{ not:'cancelled' } } }),
      prisma.customer.count()
    ]);
    res.json({ success:true, data:{ totalRestaurants, activeRestaurants, totalOrders, totalCustomers } });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// Visitor tracking — "live" is anyone active in the last 90s (heartbeats fire every ~20s from
// the client, so a gap that size reliably means the tab was closed/backgrounded without a
// clean sendBeacon firing).
router.get('/visits/live', authSuperAdmin, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 90 * 1000);
    const visits = await prisma.restaurantVisit.findMany({
      where: { leftAt: null, lastSeenAt: { gte: cutoff } },
      include: { restaurant: { select: { name: true, emoji: true } } },
      orderBy: { enteredAt: 'desc' },
    });
    res.json({ success: true, data: visits });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/visits/history', authSuperAdmin, async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ success: false, error: 'date required' });
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59.999`);
    const visits = await prisma.restaurantVisit.findMany({
      where: { enteredAt: { gte: start, lte: end } },
      include: { restaurant: { select: { name: true, emoji: true } } },
      orderBy: { enteredAt: 'desc' },
    });
    res.json({ success: true, data: visits });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
