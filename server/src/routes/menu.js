const router = require('express').Router();
const { authStaff, blockViewer, requireManager } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { pickAutoFeatured } = require('../lib/featured');

// Make the item's variants match the submitted list inside the given transaction client.
// Variants that come back with their id are updated in place — never recreated — so order
// history, stock restores and customers' carts keep pointing at a real variant. Rows that are
// missing from the list are deleted; rows without a known id are created.
async function syncVariants(tx, menuItemId, variants) {
  const list = Array.isArray(variants) ? variants : [];
  const existing = await tx.itemVariant.findMany({ where: { menuItemId }, select: { id: true } });
  const existingIds = new Set(existing.map(v => v.id));
  const keepIds = new Set(list.map(v => v.id).filter(id => existingIds.has(id)));
  const removed = [...existingIds].filter(id => !keepIds.has(id));
  if (removed.length) await tx.itemVariant.deleteMany({ where: { id: { in: removed } } });
  for (const [i, v] of list.entries()) {
    const data = {
      name: v.name?.trim() || `Variant ${i + 1}`,
      priceDelta: parseFloat(v.priceDelta) || 0,
      stock: Math.max(0, parseInt(v.stock) || 0),
      sku: v.sku || null,
      sortOrder: i,
    };
    if (v.options !== undefined) data.options = typeof v.options === 'string' ? v.options : JSON.stringify(v.options || {});
    if (v.isAvailable !== undefined) data.isAvailable = v.isAvailable !== false;
    if (keepIds.has(v.id)) await tx.itemVariant.update({ where: { id: v.id }, data });
    else await tx.itemVariant.create({ data: { menuItemId, isAvailable: true, ...data } });
  }
}

// null when blank, otherwise a whole number that is never negative
const parseStock = (v) => (v === undefined || v === null || v === '' ? null : Math.max(0, parseInt(v) || 0));
// A category id is only usable if it belongs to the caller's own restaurant
const ownsCategory = async (restaurantId, categoryId) => !!(await prisma.menuCategory.findFirst({ where:{ id:categoryId, restaurantId }, select:{ id:true } }));
const validPrice = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(parseFloat(v)) && parseFloat(v) >= 0;

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });
    const items = await prisma.menuItem.findMany({
      where: { isAvailable: true, OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] },
      select: {
        id: true, name: true, description: true, price: true, emoji: true, image: true,
        prepTime: true, isFeatured: true, isVeg: true, isSpicy: true,
        trackStock: true, stock: true, hasVariants: true,
        restaurant: { select: { id: true, name: true, rating: true, ratingCount: true, location: true, floor: true, prepTimeMin: true, prepTimeMax: true, isOpen: true, coverColor: true } }
      },
      orderBy: [{ isFeatured: 'desc' }, { totalOrdered: 'desc' }],
      take: 30
    });
    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Every restaurant starts with Food and Drinks, created on first use; owners can add more.
// An existing category with the same name (any case) is reused rather than duplicated. The
// advisory lock stops two simultaneous requests from each creating their own copy.
const categoryLock = (tx, restaurantId) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'menu-categories:' + restaurantId}))`;
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const DEFAULT_CATEGORIES = [{ name:'Food', emoji:'🍽️' }, { name:'Drinks', emoji:'🥤' }];
async function ensureDefaultCategories(restaurantId) {
  return prisma.$transaction(async (tx) => {
    await categoryLock(tx, restaurantId);
    const existing = await tx.menuCategory.findMany({ where:{ restaurantId }, orderBy:{ createdAt:'asc' } });
    const result = [];
    for (const [i, def] of DEFAULT_CATEGORIES.entries()) {
      let cat = existing.find(c => sameName(c.name, def.name));
      if (!cat) cat = await tx.menuCategory.create({ data:{ restaurantId, name:def.name, emoji:def.emoji, sortOrder:i } });
      result.push(cat);
    }
    return result;
  });
}

const listCategories = (restaurantId) => prisma.menuCategory.findMany({ where:{ restaurantId }, orderBy:[{ sortOrder:'asc' }, { createdAt:'asc' }] });

router.get('/categories', authStaff, async (req, res) => {
  try {
    // Read-only roles never create anything; they just see what already exists
    if (req.role !== 'viewer' && req.role !== 'staff') await ensureDefaultCategories(req.restaurantId);
    const cats = await listCategories(req.restaurantId);
    res.json({ success:true, data: cats });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.get('/admin', authStaff, async (req, res) => {
  try {
    const items = await prisma.menuItem.findMany({ where:{ restaurantId: req.restaurantId }, include:{ category:true, variants:{ orderBy:{ sortOrder:'asc' } } }, orderBy:[{ category:{ sortOrder:'asc' } }, { sortOrder:'asc' }, { name:'asc' }] });
    const restaurant = await prisma.restaurant.findUnique({ where:{ id: req.restaurantId }, select:{ featuredMode:true } });
    if (restaurant?.featuredMode === 'auto') {
      const picked = new Set(pickAutoFeatured(items));
      return res.json({ success:true, data: items.map(i => ({ ...i, isFeatured: picked.has(i.id) })) });
    }
    res.json({ success:true, data: items });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.post('/', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const { name, description, price, image, isAvailable, prepTime, sortOrder, trackStock, stock, hasVariants, sku, variants, categoryId } = req.body;
    if (!name?.trim() || price === undefined || price === null || price === '') return res.status(400).json({ success:false, error:'Name and price required' });
    if (!validPrice(price)) return res.status(400).json({ success:false, error:'Price must be a number, 0 or more' });
    if (categoryId && !(await ownsCategory(req.restaurantId, categoryId))) return res.status(400).json({ success:false, error:'Category not found' });
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({ data:{
        restaurantId: req.restaurantId, categoryId: categoryId || null, name:name.trim(), description:description?.trim(), price:parseFloat(price),
        image:image||null, isAvailable:isAvailable!==false&&isAvailable!=='false', prepTime:parseInt(prepTime)||10, sortOrder:parseInt(sortOrder)||0,
        trackStock: !!trackStock, stock: parseStock(stock),
        hasVariants: !!hasVariants, sku: sku || null,
      } });
      if (hasVariants) await syncVariants(tx, created.id, variants);
      return tx.menuItem.findUnique({ where:{ id: created.id }, include:{ category:true, variants:{ orderBy:{ sortOrder:'asc' } } } });
    });
    res.json({ success:true, data: item });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.put('/:id', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const item = await prisma.menuItem.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!item) return res.status(404).json({ success:false, error:'Not found' });
    const { name, description, price, image, isAvailable, prepTime, sortOrder, trackStock, stock, hasVariants, sku, variants, categoryId } = req.body;
    if (name !== undefined && !String(name).trim()) return res.status(400).json({ success:false, error:'Name can\'t be empty' });
    if (price !== undefined && !validPrice(price)) return res.status(400).json({ success:false, error:'Price must be a number, 0 or more' });
    if (categoryId && !(await ownsCategory(req.restaurantId, categoryId))) return res.status(400).json({ success:false, error:'Category not found' });
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.menuItem.update({ where:{ id:req.params.id }, data:{
        categoryId: categoryId!==undefined ? (categoryId || null) : undefined,
        name:name!==undefined?String(name).trim():undefined, description:description!==undefined?description?.trim():undefined, price:price!==undefined?parseFloat(price):undefined,
        image:image!==undefined?(image||null):undefined,
        isAvailable:isAvailable!==undefined?(isAvailable!==false&&isAvailable!=='false'):undefined,
        prepTime:prepTime?parseInt(prepTime):undefined, sortOrder:sortOrder!==undefined?parseInt(sortOrder):undefined,
        trackStock: trackStock!==undefined ? !!trackStock : undefined,
        stock: stock!==undefined ? parseStock(stock) : undefined,
        hasVariants: hasVariants!==undefined ? !!hasVariants : undefined,
        sku: sku!==undefined ? (sku || null) : undefined,
      } });
      if (variants !== undefined) await syncVariants(tx, req.params.id, hasVariants ? variants : []);
      return tx.menuItem.findUnique({ where:{ id: req.params.id }, include:{ category:true, variants:{ orderBy:{ sortOrder:'asc' } } } });
    });
    res.json({ success:true, data: updated });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.patch('/:id/toggle-available', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const item = await prisma.menuItem.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!item) return res.status(404).json({ success:false, error:'Not found' });
    const updated = await prisma.menuItem.update({ where:{ id:req.params.id }, data:{ isAvailable:!item.isAvailable } });
    res.json({ success:true, data: updated });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.patch('/:id/toggle-featured', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const item = await prisma.menuItem.findFirst({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    if (!item) return res.status(404).json({ success:false, error:'Not found' });
    const restaurant = await prisma.restaurant.findUnique({ where:{ id: req.restaurantId }, select:{ featuredMode:true } });
    if (restaurant?.featuredMode === 'auto') return res.status(409).json({ success:false, error:'Featured meals are set to Automatic. Switch to Manual to choose them yourself.' });
    const updated = await prisma.menuItem.update({ where:{ id:req.params.id }, data:{ isFeatured:!item.isFeatured } });
    res.json({ success:true, data: updated });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.delete('/:id', authStaff, blockViewer, requireManager, async (req, res) => {
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

router.post('/categories', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const name = String(req.body.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name) return res.status(400).json({ success:false, error:'Category name required' });
    if (name.length > 40) return res.status(400).json({ success:false, error:'Category name must be 40 characters or less' });
    // Typing a name that already exists (any case) hands back the existing category instead of a duplicate.
    // A new one goes after everything already there (Food and Drinks are 0 and 1).
    const cat = await prisma.$transaction(async (tx) => {
      await categoryLock(tx, req.restaurantId);
      const existing = await tx.menuCategory.findMany({ where:{ restaurantId:req.restaurantId } });
      const match = existing.find(c => sameName(c.name, name));
      if (match) return match;
      const sortOrder = Math.max(1, ...existing.map(c => c.sortOrder)) + 1;
      return tx.menuCategory.create({ data:{ restaurantId:req.restaurantId, name, emoji:req.body.emoji||'🍴', sortOrder } });
    });
    res.json({ success:true, data:cat });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.put('/categories/:id', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    const { name, emoji, sortOrder, isVisible } = req.body;
    await prisma.menuCategory.updateMany({ where:{ id:req.params.id, restaurantId:req.restaurantId }, data:{ name, emoji, sortOrder:parseInt(sortOrder), isVisible } });
    res.json({ success:true, data:null });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

router.delete('/categories/:id', authStaff, blockViewer, requireManager, async (req, res) => {
  try {
    await prisma.menuCategory.deleteMany({ where:{ id:req.params.id, restaurantId:req.restaurantId } });
    res.json({ success:true, data:null });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
