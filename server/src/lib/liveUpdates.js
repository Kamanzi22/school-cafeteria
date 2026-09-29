// Tells every open app that restaurant or platform data changed, so the screens showing it
// (customer home, menus, search, cart, support contact) reload it instead of waiting for the
// customer to restart the app. restaurantId is null for platform-wide changes. Complements the
// older, more specific events (menu:updated, restaurant:status/updated/deleted), which stay.
const broadcastCatalogChange = (req, restaurantId = null) =>
  req.app.get('io').emit('catalog:changed', { restaurantId });

module.exports = { broadcastCatalogChange };
