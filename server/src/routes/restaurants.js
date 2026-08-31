const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authOwner, authStaff, optionalCustomer, blockViewer, requireManager } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', optionalCustomer, async (req, res) => {
  try {
    const where = { isDeleted: false, isApproved: true };
    const restaurants = await prisma.restaurant.findMany({
      where,
      select: { id:true, name:true, slug:true, emoji:true, coverColor:true, category:true, description:true, tags:true, location:true, floor:true, phone:true, offersPickup:true, offersDelivery:true, deliveryFee:true, offersCampusDelivery:true, offersOffCampusDelivery:true, campusDeliveryFee:true, offCampusDeliveryFee:true, isOpen:true, isAccepting:true, rating:true, ratingCount:true, prepTimeMin:true, prepTimeMax:true, openTime:true, closeTime:true, totalOrders:true, minOrder:true, notice:true, createdAt:true, _count:{ select:{ items:{ where:{ isAvailable:true } } } } },
      orderBy: [{ isOpen:'desc' }, { rating:'desc' }, { name:'asc' }]
    });
    res.json({ success: true, data: restaurants });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });
    const restaurants = await prisma.restaurant.findMany({
      where: {
        isDeleted: false, isApproved: true,
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
          { category: { contains: q } },
          { items: { some: { isAvailable: true, OR: [{ name: { contains: q } }, { description: { contains: q } }] } } }
        ]
      },
      select: {
        id: true, name: true, slug: true, emoji: true, coverColor: true, category: true,
        description: true, location: true, floor: true, isOpen: true, isAccepting: true,
        rating: true, ratingCount: true, prepTimeMin: true, prepTimeMax: true,
        _count: { select: { orders: true } },
        items: {
          where: { isAvailable: true, OR: [{ name: { contains: q } }, { description: { contains: q } }] },
          select: { id: true, name: true, emoji: true, price: true },
          take: 4
        }
      },
      orderBy: [{ isOpen: 'desc' }, { rating: 'desc' }]
    });

    res.json({ success: true, data: restaurants });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/admin/me', authStaff, async (req, res) => {
  try {
    const r = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId },
      include: { staff: { select:{ id:true, name:true, username:true, role:true, lastLoginAt:true, isActive:true } }, categories: { orderBy:{ sortOrder:'asc' } }, _count:{ select:{ orders:true, items:true } } }
    });
    if (!r) return res.status(404).json({ success: false, error: 'Not found' });
    const { passwordHash, ...safe } = r;
    res.json({ success: true, data: safe });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/:id', optionalCustomer, async (req, res) => {
  try {
    const r = await prisma.restaurant.findFirst({
      where: { OR:[{ id: req.params.id }, { slug: req.params.id }], isDeleted: false, isApproved: true },
      include: { categories:{ where:{ isVisible:true }, orderBy:{ sortOrder:'asc' } }, items:{ where:{ isAvailable:true }, include:{ variants:{ orderBy:{ sortOrder:'asc' } } }, orderBy:[{ isFeatured:'desc' }, { sortOrder:'asc' }] }, promotions:{ where:{ isActive:true, validFrom:{ lte: new Date() }, validUntil:{ gte: new Date() } } } }
    });
    if (!r) return res.status(404).json({ success: false, error: 'Restaurant not found' });
    let isFavorited = false;
    if (req.customer) {
      const fav = await prisma.favorite.findUnique({ where:{ customerId_restaurantId:{ customerId: req.customer.id, restaurantId: r.id } } });
      isFavorited = !!fav;
    }
    const { passwordHash, ...safe } = r;
    res.json({ success: true, data: { ...safe, isFavorited } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.patch('/admin/toggle-open', authStaff, blockViewer, async (req, res) => {
  try {
    const current = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
    const updated = await prisma.restaurant.update({ where: { id: req.restaurantId }, data: { isOpen: !current.isOpen } });
    req.app.get('io').emit('restaurant:status', { restaurantId: updated.id, isOpen: updated.isOpen });
    res.json({ success: true, data: { isOpen: updated.isOpen } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.patch('/admin/toggle-accepting', authStaff, blockViewer, async (req, res) => {
  try {
    const current = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
    const updated = await prisma.restaurant.update({ where: { id: req.restaurantId }, data: { isAccepting: !current.isAccepting } });
    res.json({ success: true, data: { isAccepting: updated.isAccepting } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/admin/settings', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const { name, description, phone, prepTimeMin, prepTimeMax, openTime, closeTime, minOrder, notice, coverColor, ownerPhone, logo, offersPickup, offersDelivery, deliveryFee, deliveryNote, offersCampusDelivery, offersOffCampusDelivery, offCampusDeliveryFee } = req.body;
    const current = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
    const bool = (v) => v === true || v === 'true';
    const updated = await prisma.restaurant.update({ where: { id: req.restaurantId }, data: {
      name, description, phone, prepTimeMin:parseInt(prepTimeMin)||10, prepTimeMax:parseInt(prepTimeMax)||20, openTime, closeTime, minOrder:parseFloat(minOrder)||0, notice, coverColor, ownerPhone,
      ...(logo !== undefined && { logo }),
      ...(offersPickup !== undefined && { offersPickup: bool(offersPickup) }),
      ...(offersDelivery !== undefined && { offersDelivery: bool(offersDelivery) }),
      ...(deliveryFee !== undefined && { deliveryFee: parseFloat(deliveryFee) || 0 }),
      ...(deliveryNote !== undefined && { deliveryNote }),
      ...(offersCampusDelivery !== undefined && { offersCampusDelivery: bool(offersCampusDelivery) }),
      ...(offersOffCampusDelivery !== undefined && { offersOffCampusDelivery: bool(offersOffCampusDelivery) }),
      // campusDeliveryFee is intentionally not settable here — it's controlled platform-wide
      // by the super admin (see /api/superadmin/restaurants/:id/campus-delivery), not per-store.
      ...(offCampusDeliveryFee !== undefined && { offCampusDeliveryFee: parseFloat(offCampusDeliveryFee) || 0 }),
    } });
    const { passwordHash, ...safe } = updated;
    req.app.get('io').emit('restaurant:updated', safe);
    res.json({ success: true, data: safe });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/admin/account', authOwner, async (req, res) => {
  try {
    const { password, reason } = req.body;
    if (!password) return res.status(400).json({ success: false, error: 'Confirm your password to delete account' });
    const restaurant = await prisma.restaurant.findUnique({ where: { id: req.restaurantId } });
    const valid = await bcrypt.compare(password, restaurant.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: 'Incorrect password' });
    await prisma.restaurant.update({ where: { id: req.restaurantId }, data: { isDeleted: true, isOpen: false, isAccepting: false, deletedAt: new Date() } });
    req.app.get('io').emit('restaurant:deleted', { restaurantId: req.restaurantId });
    res.json({ success: true, data: { message: 'Account permanently deleted. You have been removed from the customer app.' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/:id/reviews', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({ where:{ restaurantId: req.params.id }, include:{ customer:{ select:{ name:true, accountType:true } } }, orderBy:{ createdAt:'desc' }, take: 30 });
    res.json({ success: true, data: reviews });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.patch('/admin/reviews/:reviewId/reply', authStaff, blockViewer, async (req, res) => {
  try {
    const { count } = await prisma.review.updateMany({ where:{ id: req.params.reviewId, restaurantId: req.restaurantId }, data:{ reply: req.body.reply, repliedAt: new Date() } });
    if (!count) return res.status(404).json({ success: false, error: 'Review not found' });
    const r = await prisma.review.findUnique({ where:{ id: req.params.reviewId } });
    res.json({ success: true, data: r });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
