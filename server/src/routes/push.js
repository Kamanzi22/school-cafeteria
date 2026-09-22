const router = require('express').Router();
const { optionalCustomer } = require('../middleware/auth');
const { pushEnabled, publicKey, isAllowedEndpoint } = require('../lib/push');
const prisma = require('../lib/prisma');

const requireCustomer = (req, res, next) => {
  if (!req.customer) return res.status(401).json({ success:false, error:'Sign in to enable notifications' });
  next();
};

// The client needs this to create a subscription; `enabled:false` means the server has no VAPID keys.
router.get('/public-key', (req, res) => {
  res.json({ success:true, data:{ enabled:pushEnabled, publicKey } });
});

router.post('/subscribe', optionalCustomer, requireCustomer, async (req, res) => {
  try {
    if (!pushEnabled) return res.status(503).json({ success:false, error:'Push notifications are not configured' });
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ success:false, error:'Invalid subscription' });
    if (!isAllowedEndpoint(endpoint)) return res.status(400).json({ success:false, error:'Unsupported push service' });
    // Upsert by endpoint: if someone else was signed in on this device before, the device now belongs to the current account.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { customerId:req.customer.id, endpoint, p256dh:keys.p256dh, auth:keys.auth },
      update: { customerId:req.customer.id, p256dh:keys.p256dh, auth:keys.auth },
    });
    res.json({ success:true });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

// Called on sign-out so the next person on a shared phone doesn't receive this customer's alerts.
router.post('/unsubscribe', optionalCustomer, requireCustomer, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ success:false, error:'Endpoint required' });
    await prisma.pushSubscription.deleteMany({ where:{ endpoint, customerId:req.customer.id } });
    res.json({ success:true });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

module.exports = router;
