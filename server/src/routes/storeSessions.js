const router = require('express').Router();
const { authStaff, authSuperAdmin } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/periodRange');

// Time a store's owner or staff spend in the restaurant app (see RestaurantSession in the
// schema), shown to the super admin next to customer visits. The app starts a session when it's
// opened, checks in every ~20 s while it's on screen, and ends it when it's closed or put in the
// background — coming back within 2 minutes picks the same session up again.

const SESSION_INCLUDE = { restaurant: { select: { name: true, emoji: true } } };
// Only time between check-ins counts, so a phone that went to sleep without saying goodbye isn't
// credited with the hours it sat there. The app checks in every 20 s; allow some slack.
const MAX_GAP_MS = 30 * 1000;
const RESUME_WINDOW_MS = 3 * 60 * 1000;

const emit = (req, session) => req.app.get('io').to('superadmin').emit('store-session:update', session);
const activeSecondsSince = (lastSeenAt, now) => Math.round(Math.min(Math.max(now - lastSeenAt.getTime(), 0), MAX_GAP_MS) / 1000);

router.post('/start', authStaff, async (req, res) => {
  try {
    // The super admin's own read-only "view store" visits aren't the store's activity
    if (req.role === 'viewer') return res.json({ success: true, data: null });
    let userType, userId, userName, role;
    if (req.role === 'owner') {
      userType = 'owner'; userId = req.restaurantId; userName = req.restaurant.ownerName || 'Owner'; role = 'owner';
    } else {
      const staff = await prisma.restaurantStaff.findUnique({ where: { id: req.staffId }, select: { name: true } });
      userType = 'staff'; userId = req.staffId; userName = staff?.name || 'Staff'; role = req.role;
    }
    const session = await prisma.restaurantSession.create({
      data: { restaurantId: req.restaurantId, userType, userId, userName, role },
      include: SESSION_INCLUDE,
    });
    emit(req, session);
    res.json({ success: true, data: { id: session.id } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Like customer visits, the session's own unguessable id is what identifies it from here on —
// leaving is sent with navigator.sendBeacon, which can't carry a login.
router.post('/:id/heartbeat', async (req, res) => {
  try {
    const existing = await prisma.restaurantSession.findUnique({ where: { id: req.params.id } });
    // Already ended (e.g. the phone slept long enough for it to time out): the app starts a new one
    if (!existing || existing.leftAt) return res.json({ success: true, data: { ended: true } });
    const now = Date.now();
    const session = await prisma.restaurantSession.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date(now), durationSec: existing.durationSec + activeSecondsSince(existing.lastSeenAt, now) },
      include: SESSION_INCLUDE,
    });
    emit(req, session);
    res.json({ success: true, data: { ended: false } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/:id/end', async (req, res) => {
  try {
    const existing = await prisma.restaurantSession.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.leftAt) return res.json({ success: true, data: null });
    const now = Date.now();
    const session = await prisma.restaurantSession.update({
      where: { id: existing.id },
      data: { leftAt: new Date(now), lastSeenAt: new Date(now), durationSec: existing.durationSec + activeSecondsSince(existing.lastSeenAt, now) },
      include: SESSION_INCLUDE,
    });
    emit(req, session);
    res.json({ success: true, data: null });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Back in the app shortly after putting it in the background: carry on with the same session
// rather than starting a new row. The time away isn't counted.
router.post('/:id/resume', async (req, res) => {
  try {
    const existing = await prisma.restaurantSession.findUnique({ where: { id: req.params.id } });
    // Never actually ended (the goodbye didn't arrive) — it simply carries on
    if (existing && !existing.leftAt) return res.json({ success: true, data: { resumed: true } });
    const recent = existing?.leftAt && Date.now() - existing.leftAt.getTime() <= RESUME_WINDOW_MS;
    if (!recent) return res.json({ success: true, data: { resumed: false } });
    const session = await prisma.restaurantSession.update({
      where: { id: existing.id },
      data: { leftAt: null, lastSeenAt: new Date() },
      include: SESSION_INCLUDE,
    });
    emit(req, session);
    res.json({ success: true, data: { resumed: true } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Super admin ──────────────────────────────────────────────────────────────
// Live: in the app now — not left, and checked in within the last 90 s (same rule as customer
// visits, for an app closed without a clean goodbye).
router.get('/live', authSuperAdmin, async (req, res) => {
  try {
    const sessions = await prisma.restaurantSession.findMany({
      where: { leftAt: null, lastSeenAt: { gte: new Date(Date.now() - 90 * 1000) } },
      include: SESSION_INCLUDE,
      orderBy: { enteredAt: 'desc' },
    });
    res.json({ success: true, data: sessions });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/history', authSuperAdmin, async (req, res) => {
  try {
    const { date, type } = req.query; // date: YYYY-MM-DD anchor, type: day|week|month|year
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ success: false, error: 'date required' });
    const { start, end } = getPeriodRange(type || 'day', date);
    const sessions = await prisma.restaurantSession.findMany({
      where: { enteredAt: { gte: start, lte: end } },
      include: SESSION_INCLUDE,
      orderBy: { enteredAt: 'desc' },
    });
    // Total time in the app per store over the period
    const byStore = {};
    for (const s of sessions) {
      byStore[s.restaurantId] = byStore[s.restaurantId] || { restaurantId: s.restaurantId, name: s.restaurant?.name, emoji: s.restaurant?.emoji, sessions: 0, totalSec: 0 };
      byStore[s.restaurantId].sessions += 1;
      byStore[s.restaurantId].totalSec += s.durationSec;
    }
    res.json({ success: true, data: { sessions, perStore: Object.values(byStore).sort((a, b) => b.totalSec - a.totalSec) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
