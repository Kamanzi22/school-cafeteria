const webpush = require('web-push');
const prisma = require('./prisma');

// Web Push needs a VAPID key pair (`npx web-push generate-vapid-keys`). Without one the feature
// is simply off — the in-app toast and email still work, and the client hides the push option.
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
const enabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (enabled) {
  const subject = process.env.VAPID_SUBJECT
    || (process.env.EMAIL_USER ? `mailto:${process.env.EMAIL_USER}` : (process.env.CLIENT_URL || '').split(',')[0]?.trim())
    || 'mailto:admin@cafecampus.app';
  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// The server POSTs to whatever endpoint a client registers, so only accept the real browser
// push services — otherwise a subscription could point the server at an internal address.
const PUSH_HOSTS = ['googleapis.com', 'mozilla.com', 'mozaws.net', 'push.apple.com', 'notify.windows.com'];
const isAllowedEndpoint = (endpoint) => {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch { return false; }
};

// Sends `payload` ({ title, body, url, tag }) to every device the customer has subscribed.
// Never throws. Subscriptions the push service reports as gone (404/410 — app uninstalled,
// permission revoked) are deleted so we stop trying them.
async function sendPushToCustomer(customerId, payload) {
  if (!enabled) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { customerId } });
    const body = JSON.stringify(payload);
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
        else console.error('Push send failed:', e.statusCode || '', e.message);
      }
    }));
  } catch (e) { console.error('Push notification failed:', e.message); }
}

// Same as sendPushToCustomer, but to every device subscribed to a restaurant (owner/staff —
// "someone placed an order").
async function sendPushToRestaurant(restaurantId, payload) {
  if (!enabled) return;
  try {
    const subs = await prisma.restaurantPushSubscription.findMany({ where: { restaurantId } });
    const body = JSON.stringify(payload);
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await prisma.restaurantPushSubscription.deleteMany({ where: { id: s.id } });
        else console.error('Restaurant push send failed:', e.statusCode || '', e.message);
      }
    }));
  } catch (e) { console.error('Restaurant push notification failed:', e.message); }
}

module.exports = { pushEnabled: enabled, publicKey: VAPID_PUBLIC_KEY || null, isAllowedEndpoint, sendPushToCustomer, sendPushToRestaurant };
