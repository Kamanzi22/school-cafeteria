const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authStaff, blockViewer } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/admin', authStaff, async (req, res) => {
  try { res.json({ success:true, data: await prisma.promotion.findMany({ where:{ restaurantId:req.restaurantId }, orderBy:{ createdAt:'desc' } }) }); }
  catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.post('/', authStaff, blockViewer, async (req, res) => {
  try {
    const { code, title, value, description, type, minOrder, maxDiscount, usageLimit, validFrom, validUntil } = req.body;
    if (!code?.trim() || !title?.trim() || value === undefined || value === '') return res.status(400).json({ success:false, error:'Code, title and discount value are required' });
    const promo = await prisma.promotion.create({ data:{ restaurantId:req.restaurantId, code:code.toUpperCase().trim(), title, description, type, value:parseFloat(value), minOrder:parseFloat(minOrder)||0, maxDiscount:maxDiscount?parseFloat(maxDiscount):null, usageLimit:usageLimit?parseInt(usageLimit):null, validFrom:new Date(validFrom), validUntil:new Date(validUntil) } });
    res.json({ success:true, data:promo });
  } catch(e){
    if (e.code === 'P2002') return res.status(409).json({ success:false, error:'You already have a promo with this code' });
    res.status(500).json({ success:false, error:e.message });
  }
});

router.patch('/:id/toggle', authStaff, blockViewer, async (req, res) => {
  try {
    const p = await prisma.promotion.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!p) return res.status(404).json({ success:false, error:'Not found' });
    res.json({ success:true, data: await prisma.promotion.update({ where:{ id:req.params.id }, data:{ isActive:!p.isActive } }) });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.delete('/:id', authStaff, blockViewer, async (req, res) => {
  try { await prisma.promotion.deleteMany({ where:{ id:req.params.id, restaurantId:req.restaurantId } }); res.json({ success:true, data:null }); }
  catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.post('/validate', async (req, res) => {
  try {
    const { code, restaurantId, subtotal } = req.body;
    const promo = await prisma.promotion.findFirst({ where:{ code:code.toUpperCase(), restaurantId, isActive:true, validFrom:{ lte:new Date() }, validUntil:{ gte:new Date() } } });
    if (!promo) return res.status(404).json({ success:false, error:'Invalid or expired code' });
    if (subtotal < promo.minOrder) return res.status(400).json({ success:false, error:`Min order ${promo.minOrder.toLocaleString()} RWF` });
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return res.status(400).json({ success:false, error:'Promo usage limit reached' });
    let discount = promo.type==='percentage' ? subtotal*(promo.value/100) : promo.value;
    if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
    res.json({ success:true, data:{ promo, discount } });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
