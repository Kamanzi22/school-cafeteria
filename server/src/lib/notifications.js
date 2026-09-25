const { sendOrderStatusEmail } = require('./mailer');
const { sendPushToCustomer, sendPushToRestaurant } = require('./push');

const CLIENT_URL = (process.env.CLIENT_URL || '').split(',')[0]?.trim() || '';

// Title/body the customer sees for each status their order moves into. Returns null for
// statuses that don't warrant a notification. `order` needs `restaurant` loaded for the name.
const statusCopy = (order) => {
  const name = order.restaurant?.name || 'The restaurant';
  const isDelivery = order.fulfillmentType === 'delivery';
  switch (order.status) {
    case 'confirmed':
      return { title: 'Order confirmed ✅', body: `${name} accepted your order and will start on it shortly.` };
    case 'preparing':
      return { title: 'Your food is cooking 👨‍🍳', body: `${name} is preparing your order right now.` };
    case 'ready': {
      if (isDelivery) return { title: 'Your order is ready 🎉', body: `${name} has finished your order — it will be on its way shortly.` };
      const where = order.restaurant?.location ? ` Head to ${order.restaurant.location} to pick it up.` : '';
      return { title: 'Your order is ready 🎉', body: `${name} has finished your order.${where}` };
    }
    case 'on_the_way':
      return { title: 'On its way 🚴', body: `Your order is being delivered to ${order.deliveryLocation || 'you'}.` };
    case 'picked_up':
      return isDelivery
        ? { title: 'Delivered 🍽️', body: 'Your order has been delivered. Enjoy your meal!' }
        : { title: 'Picked up 🍽️', body: 'Your order has been picked up. Enjoy your meal!' };
    case 'cancelled': {
      const hasNote = order.cancelReason && order.cancelReason !== 'Cancelled by restaurant';
      const note = hasNote ? ` Note from ${name}: "${order.cancelReason}"` : '';
      return { title: 'Order cancelled ❌', body: `${name} cancelled your order ${order.orderNumber}.${note}` };
    }
    default:
      return null;
  }
};

// Email only for the moments that need the customer to act or know even if they never open
// the app — every step by email would be spammy. Push + in-app cover every step.
const EMAIL_STATUSES = new Set(['ready', 'cancelled']);

// Tells the customer their order moved to a new status, over every channel we have:
//  - a live socket event (in-app toast, for anyone with the app open),
//  - a push notification to their phone/browser (works with the app or browser closed),
//  - an email for the key statuses (works even if they never enabled push).
// Never throws — a failed notification must not fail the status update that triggered it.
async function notifyOrderStatus(io, order) {
  const copy = statusCopy(order);
  if (!copy) return;
  const { title, body } = copy;
  try {
    io.to(`customer:${order.customerId}`).emit('notification', {
      type: 'order_status', status: order.status, orderId: order.id, orderNumber: order.orderNumber, title, body,
    });
  } catch (e) { console.error('Order-status socket notification failed:', e.message); }

  const email = order.customer?.email && EMAIL_STATUSES.has(order.status)
    ? sendOrderStatusEmail({
        to: order.customer.email, title, body, orderNumber: order.orderNumber,
        link: CLIENT_URL ? `${CLIENT_URL}/order/track/${order.id}` : null,
      }).catch((e) => console.error('Order-status email failed:', e.message))
    : null;

  // Same tag as the in-app notification so a device that gets both shows just one, and each new
  // status replaces the previous one instead of stacking up.
  const push = sendPushToCustomer(order.customerId, {
    title, body, tag: `order-${order.id}`, url: `/order/track/${order.id}`,
  });

  await Promise.all([email, push]);
}

// Tells the restaurant a new order came in — the dashboard already shows it live via socket
// while open (see 'order:new' in orders.js), this is the push notification so a device with the
// app closed or backgrounded still gets alerted. Never throws.
async function notifyNewOrder(order) {
  const push = sendPushToRestaurant(order.restaurantId, {
    title: 'New order 🔔',
    body: `${order.customer?.name || order.guestName || 'A customer'} placed an order — ${order.orderNumber}`,
    tag: `new-order-${order.id}`,
    url: '/admin',
  }).catch((e) => console.error('New-order push failed:', e.message));
  await push;
}

module.exports = { notifyOrderStatus, notifyNewOrder };
