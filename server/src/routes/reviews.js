// reviews.js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.post('/', async (req, res) => {
  try {
    const { orderId, customerId, foodRating, serviceRating, comment } = req.body;
    const order = await prisma.order.findUnique({ where:{ id:orderId } });
    if (!order || order.status !== 'picked_up') return res.status(400).json({ success:false, error:'Can only review completed orders' });
    if (order.customerId !== customerId) return res.status(403).json({ success:false, error:'Forbidden' });
    const existing = await prisma.review.findUnique({ where:{ orderId } });
    if (existing) return res.status(409).json({ success:false, error:'Already reviewed' });
    const overallRating = Math.round((foodRating+serviceRating)/2);
    const review = await prisma.review.create({ data:{ orderId, customerId, restaurantId:order.restaurantId, foodRating, serviceRating, overallRating, comment } });
    const reviews = await prisma.review.findMany({ where:{ restaurantId:order.restaurantId } });
    const avg = reviews.reduce((s,r)=>s+r.overallRating,0)/reviews.length;
    await prisma.restaurant.update({ where:{ id:order.restaurantId }, data:{ rating:Math.round(avg*10)/10, ratingCount:reviews.length } });
    res.json({ success:true, data:review });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
