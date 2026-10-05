import { restaurantAPI, orderAPI } from '../services/api'

// Data a screen can show without waiting for its own request to the server (~0.3-0.5 s each from
// Rwanda). Every screen still fetches as before; this only decides what it starts from.

// Requests index.html starts before the app's code has downloaded and started (see the script
// there): the home list, a restaurant's menu, or an order — whichever the opened address needs.
// Each is handed to the first screen that asks for it, then forgotten. Resolves to the API's JSON
// body, or null if it failed, in which case the screen makes its normal request instead.
export const takeEarly = (path) => {
  const early = window.__ccEarly?.[path]
  if (!early) return null
  delete window.__ccEarly[path]
  return early
}

const earlyOr = (path, request) => {
  const early = takeEarly(path)
  if (!early) return request()
  return early.then(body => (body?.success ? body.data : request()))
}

export const fetchRestaurantList = () => earlyOr('/restaurants', () => restaurantAPI.list().then(r => r.data.data || []))
export const fetchRestaurant = (id) => earlyOr(`/restaurants/${id}`, () => restaurantAPI.get(id).then(r => r.data.data))
export const fetchOrder = (id) => earlyOr(`/orders/${id}`, () => orderAPI.get(id).then(r => r.data.data))

// Orders the customer just placed or looked at, as the server last sent them: placing an order
// already returns it in full, so the confirmation and tracking screens can show it at once
// instead of asking for it again first. In memory only, for this visit.
const orders = new Map()
export const rememberOrder = (order) => { if (order?.id) orders.set(order.id, order) }
export const getRememberedOrder = (id) => orders.get(id) || null
