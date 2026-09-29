// Shared bits of the help chat with the super admin (see the SupportMessage model), used by the
// customer, restaurant and super admin routes.
const { sendPushToSuperAdmins } = require('./push');

const MAX_MESSAGE_LENGTH = 2000;

// The trimmed message, or { error } to send back as a 400
const readBody = (req) => {
  const body = String(req.body?.body || '').trim();
  if (!body) return { error: 'Message is empty' };
  if (body.length > MAX_MESSAGE_LENGTH) return { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` };
  return { body };
};

// Short enough for a phone notification
const preview = (body) => (body.length > 120 ? `${body.slice(0, 117)}…` : body);

// A customer or restaurant wrote in: update any open super admin panel live, and alert the
// admins' devices that turned on the bell.
const notifyAdminsOfMessage = (req, message, senderName) => {
  req.app.get('io').to('superadmin').emit('support:message', { ...message, senderName });
  sendPushToSuperAdmins({
    title: `New message from ${senderName}`,
    body: preview(message.body),
    url: '/superadmin/messages',
    tag: `support-${message.customerId || message.restaurantId}`,
  });
};

module.exports = { readBody, preview, notifyAdminsOfMessage };
