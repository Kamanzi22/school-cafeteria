const router = require('express').Router();
const { authStaff, optionalCustomer, blockViewer } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { notifyOrderStatus, notifyNewOrder } = require('../lib/notifications');

// Statuses an order sits in until it's finished (picked up / delivered) or cancelled
const OPEN_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way'];
const ALL_STATUSES = [...OPEN_STATUSES, 'picked_up', 'cancelled'];

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
  customer: { select:{ id:true, name:true, email:true, accountType:true, phone:true } },
  restaurant: { select:{ id:true, name:true, emoji:true, location:true, phone:true, coverColor:true, offersPickup:true, offersDelivery:true, offersCampusDelivery:true, offersOffCampusDelivery:true } },
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
      if (promo && subtotal >= promo.minOrder && !(promo.usageLimit && promo.usageCount >= promo.usageLimit)) {
        discountAmount = promo.type === 'percentage' ? subtotal * (promo.value/100) : promo.value;
        if (promo.maxDiscount) discountAmount = Math.min(discountAmount, promo.maxDiscount);
        discountAmount = Math.min(discountAmount, subtotal);
        // Guarded by usageLimit in the where clause so a race between two concurrent orders
        // can't both increment past the cap — whichever loses the race just applies no discount.
        const { count } = await prisma.promotion.updateMany({
          where:{ id:promo.id, ...(promo.usageLimit ? { usageCount:{ lt:promo.usageLimit } } : {}) },
          data:{ usageCount:{ increment:1 } }
        });
        if (!count) discountAmount = 0;
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
    if (order.fulfillmentType === 'delivery') req.app.get('io').to('superadmin').to('delivery').emit('delivery:order', order);
    notifyNewOrder(order);
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
      where:{ customerId: req.params.customerId, hiddenByCustomer:false },
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
    const orders = await prisma.order.findMany({ where:{ customerId:customer.id, hiddenByCustomer:false }, include:{ items:true, restaurant:{ select:{ id:true, name:true, emoji:true, coverColor:true } }, review:true }, orderBy:{ createdAt:'desc' } });
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
      // Today's list = orders placed today plus any picked up today, so revenue counted at pickup is never missing an order,
      // plus any order from an earlier day that was never finished — otherwise it drops off the board and stays stuck forever
      const today = new Date(); today.setHours(0,0,0,0);
      where.OR = [{ createdAt:{ gte:today } }, { pickedUpAt:{ gte:today } }, { status:{ in:OPEN_STATUSES } }];
    }
    const orders = await prisma.order.findMany({ where, include:ORDER_INCLUDE, orderBy:{ createdAt:'desc' }, take:200 });
    res.json({ success:true, data:orders });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// ── Restaurant order history (paginated, any date range) ─────────────────────
router.get('/restaurant/:restaurantId/history', authStaff, async (req, res) => {
  try {
    if (req.restaurantId !== req.params.restaurantId) return res.status(403).json({ success:false, error:'Forbidden' });
    const { status, from, to, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 30));
    const where = { restaurantId: req.params.restaurantId };
    if (status === 'open') where.status = { in:OPEN_STATUSES };
    else if (status && status !== 'all') where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) { const d = new Date(from); d.setHours(0,0,0,0); where.createdAt.gte = d; }
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); where.createdAt.lte = d; }
    }
    const search = typeof q === 'string' ? q.trim() : '';
    if (search) {
      where.OR = [
        { orderNumber:{ contains:search, mode:'insensitive' } },
        { guestName:{ contains:search, mode:'insensitive' } },
        { customer:{ name:{ contains:search, mode:'insensitive' } } },
      ];
    }
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, include:ORDER_INCLUDE, orderBy:{ createdAt:'desc' }, skip:(page-1)*pageSize, take:pageSize }),
      prisma.order.count({ where }),
    ]);
    res.json({ success:true, data:orders, total, page, pageSize });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// ── Update order status ───────────────────────────────────────────────────────
const STATUS_TIMES = { confirmed:'confirmedAt', preparing:'preparingAt', ready:'readyAt', on_the_way:'onTheWayAt', picked_up:'pickedUpAt', cancelled:'cancelledAt' };

router.patch('/:id/status', authStaff, blockViewer, async (req, res) => {
  try {
    const { status, estimatedReadyAt } = req.body;
    // The restaurant's note to the customer explaining the cancellation (shown on their order page
    // and in the notification). Capped so a pasted essay can't bloat the notification payload.
    const cancelReason = typeof req.body.cancelReason === 'string' ? req.body.cancelReason.trim().slice(0, 300) : '';
    // Staff-only note for a correction made from order history (e.g. "customer collected it yesterday")
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
    // History corrections can opt out of pinging the customer about an order that's long finished
    const notify = req.body.notify !== false;
    if (!ALL_STATUSES.includes(status)) return res.status(400).json({ success:false, error:'Invalid status' });
    const order = await prisma.order.findUnique({ where:{ id:req.params.id } });
    if (!order || order.restaurantId !== req.restaurantId) return res.status(403).json({ success:false, error:'Forbidden' });
    if (order.status === 'cancelled') return res.status(400).json({ success:false, error:'This order is already cancelled' });
    if (status === 'cancelled' && order.status === 'picked_up') return res.status(400).json({ success:false, error:'This order was already picked up' });
    if (status === 'on_the_way' && order.fulfillmentType !== 'delivery') return res.status(400).json({ success:false, error:'Only delivery orders can be on the way' });
    const data = { status };
    // Stamp the time only when the status actually changes, so re-sending 'picked_up' can't move an order's revenue to another day
    if (STATUS_TIMES[status] && order.status !== status) data[STATUS_TIMES[status]] = new Date();
    // Undoing a mistaken pickup: clear the stamp so the order stops counting toward that day's revenue
    if (order.status === 'picked_up' && status !== 'picked_up') data.pickedUpAt = null;
    if (status === 'cancelled') { data.cancelReason = cancelReason || 'Cancelled by restaurant'; data.cancelledBy = 'restaurant'; }
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
      return tx.order.update({ where:{ id:req.params.id }, data:{ statusHistory:{ create:[{ status, note:note || (status === 'cancelled' ? data.cancelReason : null) }] } }, include:ORDER_INCLUDE });
    });
    req.app.get('io').to(`order:${req.params.id}`).emit('order:updated', updated);
    req.app.get('io').to(`restaurant:${order.restaurantId}`).emit('order:statusChanged', updated);
    if (updated.fulfillmentType === 'delivery') req.app.get('io').to('superadmin').to('delivery').emit('delivery:order', updated);
    // Only on an actual transition — re-sending the same status must not notify the customer a
    // second time. Fire-and-forget: the push/email shouldn't hold up the response.
    if (notify && status !== order.status) notifyOrderStatus(req.app.get('io'), updated);
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
    if (updated.fulfillmentType === 'delivery') req.app.get('io').to('superadmin').to('delivery').emit('delivery:order', updated);
    res.json({ success:true, data:updated });
  } catch(e){
    if (e instanceof OrderValidationError) return res.status(400).json({ success:false, error:e.message });
    res.status(500).json({ success:false, error:e.message });
  }
});

// ── Customer delete from history ──────────────────────────────────────────────
// Only hides the order from the customer's history — the restaurant keeps it for sales and
// analytics. A still-pending order is cancelled first (same as the cancel route above) so the
// restaurant doesn't make food for an order the customer has thrown away.
router.delete('/:id', optionalCustomer, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where:{ id:req.params.id } });
    if (!order) return res.status(404).json({ success:false, error:'Order not found' });
    if (!req.customer || req.customer.id !== order.customerId) return res.status(403).json({ success:false, error:'Forbidden' });

    const { cancelled, updated } = await prisma.$transaction(async (tx) => {
      const guard = await tx.order.updateMany({ where:{ id:order.id, status:'pending' }, data:{ status:'cancelled', cancelledAt:new Date(), cancelReason:'Cancelled by customer', cancelledBy:'customer' } });
      if (guard.count > 0) {
        await restoreStock(tx, order.id);
        await tx.orderStatusHistory.create({ data:{ orderId:order.id, status:'cancelled', note:'Deleted by customer' } });
      }
      const updated = await tx.order.update({ where:{ id:order.id }, data:{ hiddenByCustomer:true }, include:ORDER_INCLUDE });
      return { cancelled: guard.count > 0, updated };
    });
    if (cancelled) {
      req.app.get('io').to(`restaurant:${order.restaurantId}`).emit('order:cancelled', updated);
      if (updated.fulfillmentType === 'delivery') req.app.get('io').to('superadmin').to('delivery').emit('delivery:order', updated);
    }
    res.json({ success:true, data:{ cancelled } });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
