const prisma = require('./prisma');

// The super admin's platform-wide delivery switch (PlatformSettings.deliveryEnabled). While it's
// off, no store offers delivery whatever its own settings say, and pickup is always on so a
// delivery-only store can still take orders. Store settings are left untouched underneath.
async function isDeliveryEnabled() {
  const s = await prisma.platformSettings.findUnique({ where: { id: 'default' }, select: { deliveryEnabled: true } });
  return s?.deliveryEnabled !== false;
}

function applyPlatformDelivery(restaurant, deliveryEnabled) {
  if (deliveryEnabled || !restaurant) return restaurant;
  return { ...restaurant, offersPickup: true, offersDelivery: false, offersCampusDelivery: false, offersOffCampusDelivery: false };
}

module.exports = { isDeliveryEnabled, applyPlatformDelivery };
