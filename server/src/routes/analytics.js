const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authStaff } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', authStaff, async (req, res) => {
  try {
    const rId = req.restaurantId;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const weekAgo = new Date(Date.now() - 7*86400000);

    const [todayOrders, weekOrders, topItems, hourly, reviews] = await Promise.all([
      prisma.order.findMany({ where:{ restaurantId:rId, createdAt:{ gte:todayStart }, status:{ not:'cancelled' } }, include:{ items:true } }),
      prisma.order.findMany({ where:{ restaurantId:rId, createdAt:{ gte:weekAgo }, status:{ not:'cancelled' } } }),
      prisma.menuItem.findMany({ where:{ restaurantId:rId }, orderBy:{ totalOrdered:'desc' }, take:8 }),
      prisma.order.findMany({ where:{ restaurantId:rId, createdAt:{ gte:todayStart }, status:{ not:'cancelled' } }, select:{ createdAt:true, totalPrice:true } }),
      prisma.review.findMany({ where:{ restaurantId:rId }, include:{ customer:{ select:{ name:true } } }, orderBy:{ createdAt:'desc' }, take:10 })
    ]);

    const sum = arr => arr.reduce((s,o) => s+o.totalPrice, 0);
    const dailyStats = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(Date.now()-i*86400000);
      const ds = new Date(d); ds.setHours(0,0,0,0);
      const de = new Date(d); de.setHours(23,59,59,999);
      const day = weekOrders.filter(o => new Date(o.createdAt)>=ds && new Date(o.createdAt)<=de);
      dailyStats.push({ date:ds.toISOString().split('T')[0], label:d.toLocaleDateString('en',{ weekday:'short' }), orders:day.length, revenue:sum(day) });
    }
    const byHour = Array.from({ length:14 }, (_,i) => { const h=i+6; const hr=hourly.filter(o=>new Date(o.createdAt).getHours()===h); return { hour:h, label:`${h}:00`, count:hr.length, revenue:hr.reduce((s,o)=>s+o.totalPrice,0) }; });
    const allToday = await prisma.order.findMany({ where:{ restaurantId:rId, createdAt:{ gte:todayStart } }, select:{ status:true } });
    const statusBreakdown = {};
    allToday.forEach(o => { statusBreakdown[o.status] = (statusBreakdown[o.status]||0)+1; });

    res.json({ success:true, data:{
      today:{ orders:todayOrders.length, revenue:sum(todayOrders), avgOrder:todayOrders.length?sum(todayOrders)/todayOrders.length:0 },
      week:{ orders:weekOrders.length, revenue:sum(weekOrders) },
      topItems, dailyStats, byHour, statusBreakdown, recentReviews:reviews,
      avgRating:reviews.length?reviews.reduce((s,r)=>s+r.overallRating,0)/reviews.length:0
    }});
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
