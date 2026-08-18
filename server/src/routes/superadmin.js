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

// Platform-level control over on-campus delivery, applied to every store at once — lets the
// super admin turn it on/off and reprice it without impersonating each owner.
router.patch('/restaurants/campus-delivery-all', authSuperAdmin, async (req, res) => {
  try {
    const { enabled, fee } = req.body;
    const data = {};
    if (enabled !== undefined) {
      data.offersCampusDelivery = !!enabled;
      if (enabled) data.offersDelivery = true;
    }
    if (fee !== undefined) {
      const n = Number(fee);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success:false, error:'fee must be a non-negative number' });
      data.campusDeliveryFee = n;
    }
    const { count } = await prisma.restaurant.updateMany({ where:{ isDeleted:false }, data });
    res.json({ success:true, data:{ count } });
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

// Clears recorded visits — always a soft-delete (moves active visits to trash), every time,
// including the first. Real deletion only happens via the separate, explicit
// /visits/trash (permanent) endpoint, so an accidental click never destroys data outright.
router.delete('/visits', authSuperAdmin, async (req, res) => {
  try {
    const { count } = await prisma.restaurantVisit.updateMany({ where: { deletedAt: null }, data: { deletedAt: new Date() } });
    res.json({ success: true, data: { count } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Undoes the most recent "Clear Data" — brings trashed visits back to active.
router.post('/visits/restore', authSuperAdmin, async (req, res) => {
  try {
    const { count } = await prisma.restaurantVisit.updateMany({ where: { deletedAt: { not: null } }, data: { deletedAt: null } });
    res.json({ success: true, data: { restored: count } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Explicit, irreversible purge of whatever's currently in trash.
router.delete('/visits/trash', authSuperAdmin, async (req, res) => {
  try {
    const { count } = await prisma.restaurantVisit.deleteMany({ where: { deletedAt: { not: null } } });
    res.json({ success: true, data: { deleted: count } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/visits/trash-count', authSuperAdmin, async (req, res) => {
  try {
    const count = await prisma.restaurantVisit.count({ where: { deletedAt: { not: null } } });
    res.json({ success: true, data: { count } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Visitor tracking — "live" is anyone active in the last 90s (heartbeats fire every ~20s from
// the client, so a gap that size reliably means the tab was closed/backgrounded without a
// clean sendBeacon firing).
router.get('/visits/live', authSuperAdmin, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 90 * 1000);
    const visits = await prisma.restaurantVisit.findMany({
      where: { leftAt: null, lastSeenAt: { gte: cutoff }, deletedAt: null },
      include: { restaurant: { select: { name: true, emoji: true } } },
      orderBy: { enteredAt: 'desc' },
    });
    const { visits: enriched } = await enrichVisits(visits);
    res.json({ success: true, data: enriched });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// `date` anchors the period; the actual window depends on `type`:
//   day   -> that calendar day
//   week  -> Mon-Sun containing `date`
//   month -> the whole calendar month containing `date`
//   year  -> the whole calendar year containing `date`
function getPeriodRange(type, dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (type === 'week') {
    const diffToMonday = (d.getDay() + 6) % 7;
    const start = new Date(d); start.setDate(d.getDate() - diffToMonday); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (type === 'month') {
    return { start: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0), end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999) };
  }
  if (type === 'year') {
    return { start: new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0), end: new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999) };
  }
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Attaches, to each visit: the visitor's login credential (email/studentId for account,
// name for guest, nothing for anonymous — they have no credential to show), the order they
// placed during that specific visit (if any — matched by same visitor+restaurant with the
// order created between arrival and ~2min after they left, to allow for checkout time), and
// that visitor's total time across the whole dataset ("time spent on website"). Also computes
// the aggregate stats panel. Each visit stays its own row — visits/orders are never merged.
async function enrichVisits(visits) {
  const emptyStats = { totalVisitors: 0, totalVisits: 0, totalWebsiteTimeSec: 0, perRestaurant: [], topByVisitors: null, topByTime: null };
  if (visits.length === 0) return { visits: [], stats: emptyStats };

  const namedVisits = visits.filter(v => v.visitorType !== 'anonymous');
  const customerIds = [...new Set(namedVisits.map(v => v.visitorId))];
  const customers = customerIds.length
    ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, email: true, studentId: true } })
    : [];
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const restaurantIds = [...new Set(namedVisits.map(v => v.restaurantId))];
  const candidateOrders = customerIds.length
    ? await prisma.order.findMany({
        where: { customerId: { in: customerIds }, restaurantId: { in: restaurantIds } },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  // Match each order to the visit it most plausibly happened during — nearest by proximity to
  // when that visit ended, not just "first eligible visit" — so back-to-back visits to the
  // same restaurant (whose eligibility windows can overlap) each still claim the right order.
  const usedVisitIds = new Set();
  const orderMatch = new Map(); // visit.id -> order
  for (const o of candidateOrders) {
    const created = new Date(o.createdAt).getTime();
    let best = null, bestDelta = Infinity;
    for (const v of namedVisits) {
      if (usedVisitIds.has(v.id) || v.visitorId !== o.customerId || v.restaurantId !== o.restaurantId) continue;
      const entered = new Date(v.enteredAt).getTime();
      const leftOrLastSeen = new Date(v.leftAt || v.lastSeenAt).getTime();
      const windowEnd = leftOrLastSeen + 2 * 60 * 1000;
      if (created < entered || created > windowEnd) continue;
      const delta = Math.abs(created - leftOrLastSeen);
      if (delta < bestDelta) { bestDelta = delta; best = v; }
    }
    if (best) { usedVisitIds.add(best.id); orderMatch.set(best.id, o); }
  }

  const websiteTimeByVisitor = {};
  for (const v of visits) websiteTimeByVisitor[v.visitorId] = (websiteTimeByVisitor[v.visitorId] || 0) + (v.durationSec || 0);

  const enrichedVisits = visits.map(v => {
    const c = v.visitorType !== 'anonymous' ? customerMap[v.visitorId] : null;
    const order = orderMatch.get(v.id);
    return {
      ...v,
      visitorLogin: c ? (c.email || c.studentId || c.name) : null,
      websiteDurationSec: websiteTimeByVisitor[v.visitorId] || v.durationSec,
      order: order ? {
        itemsLabel: order.items.map(i => `${i.quantity}x ${i.menuItemName}`).join(', '),
        amount: order.totalPrice,
        status: order.status,
        paymentMethod: order.paymentMethod,
        fulfillmentType: order.fulfillmentType,
        deliveryScope: order.deliveryScope,
        deliveryLocation: order.deliveryLocation,
      } : null,
    };
  });

  const perRestaurantMap = {};
  const pickupVisitors = new Set();
  const deliveryVisitors = new Set();
  for (const v of visits) {
    const key = v.restaurantId;
    if (!perRestaurantMap[key]) perRestaurantMap[key] = { restaurantId: key, name: v.restaurant?.name, emoji: v.restaurant?.emoji, visitorSet: new Set(), totalTimeSec: 0, salesTotal: 0 };
    perRestaurantMap[key].visitorSet.add(v.visitorId);
    perRestaurantMap[key].totalTimeSec += v.durationSec || 0;

    const order = orderMatch.get(v.id);
    if (order && order.status !== 'cancelled') {
      perRestaurantMap[key].salesTotal += order.totalPrice;
      if (order.fulfillmentType === 'delivery') deliveryVisitors.add(v.visitorId);
      else pickupVisitors.add(v.visitorId);
    }
  }
  const perRestaurant = Object.values(perRestaurantMap)
    .map(r => ({ restaurantId: r.restaurantId, name: r.name, emoji: r.emoji, visitorCount: r.visitorSet.size, totalTimeSec: r.totalTimeSec, salesTotal: r.salesTotal }))
    .sort((a, b) => b.visitorCount - a.visitorCount);

  const topByTime = [...perRestaurant].sort((a, b) => b.totalTimeSec - a.totalTimeSec)[0] || null;
  const topBySales = [...perRestaurant].sort((a, b) => b.salesTotal - a.salesTotal)[0] || null;

  return {
    visits: enrichedVisits,
    stats: {
      totalVisitors: new Set(visits.map(v => v.visitorId)).size,
      totalVisits: visits.length,
      totalWebsiteTimeSec: visits.reduce((s, v) => s + (v.durationSec || 0), 0),
      perRestaurant,
      topByTime: topByTime && topByTime.totalTimeSec > 0 ? { name: topByTime.name, totalTimeSec: topByTime.totalTimeSec } : null,
      topBySales: topBySales && topBySales.salesTotal > 0 ? { name: topBySales.name, amount: topBySales.salesTotal } : null,
      pickupCount: pickupVisitors.size,
      deliveryCount: deliveryVisitors.size,
    },
  };
}

router.get('/visits/history', authSuperAdmin, async (req, res) => {
  try {
    const { date, type } = req.query; // date: YYYY-MM-DD anchor, type: day|week|month|year
    if (!date) return res.status(400).json({ success: false, error: 'date required' });
    const { start, end } = getPeriodRange(type || 'day', date);
    const visits = await prisma.restaurantVisit.findMany({
      where: { enteredAt: { gte: start, lte: end }, deletedAt: null },
      include: { restaurant: { select: { name: true, emoji: true } } },
      orderBy: { enteredAt: 'desc' },
    });
    const enriched = await enrichVisits(visits);
    res.json({ success: true, data: enriched });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
