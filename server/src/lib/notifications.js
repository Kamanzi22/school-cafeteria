const { sendOrderReadyEmail } = require('./mailer');
const { sendPushToCustomer } = require('./push');

const CLIENT_URL = (process.env.CLIENT_URL || '').split(',')[0]?.trim() || '';

// `order` is a full ORDER_INCLUDE order (customer + restaurant loaded).
const readyCopy = (order) => {
  const name = order.restaurant?.name || 'the restaurant';
  if (order.fulfillmentType === 'delivery') {
    return { title: 'Your order is ready 🎉', body: `${name} has finished your order — it will be on its way shortly.` };
  }
  const where = order.restaurant?.location ? ` Head to ${order.restaurant.location} to pick it up.` : '';
  return { title: 'Your order is ready 🎉', body: `${name} has finished your order.${where}` };
};

// Tells the customer their order is done, over every channel we have:
//  - a live socket event (in-app toast, for anyone with the app open),
//  - a push notification to their phone/browser (works with the app or browser closed),
//  - an email (works even if they never enabled push).
// Never throws — a failed notification must not fail the status update that triggered it.
async function notifyOrderReady(io, order) {
  const { title, body } = readyCopy(order);
  try {
    io.to(`customer:${order.customerId}`).emit('notification', {
      type: 'order_ready', orderId: order.id, orderNumber: order.orderNumber, title, body,
    });
  } catch (e) { console.error('Order-ready socket notification failed:', e.message); }

  const email = order.customer?.email
    ? sendOrderReadyEmail({
        to: order.customer.email, title, body, orderNumber: order.orderNumber,
        link: CLIENT_URL ? `${CLIENT_URL}/order/track/${order.id}` : null,
      }).catch((e) => console.error('Order-ready email failed:', e.message))
    : null;

  // Same tag as the in-app notification so a device that gets both shows just one.
  const push = sendPushToCustomer(order.customerId, {
    title, body, tag: `order-${order.id}`, url: `/order/track/${order.id}`,
  });

  await Promise.all([email, push]);
}

module.exports = { notifyOrderReady };
