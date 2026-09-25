const router = require('express').Router();
const { authStaff, blockViewer, requireManager } = require('../middleware/auth');
const prisma = require('../lib/prisma');

router.get('/admin', authStaff, async (req, res) => {
  try { res.json({ success:true, data: await prisma.promotion.findMany({ where:{ restaurantId:req.restaurantId }, orderBy:{ createdAt:'desc' } }) }); }
  catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// Turns the promo form into Prisma data, or returns { error } for anything a customer would trip
// over (e.g. 150% off, or an end date before the start). Shared by create and edit.
function promoData(body) {
  const { code, title, value, description, type, minOrder, maxDiscount, usageLimit, validFrom, validUntil } = body;
  if (!code?.trim() || !title?.trim() || value === undefined || value === '') return { error:'Code, title and discount value are required' };
  const kind = type === 'fixed' ? 'fixed' : 'percentage';
  const amount = parseFloat(value);
  if (!(amount > 0)) return { error:'Discount value must be more than 0' };
  if (kind === 'percentage' && amount > 100) return { error:'A percentage discount can\'t be more than 100%' };
  const from = new Date(validFrom), until = new Date(validUntil);
  if (isNaN(from) || isNaN(until)) return { error:'Valid from and valid until dates are required' };
  if (until <= from) return { error:'"Valid until" must be after "valid from"' };
  return { data:{
    code:code.toUpperCase().trim(), title:title.trim(), description:description?.trim() || null, type:kind, value:amount,
    minOrder:parseFloat(minOrder)||0, maxDiscount:maxDiscount?parseFloat(maxDiscount):null, usageLimit:usageLimit?parseInt(usageLimit):null,
    validFrom:from, validUntil:until,
  } };
}

// Customers' open menu pages refetch on this, so offer changes show up without a reload.
const notifyPromosChanged = (req) => req.app.get('io').emit('menu:updated', { restaurantId: req.restaurantId });

router.post('/', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const { data, error } = promoData(req.body);
    if (error) return res.status(400).json({ success:false, error });
    const promo = await prisma.promotion.create({ data:{ ...data, restaurantId:req.restaurantId } });
    notifyPromosChanged(req);
    res.json({ success:true, data:promo });
  } catch(e){
    if (e.code === 'P2002') return res.status(409).json({ success:false, error:'You already have a promo with this code' });
    res.status(500).json({ success:false, error:e.message });
  }
});

// Edit a promotion, including one that's already live — changes apply to orders placed from
// now on. usageCount is kept, so lowering usageLimit below it simply ends the promo.
router.put('/:id', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const existing = await prisma.promotion.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!existing) return res.status(404).json({ success:false, error:'Not found' });
    const { data, error } = promoData(req.body);
    if (error) return res.status(400).json({ success:false, error });
    const promo = await prisma.promotion.update({ where:{ id:existing.id }, data });
    notifyPromosChanged(req);
    res.json({ success:true, data:promo });
  } catch(e){
    if (e.code === 'P2002') return res.status(409).json({ success:false, error:'You already have a promo with this code' });
    res.status(500).json({ success:false, error:e.message });
  }
});

router.patch('/:id/toggle', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const p = await prisma.promotion.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!p) return res.status(404).json({ success:false, error:'Not found' });
    const updated = await prisma.promotion.update({ where:{ id:req.params.id }, data:{ isActive:!p.isActive } });
    notifyPromosChanged(req);
    res.json({ success:true, data:updated });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.delete('/:id', authStaff, blockViewer, requireManager, async (req, res) => {
  try { await prisma.promotion.deleteMany({ where:{ id:req.params.id, restaurantId:req.restaurantId } }); notifyPromosChanged(req); res.json({ success:true, data:null }); }
  catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.post('/validate', async (req, res) => {
  try {
    const { code, restaurantId, subtotal } = req.body;
    if (!code?.trim() || !restaurantId) return res.status(400).json({ success:false, error:'Enter a promo code' });
    const promo = await prisma.promotion.findFirst({ where:{ code:code.trim().toUpperCase(), restaurantId, isActive:true, validFrom:{ lte:new Date() }, validUntil:{ gte:new Date() } } });
    if (!promo) return res.status(404).json({ success:false, error:'Invalid or expired code' });
    if (subtotal < promo.minOrder) return res.status(400).json({ success:false, error:`Min order ${promo.minOrder.toLocaleString()} RWF` });
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return res.status(400).json({ success:false, error:'Promo usage limit reached' });
    let discount = promo.type==='percentage' ? subtotal*(promo.value/100) : promo.value;
    if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
    discount = Math.min(discount, subtotal);
    res.json({ success:true, data:{ promo, discount } });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
