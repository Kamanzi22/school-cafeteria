const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = (io) => {
  io.on('connection', (socket) => {
    // A restaurant's live order feed includes customer names/phones/delivery addresses, so
    // joining it requires proving you're staff of that specific restaurant — the restaurantId
    // alone is public (visible on every /restaurant/:id page) and isn't a secret.
    socket.on('join:restaurant', async ({ id, token } = {}) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        let restaurantId = null;
        if (decoded.type === 'owner' || decoded.type === 'viewer') {
          // 'viewer' is the super admin's read-only mirror token — joining the room only
          // lets it *receive* live order events, it can never emit a mutating request.
          restaurantId = decoded.restaurantId;
        } else if (decoded.type === 'staff') {
          const staff = await prisma.restaurantStaff.findUnique({ where: { id: decoded.id } });
          restaurantId = staff?.isActive ? staff.restaurantId : null;
        }
        if (restaurantId && restaurantId === id) socket.join(`restaurant:${id}`);
      } catch {}
    });
    // Order tracking is a capability link — the order id itself (an unguessable uuid) is the
    // secret, matching how GET /api/orders/:id already works for guest/anonymous tracking.
    socket.on('join:order', (id) => socket.join(`order:${id}`));
    socket.on('leave:order', (id) => socket.leave(`order:${id}`));
    // Live visitor feed — only a verified super-admin token can join this room.
    socket.on('join:superadmin', ({ token } = {}) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type === 'superadmin') socket.join('superadmin');
      } catch {}
    });
    // Live delivery-orders feed — separate from the 'superadmin' room (which also carries
    // visitor-tracking events) so a scoped delivery token only ever receives delivery updates.
    socket.on('join:delivery', ({ token } = {}) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type === 'delivery' || decoded.type === 'superadmin') socket.join('delivery');
      } catch {}
    });
    socket.on('disconnect', () => {});
  });
};
