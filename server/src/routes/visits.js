const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { optionalCustomer } = require('../middleware/auth');
const prisma = new PrismaClient();

const emit = (req, visit) => {
  req.app.get('io').to('superadmin').emit('visit:update', visit);
};

// A visit is identified by its own unguessable id (capability link), same pattern as order
// tracking — heartbeat/end don't need auth beyond knowing that id.
router.post('/start', optionalCustomer, async (req, res) => {
  try {
    const { restaurantId, anonymousId } = req.body;
    if (!restaurantId) return res.status(400).json({ success: false, error: 'restaurantId required' });

    let visitorType, visitorId, visitorName;
    if (req.customer) {
      visitorType = req.customer.accountType === 'registered' ? 'account' : 'guest';
      visitorId = req.customer.id;
      visitorName = req.customer.name;
    } else {
      if (!anonymousId) return res.status(400).json({ success: false, error: 'anonymousId required' });
      visitorType = 'anonymous';
      visitorId = anonymousId;
      visitorName = null;
    }

    const visit = await prisma.restaurantVisit.create({
      data: { restaurantId, visitorType, visitorId, visitorName },
      include: { restaurant: { select: { name: true, emoji: true } } },
    });
    emit(req, visit);
    res.json({ success: true, data: { id: visit.id } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/:id/heartbeat', async (req, res) => {
  try {
    const existing = await prisma.restaurantVisit.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.leftAt) return res.json({ success: true, data: null });
    const durationSec = Math.round((Date.now() - existing.enteredAt.getTime()) / 1000);
    const visit = await prisma.restaurantVisit.update({
      where: { id: req.params.id },
      data: { lastSeenAt: new Date(), durationSec },
      include: { restaurant: { select: { name: true, emoji: true } } },
    });
    emit(req, visit);
    res.json({ success: true, data: null });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Hit via navigator.sendBeacon on page unload — no response body is read, so keep it terse.
router.post('/:id/end', async (req, res) => {
  try {
    const existing = await prisma.restaurantVisit.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.leftAt) return res.json({ success: true, data: null });
    const now = new Date();
    const durationSec = Math.round((now.getTime() - existing.enteredAt.getTime()) / 1000);
    const visit = await prisma.restaurantVisit.update({
      where: { id: req.params.id },
      data: { leftAt: now, lastSeenAt: now, durationSec },
      include: { restaurant: { select: { name: true, emoji: true } } },
    });
    emit(req, visit);
    res.json({ success: true, data: null });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
