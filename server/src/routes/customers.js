// customers.js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/:id', async (req, res) => {
  try {
    const c = await prisma.customer.findUnique({ where:{ id:req.params.id }, select:{ id:true, accountType:true, name:true, email:true, phone:true, studentId:true, year:true, department:true, totalSpent:true, orderCount:true, points:true, createdAt:true } });
    if (!c) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data:c });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone, year, department } = req.body;
    const c = await prisma.customer.update({ where:{ id:req.params.id }, data:{ name, phone, year, department } });
    const { passwordHash, ...safe } = c;
    res.json({ success:true, data:safe });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.delete('/:id/guest', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ success: false, error: 'Not found' });
    if (customer.accountType !== 'guest') return res.status(403).json({ success: false, error: 'Only guest accounts can be deleted this way' });

    await prisma.review.deleteMany({ where: { customerId: req.params.id } });
    await prisma.order.deleteMany({ where: { customerId: req.params.id } });
    await prisma.customer.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/:id/favorite/:restaurantId', async (req, res) => {
  try {
    const existing = await prisma.favorite.findUnique({ where:{ customerId_restaurantId:{ customerId:req.params.id, restaurantId:req.params.restaurantId } } });
    if (existing) { await prisma.favorite.delete({ where:{ id:existing.id } }); return res.json({ success:true, data:{ favorited:false } }); }
    await prisma.favorite.create({ data:{ customerId:req.params.id, restaurantId:req.params.restaurantId } });
    res.json({ success:true, data:{ favorited:true } });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
