const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authStaff, optionalCustomer, blockViewer } = require('../middleware/auth');
const prisma = new PrismaClient();

const genNum = () => 'CC-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,5).toUpperCase();

// Thrown for expected, user-correctable order problems (out of stock, missing option) so the
// route handler can respond 400 instead of masking them as server errors.
class OrderValidationError extends Error {}

// Give back stock that was decremented when the order was placed — variant stock if this
// was a variant line, otherwise the simple-tracked stock on the menu item.
async function restoreStock(tx, orderId) {
  const items = await tx.orderItem.findMany({ where:{ orderId }, include:{ menuItem:{ select:{ trackStock:true } } } });
  for (const oi of items) {
    if (oi.variantId) {
      await tx.itemVariant.update({ where:{ id:oi.variantId }, data:{ stock:{ increment:oi.quantity } } });
    } else if (oi.menuItem?.trackStock) {
      await tx.menuItem.update({ where:{ id:oi.menuItemId }, data:{ stock:{ increment:oi.quantity } } });
    }
  }
}

const ORDER_INCLUDE = {
  items: { include: { menuItem: { select:{ name:true, emoji:true, price:true } }, variant: { select:{ name:true } } } },
  customer: { select:{ id:true, name:true, email:true, studentId:true, accountType:true, phone:true } },
  restaurant: { select:{ id:true, name:true, emoji:true, location:true, phone:true, coverColor:true, venueType:true, storeMode:true, offersPickup:true, offersDelivery:true, offersCampusDelivery:true, offersOffCampusDelivery:true } },
  review: true, statusHistory: { orderBy:{ createdAt:'asc' } }
};

// ── Place order ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { customerId, guestToken, guestName, guestPhone, restaurantId, items, specialInstructions, paymentMethod, promoCode, fulfillmentType, deliveryLocation, deliveryScope } = req.body;
    if (!items?.length) return res.status(400).json({ success:false, error:'No items in order' });

    const restaurant = await prisma.restaurant.findFirst({ where:{ id:restaurantId, isDeleted:false } });
    if (!restaurant) return res.status(404).json({ success:false, error:'Restaurant not found' });
    if (!restaurant.isOpen) return res.status(400).json({ success:false, error:'This restaurant is currently closed' });
    if (!restaurant.isAccepting) return res.status(400).json({ success:false, error:'This restaurant is not accepting orders right now' });

    const wantsDelivery = fulfillmentType === 'delivery';
    if (wantsDelivery && !restaurant.offersDelivery) return res.status(400).json({ success:false, error:'This store does not offer delivery' });
    if (!wantsDelivery && !restaurant.offersPickup) return res.status(400).json({ success:false, error:'This store does not offer pickup' });
    if (wantsDelivery && !deliveryLocation?.trim()) return res.status(400).json({ success:false, error:'Delivery location is required' });
    const scope = deliveryScope === 'off_campus' ? 'off_campus' : 'campus';
    if (wantsDelivery && scope === 'campus' && !restaurant.offersCampusDelivery) return res.status(400).json({ success:false, error:'This store does not deliver on campus' });
    if (wantsDelivery && scope === 'off_campus' && !restaurant.offersOffCampusDelivery) return res.status(400).json({ success:false, error:'This store does not deliver off campus' });

    // Resolve customer — works for registered, guest token, or anonymous
    let customer;
    if (customerId) {
      customer = await prisma.customer.findUnique({ where:{ id:customerId } });
    } else if (guestToken) {
      customer = await prisma.customer.findUnique({ where:{ guestToken } });
      if (!customer) {
        customer = await prisma.customer.create({ data:{ accountType:'guest', name:guestName||'Guest', guestToken, phone:guestPhone } });
      }
    } else {
      // Completely anonymous — create a one-time guest
      customer = await prisma.customer.create({ data:{ accountType:'guest', name:guestName||'Guest', phone:guestPhone, guestToken: require('uuid').v4() } });
    }

    const menuIds = items.map(i => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({ where:{ id:{ in:menuIds }, restaurantId, isAvailable:true }, include:{ variants:true } });
    if (menuItems.length !== menuIds.length) return res.status(400).json({ success:false, error:'One or more items are unavailable' });

    let subtotal = 0;
    const orderItems = items.map(item => {
      const m = menuItems.find(mi => mi.id === item.menuItemId);
      let unitPrice = m.price;
      let variant = null;
      if (item.variantId) {
        variant = m.variants.find(v => v.id === item.variantId);
        if (!variant || !variant.isAvailable) throw new OrderValidationError(`${m.name}: selected option is unavailable`);
        unitPrice += variant.priceDelta;
      } else if (m.hasVariants) {
        throw new OrderValidationError(`${m.name}: please select an option`);
      }
      const sub = unitPrice * item.quantity;
      subtotal += sub;
      return { menuItemId:m.id, menuItemName:m.name, menuItemEmoji:m.emoji, variantId:variant?.id||null, variantName:variant?.name||null, quantity:item.quantity, unitPrice, subtotal:sub, notes:item.notes||null };
    });

    if (subtotal < restaurant.minOrder) return res.status(400).json({ success:false, error:`Minimum order is ${restaurant.minOrder.toLocaleString()} RWF` });

    let discountAmount = 0;
    if (promoCode) {
      const promo = await prisma.promotion.findFirst({ where:{ restaurantId, code:promoCode.toUpperCase(), isActive:true, validFrom:{ lte:new Date() }, validUntil:{ gte:new Date() } } });
      if (promo && subtotal >= promo.minOrder) {
        discountAmount = promo.type === 'percentage' ? subtotal * (promo.value/100) : promo.value;
        if (promo.maxDiscount) discountAmount = Math.min(discountAmount, promo.maxDiscount);
        await prisma.promotion.update({ where:{ id:promo.id }, data:{ usageCount:{ increment:1 } } });
      }
    }

    const deliveryFee = wantsDelivery ? (scope === 'off_campus' ? restaurant.offCampusDeliveryFee : restaurant.campusDeliveryFee) : 0;
    const taxAmount = (subtotal - discountAmount) * (restaurant.taxRate/100);
    const totalPrice = subtotal - discountAmount + taxAmount + deliveryFee;
    const estimatedReadyAt = new Date(Date.now() + ((restaurant.prepTimeMin + restaurant.prepTimeMax)/2)*60000);

    const order = await prisma.$transaction(async (tx) => {
      // Decrement stock, aborting the whole order if anything is short
      for (const oi of orderItems) {
        if (oi.variantId) {
          const result = await tx.itemVariant.updateMany({ where:{ id:oi.variantId, stock:{ gte:oi.quantity } }, data:{ stock:{ decrement:oi.quantity } } });
          if (result.count === 0) throw new OrderValidationError(`${oi.menuItemName} (${oi.variantName}) is out of stock`);
        } else {
          const m = menuItems.find(mi => mi.id === oi.menuItemId);
          if (m.trackStock) {
            const result = await tx.menuItem.updateMany({ where:{ id:oi.menuItemId, stock:{ gte:oi.quantity } }, data:{ stock:{ decrement:oi.quantity } } });
            if (result.count === 0) throw new OrderValidationError(`${oi.menuItemName} is out of stock`);
          }
        }
      }

      const created = await tx.order.create({
        data: { orderNumber:genNum(), customerId:customer.id, restaurantId, subtotal, taxAmount, discountAmount, totalPrice, fulfillmentType:wantsDelivery?'delivery':'pickup', deliveryScope:wantsDelivery?scope:null, deliveryLocation:wantsDelivery?deliveryLocation.trim():null, deliveryFee, specialInstructions, guestName: customer.accountType==='guest'?(guestName||customer.name):null, guestPhone: guestPhone||null, paymentMethod:paymentMethod||'cash', estimatedReadyAt, items:{ create:orderItems }, statusHistory:{ create:[{ status:'pending', note:'Order placed' }] } },
        include: ORDER_INCLUDE
      });

      await tx.customer.update({ where:{ id:customer.id }, data:{ totalSpent:{ increment:totalPrice }, orderCount:{ increment:1 } } });
      await tx.restaurant.update({ where:{ id:restaurantId }, data:{ totalOrders:{ increment:1 }, totalRevenue:{ increment:totalPrice } } });
      for (const item of orderItems) {
        await tx.menuItem.update({ where:{ id:item.menuItemId }, data:{ totalOrdered:{ increment:item.quantity } } });
      }
      return created;
    });

    req.app.get('io').to(`restaurant:${restaurantId}`).emit('order:new', order);
    res.json({ success:true, data: order });
  } catch(e){
    if (e instanceof OrderValidationError) return res.status(400).json({ success:false, error:e.message });
    res.status(500).json({ success:false, error:e.message });
  }
});

// ── Get single order ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where:{ id:req.params.id }, include:ORDER_INCLUDE });
    if (!order) return res.status(404).json({ success:false, error:'Order not found' });
    res.json({ success:true, data:order });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// ── Customer order history ────────────────────────────────────────────────────
router.get('/customer/:customerId/history', optionalCustomer, async (req, res) => {
  try {
    if (!req.customer || req.customer.id !== req.params.customerId) return res.status(403).json({ success:false, error:'Forbidden' });
    const orders = await prisma.order.findMany({
      where:{ customerId: req.params.customerId },
      include:{ items:{ include:{ menuItem:{ select:{ name:true, emoji:true } } } }, restaurant:{ select:{ id:true, name:true, emoji:true, coverColor:true } }, review:true },
      orderBy:{ createdAt:'desc' }
    });
    res.json({ success:true, data:orders });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// ── Guest order lookup by token ───────────────────────────────────────────────
router.get('/guest/:guestToken/history', async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({ where:{ guestToken:req.params.guestToken } });
    if (!customer) return res.json({ success:true, data:[] });
    const orders = await prisma.order.findMany({ where:{ customerId:customer.id }, include:{ items:true, restaurant:{ select:{ id:true, name:true, emoji:true, coverColor:true } }, review:true }, orderBy:{ createdAt:'desc' } });
    res.json({ success:true, data:orders });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// ── Restaurant get orders (admin) ─────────────────────────────────────────────
router.get('/restaurant/:restaurantId/all', authStaff, async (req, res) => {
  try {
    if (req.restaurantId !== req.params.restaurantId) return res.status(403).json({ success:false, error:'Forbidden' });
    const { status, date } = req.query;
    const where = { restaurantId: req.params.restaurantId };
    if (status && status !== 'all') where.status = status;
    if (date) {
      const d = new Date(date); const ds = new Date(d); ds.setHours(0,0,0,0); const de = new Date(d); de.setHours(23,59,59,999);
      where.createdAt = { gte:ds, lte:de };
    } else {
      const today = new Date(); today.setHours(0,0,0,0);
      where.createdAt = { gte:today };
    }
    const orders = await prisma.order.findMany({ where, include:ORDER_INCLUDE, orderBy:{ createdAt:'desc' }, take:200 });
    res.json({ success:true, data:orders });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// ── Update order status ───────────────────────────────────────────────────────
const STATUS_TIMES = { confirmed:'confirmedAt', preparing:'preparingAt', ready:'readyAt', picked_up:'pickedUpAt', cancelled:'cancelledAt' };

router.patch('/:id/status', authStaff, blockViewer, async (req, res) => {
  try {
    const { status, cancelReason, estimatedReadyAt } = req.body;
    const order = await prisma.order.findUnique({ where:{ id:req.params.id } });
    if (!order || order.restaurantId !== req.restaurantId) return res.status(403).json({ success:false, error:'Forbidden' });
    const data = { status };
    if (STATUS_TIMES[status]) data[STATUS_TIMES[status]] = new Date();
    if (cancelReason) { data.cancelReason = cancelReason; data.cancelledBy = 'restaurant'; }
    if (estimatedReadyAt) data.estimatedReadyAt = new Date(estimatedReadyAt);
    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'cancelled') {
        // Atomic guard: only the request that actually flips pending/etc. → cancelled restores stock,
        // so a customer-cancel and a staff-cancel racing on the same order can't double-credit inventory.
        const guard = await tx.order.updateMany({ where:{ id:req.params.id, status:{ not:'cancelled' } }, data });
        if (guard.count > 0) await restoreStock(tx, order.id);
      } else {
        await tx.order.updateMany({ where:{ id:req.params.id }, data });
      }
      return tx.order.update({ where:{ id:req.params.id }, data:{ statusHistory:{ create:[{ status, note:cancelReason||null }] } }, include:ORDER_INCLUDE });
    });
    req.app.get('io').to(`order:${req.params.id}`).emit('order:updated', updated);
    req.app.get('io').to(`restaurant:${order.restaurantId}`).emit('order:statusChanged', updated);
    res.json({ success:true, data:updated });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// ── Customer cancel ───────────────────────────────────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where:{ id:req.params.id } });
    if (!order) return res.status(404).json({ success:false, error:'Order not found' });
    if (order.status !== 'pending') return res.status(400).json({ success:false, error:'Can only cancel pending orders' });
    const updated = await prisma.$transaction(async (tx) => {
      const guard = await tx.order.updateMany({ where:{ id:req.params.id, status:'pending' }, data:{ status:'cancelled', cancelledAt:new Date(), cancelReason:req.body.reason||'Cancelled by customer', cancelledBy:'customer' } });
      if (guard.count === 0) throw new OrderValidationError('Can only cancel pending orders');
      await restoreStock(tx, order.id);
      return tx.order.update({ where:{ id:req.params.id }, data:{ statusHistory:{ create:[{ status:'cancelled', note:req.body.reason }] } }, include:ORDER_INCLUDE });
    });
    req.app.get('io').to(`restaurant:${order.restaurantId}`).emit('order:cancelled', updated);
    res.json({ success:true, data:updated });
  } catch(e){
    if (e instanceof OrderValidationError) return res.status(400).json({ success:false, error:e.message });
    res.status(500).json({ success:false, error:e.message });
  }
});

module.exports = router;
