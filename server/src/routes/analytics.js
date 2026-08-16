const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authStaff } = require('../middleware/auth');
const prisma = new PrismaClient();

const RANGE_MS = { day: 86400000, week: 7 * 86400000, month: 30 * 86400000 };

router.get('/sales-report', authStaff, async (req, res) => {
  try {
    const rId = req.restaurantId;
    const range = ['day', 'week', 'month'].includes(req.query.range) ? req.query.range : 'day';

    const start = new Date();
    if (range === 'day') start.setHours(0, 0, 0, 0);
    else start.setTime(Date.now() - RANGE_MS[range]);

    const orders = await prisma.order.findMany({
      where: { restaurantId: rId, createdAt: { gte: start }, status: { not: 'cancelled' } },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    const rows = [];
    const productTotals = {};
    const hourTotals = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orders: 0 }));
    let revenue = 0;

    orders.forEach(o => {
      revenue += o.totalPrice;
      const hour = new Date(o.createdAt).getHours();
      hourTotals[hour].revenue += o.totalPrice;
      hourTotals[hour].orders += 1;

      o.items.forEach(it => {
        rows.push({
          id: it.id,
          orderNumber: o.orderNumber,
          name: it.menuItemName,
          emoji: it.menuItemEmoji,
          variantName: it.variantName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
          time: o.createdAt,
          fulfillmentType: o.fulfillmentType
        });
        const key = it.menuItemName;
        productTotals[key] = productTotals[key] || { name: it.menuItemName, emoji: it.menuItemEmoji, quantity: 0, revenue: 0 };
        productTotals[key].quantity += it.quantity;
        productTotals[key].revenue += it.subtotal;
      });
    });

    const topSeller = Object.values(productTotals).sort((a, b) => b.quantity - a.quantity)[0] || null;
    const peakHour = hourTotals.reduce((best, h) => (!best || h.revenue > best.revenue ? h : best), null);

    const fmtHour = h => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' }); };

    res.json({
      success: true,
      data: {
        range,
        rows,
        totals: { revenue, orders: orders.length },
        topSeller,
        peakHour: peakHour && peakHour.orders > 0 ? { hour: peakHour.hour, label: `${fmtHour(peakHour.hour)} – ${fmtHour((peakHour.hour + 1) % 24)}`, revenue: peakHour.revenue, orders: peakHour.orders } : null
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
