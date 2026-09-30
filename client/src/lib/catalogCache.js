import { restaurantAPI } from '../services/api'

// Last loaded restaurant list and menus, so going back to a screen shows it straight away while
// a fresh copy loads quietly, instead of a spinner for every round trip to the server (~0.5 s
// from Rwanda). Kept for the browser tab's session only; every screen still refetches on open,
// so this is never shown for longer than one request.
const mem = new Map()
const STORE_KEY = 'cc-catalog-cache-v1'

try {
  const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}')
  Object.entries(saved).forEach(([k, v]) => mem.set(k, v))
} catch {}

const persist = () => {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(mem))) } catch {}
}

const get = (key) => mem.get(key) ?? null
const set = (key, value) => { mem.set(key, value); persist() }

// The list flags the signed-in customer's favorites, so it's kept per customer too
export const getCachedRestaurantList = (customerId) => get(`list:${customerId || 'anon'}`)
export const setCachedRestaurantList = (list, customerId) => set(`list:${customerId || 'anon'}`, list)

// Menus carry isFavorited for whoever is signed in, so they're kept per customer. The page URL
// may hold the slug instead of the id, so each menu is stored under both.
const menuKey = (idOrSlug, customerId) => `menu:${customerId || 'anon'}:${idOrSlug}`
export const getCachedRestaurant = (idOrSlug, customerId) => get(menuKey(idOrSlug, customerId))
export const setCachedRestaurant = (restaurant, customerId) => {
  if (!restaurant?.id) return
  mem.set(menuKey(restaurant.id, customerId), restaurant)
  if (restaurant.slug) mem.set(menuKey(restaurant.slug, customerId), restaurant)
  persist()
}

// index.html starts fetching the restaurant list before the app's code has even downloaded (see
// the script there); the home screen's first load picks that request up instead of starting over.
export const fetchRestaurantList = () => {
  const early = window.__ccRestaurantList
  if (early) {
    window.__ccRestaurantList = null
    return early.then(body => {
      if (body?.success && Array.isArray(body.data)) return body.data
      return restaurantAPI.list().then(r => r.data.data || [])
    })
  }
  return restaurantAPI.list().then(r => r.data.data || [])
}
