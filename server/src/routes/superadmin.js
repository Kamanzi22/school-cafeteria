const router = require('express').Router();
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

module.exports = router;
