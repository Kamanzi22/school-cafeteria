// Rush-hour load simulation for CaféCampus.
//
// Mimics the real traffic shape: a burst of concurrent customers browsing
// restaurants/menus, most just looking, a minority placing an order.
//
// SAFETY: this creates real orders (and decrements real stock) against
// whatever BASE_URL points at. Never point it at production — run it
// against a staging environment or a disposable/seeded database only.
//
// Usage:
//   k6 run -e BASE_URL=https://cafecampus-api-staging.onrender.com load-tests/rush-hour.js
//
// Tune concurrency/duration to match your real rush-hour window:
//   k6 run -e BASE_URL=... -e PEAK_VUS=100 load-tests/rush-hour.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
const PROD_URL = 'https://cafecampus-api-feu3.onrender.com';
if (!BASE_URL) throw new Error('Set -e BASE_URL=<target api url> (staging or a disposable env — never prod)');
if (BASE_URL.replace(/\/$/, '') === PROD_URL) {
  throw new Error('Refusing to run against the production API. Point BASE_URL at staging instead.');
}

const PEAK_VUS = Number(__ENV.PEAK_VUS || 75);
const orderErrors = new Rate('order_errors');

export const options = {
  stages: [
    { duration: '30s', target: Math.round(PEAK_VUS * 0.3) }, // opening rush
    { duration: '1m', target: PEAK_VUS },                     // peak
    { duration: '3m', target: PEAK_VUS },                     // sustained rush hour
    { duration: '30s', target: 0 },                           // tail off
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500'],
    order_errors: ['rate<0.05'],
  },
};

// Runs once before the VUs start — builds a pool of real restaurants/menu
// items from the target env so every VU orders things that actually exist.
export function setup() {
  const res = http.get(`${BASE_URL}/api/restaurants`);
  if (res.status !== 200) throw new Error(`Could not load restaurants from ${BASE_URL}: ${res.status}`);
  const restaurants = JSON.parse(res.body).data || [];
  if (!restaurants.length) throw new Error('Target env has no restaurants to browse/order from — seed it first.');

  const catalog = [];
  for (const r of restaurants.slice(0, 10)) {
    const detail = http.get(`${BASE_URL}/api/restaurants/${r.id}`);
    if (detail.status !== 200) continue;
    const data = JSON.parse(detail.body).data;
    const orderableItems = (data.items || []).filter(i => !i.hasVariants);
    if (data.isOpen && data.isAccepting && orderableItems.length) {
      catalog.push({ id: data.id, minOrder: data.minOrder, items: orderableItems });
    }
  }
  if (!catalog.length) console.warn('No open/accepting restaurant with simple (non-variant) items found — order requests will be skipped.');
  return { restaurantIds: restaurants.map(r => r.id), catalog };
}

export default function (data) {
  group('browse restaurants', function () {
    const res = http.get(`${BASE_URL}/api/restaurants`, { tags: { name: 'GET /restaurants' } });
    check(res, { 'restaurants list ok': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 0.5);

  const restaurantId = data.restaurantIds[Math.floor(Math.random() * data.restaurantIds.length)];
  group('view menu', function () {
    const res = http.get(`${BASE_URL}/api/restaurants/${restaurantId}`, { tags: { name: 'GET /restaurants/:id' } });
    check(res, { 'menu ok': (r) => r.status === 200 });
  });

  sleep(Math.random() * 3 + 1);

  // ~30% of browsing sessions convert into a placed order, matching a
  // typical browse-to-purchase ratio during a rush.
  if (Math.random() < 0.3 && data.catalog.length) {
    group('place order', function () {
      const store = data.catalog[Math.floor(Math.random() * data.catalog.length)];
      const item = store.items[Math.floor(Math.random() * store.items.length)];
      const payload = JSON.stringify({
        guestToken: `loadtest-${__VU}-${__ITER}-${Date.now()}`,
        guestName: `Load Test VU${__VU}`,
        guestPhone: '0700000000',
        restaurantId: store.id,
        items: [{ menuItemId: item.id, quantity: 1 + Math.floor(Math.random() * 2) }],
        fulfillmentType: 'pickup',
        paymentMethod: 'cash',
      });
      const res = http.post(`${BASE_URL}/api/orders`, payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'POST /orders' },
      });
      const ok = check(res, { 'order placed or expected 4xx': (r) => r.status === 200 || r.status === 400 });
      orderErrors.add(!ok);
    });
  }

  sleep(Math.random() * 2 + 1);
}
