const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authStaff, blockViewer } = require('../middleware/auth');
const prisma = new PrismaClient();

// Replace all variants for a menu item inside the given transaction client
async function syncVariants(tx, menuItemId, variants) {
  await tx.itemVariant.deleteMany({ where: { menuItemId } });
  if (!Array.isArray(variants) || variants.length === 0) return;
  await tx.itemVariant.createMany({
    data: variants.map((v, i) => ({
      menuItemId,
      name: v.name?.trim() || `Variant ${i + 1}`,
      options: JSON.stringify(v.options || {}),
      priceDelta: parseFloat(v.priceDelta) || 0,
      stock: parseInt(v.stock) || 0,
      sku: v.sku || null,
      isAvailable: v.isAvailable !== false,
      sortOrder: i,
    }))
  });
}

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });
    const venueType = req.query.venueType === 'MARKETPLACE' ? 'MARKETPLACE' : 'CAFETERIA';
    const items = await prisma.menuItem.findMany({
      where: { isAvailable: true, restaurant: { venueType }, OR: [{ name: { contains: q } }, { description: { contains: q } }] },
      select: {
        id: true, name: true, description: true, price: true, emoji: true, image: true,
        prepTime: true, isFeatured: true, isVeg: true, isSpicy: true,
        trackStock: true, stock: true, hasVariants: true,
        restaurant: { select: { id: true, name: true, venueType: true, rating: true, ratingCount: true, location: true, floor: true, prepTimeMin: true, prepTimeMax: true, isOpen: true, coverColor: true } }
      },
      orderBy: [{ isFeatured: 'desc' }, { totalOrdered: 'desc' }],
      take: 30
    });
    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/admin', authStaff, async (req, res) => {
  try {
    const items = await prisma.menuItem.findMany({ where:{ restaurantId: req.restaurantId }, include:{ category:true, variants:{ orderBy:{ sortOrder:'asc' } } }, orderBy:[{ category:{ sortOrder:'asc' } }, { sortOrder:'asc' }, { name:'asc' }] });
    res.json({ success:true, data: items });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.post('/', authStaff, blockViewer, async (req, res) => {
  try {
    const { name, description, price, image, isAvailable, prepTime, sortOrder, trackStock, stock, hasVariants, sku, variants } = req.body;
    if (!name || !price) return res.status(400).json({ success:false, error:'Name and price required' });
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({ data:{
        restaurantId: req.restaurantId, name:name.trim(), description:description?.trim(), price:parseFloat(price),
        image:image||null, isAvailable:isAvailable!==false&&isAvailable!=='false', prepTime:parseInt(prepTime)||10, sortOrder:parseInt(sortOrder)||0,
        trackStock: !!trackStock, stock: stock!==undefined && stock!=='' ? parseInt(stock) : null,
        hasVariants: !!hasVariants, sku: sku || null,
      } });
      if (hasVariants) await syncVariants(tx, created.id, variants);
      return tx.menuItem.findUnique({ where:{ id: created.id }, include:{ category:true, variants:{ orderBy:{ sortOrder:'asc' } } } });
    });
    res.json({ success:true, data: item });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.put('/:id', authStaff, blockViewer, async (req, res) => {
  try {
    const item = await prisma.menuItem.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!item) return res.status(404).json({ success:false, error:'Not found' });
    const { name, description, price, image, isAvailable, prepTime, sortOrder, trackStock, stock, hasVariants, sku, variants } = req.body;
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.menuItem.update({ where:{ id:req.params.id }, data:{
        name, description, price:price?parseFloat(price):undefined,
        image:image!==undefined?(image||null):undefined,
        isAvailable:isAvailable!==undefined?(isAvailable!==false&&isAvailable!=='false'):undefined,
        prepTime:prepTime?parseInt(prepTime):undefined, sortOrder:sortOrder!==undefined?parseInt(sortOrder):undefined,
        trackStock: trackStock!==undefined ? !!trackStock : undefined,
        stock: stock!==undefined ? (stock==='' ? null : parseInt(stock)) : undefined,
        hasVariants: hasVariants!==undefined ? !!hasVariants : undefined,
        sku: sku!==undefined ? (sku || null) : undefined,
      } });
      if (variants !== undefined) await syncVariants(tx, req.params.id, hasVariants ? variants : []);
      return tx.menuItem.findUnique({ where:{ id: req.params.id }, include:{ category:true, variants:{ orderBy:{ sortOrder:'asc' } } } });
    });
    res.json({ success:true, data: updated });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.patch('/:id/toggle-available', authStaff, blockViewer, async (req, res) => {
  try {
    const item = await prisma.menuItem.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!item) return res.status(404).json({ success:false, error:'Not found' });
    const updated = await prisma.menuItem.update({ where:{ id:req.params.id }, data:{ isAvailable:!item.isAvailable } });
    res.json({ success:true, data: updated });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.patch('/:id/toggle-featured', authStaff, blockViewer, async (req, res) => {
  try {
    const item = await prisma.menuItem.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!item) return res.status(404).json({ success:false, error:'Not found' });
    const updated = await prisma.menuItem.update({ where:{ id:req.params.id }, data:{ isFeatured:!item.isFeatured } });
    res.json({ success:true, data: updated });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.delete('/:id', authStaff, blockViewer, async (req, res) => {
  try {
    const item = await prisma.menuItem.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!item) return res.status(404).json({ success:false, error:'Not found' });
    await prisma.menuItem.delete({ where:{ id:req.params.id } });
    res.json({ success:true, data:null });
  } catch(e){
    if (e.code === 'P2003') return res.status(400).json({ success:false, error:'This item has existing orders and can\'t be deleted — mark it unavailable instead.' });
    res.status(500).json({ success:false, error:e.message });
  }
});

router.post('/categories', authStaff, blockViewer, async (req, res) => {
  try {
    const cat = await prisma.menuCategory.create({ data:{ restaurantId:req.restaurantId, name:req.body.name.trim(), emoji:req.body.emoji||'🍴', sortOrder:parseInt(req.body.sortOrder)||0 } });
    res.json({ success:true, data:cat });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.put('/categories/:id', authStaff, blockViewer, async (req, res) => {
  try {
    const { name, emoji, sortOrder, isVisible } = req.body;
    await prisma.menuCategory.updateMany({ where:{ id:req.params.id, restaurantId:req.restaurantId }, data:{ name, emoji, sortOrder:parseInt(sortOrder), isVisible } });
    res.json({ success:true, data:null });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.delete('/categories/:id', authStaff, blockViewer, async (req, res) => {
  try {
    await prisma.menuCategory.deleteMany({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    res.json({ success:true, data:null });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
