import { restaurantAPI } from '../services/api'

// Last loaded restaurant list and menus, so opening the app or going back to a screen shows them
// straight away while a fresh copy loads quietly, instead of a spinner for every round trip to the
// server (~0.5 s from Rwanda). Kept on the phone between visits; every screen still refetches on
// open, so a saved copy is never shown for longer than one request.
const mem = new Map()
const STORE_KEY = 'cc-catalog-cache-v2'
// Menus are a few KB each — keep the most recently opened ones only
const MAX_MENU_ENTRIES = 24

try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
  Object.entries(saved).forEach(([k, v]) => mem.set(k, v))
} catch {}

const persist = () => {
  const menus = [...mem.keys()].filter(k => k.startsWith('menu:'))
  menus.slice(0, Math.max(0, menus.length - MAX_MENU_ENTRIES)).forEach(k => mem.delete(k))
  try { localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(mem))) } catch {}
}

const get = (key) => mem.get(key) ?? null
// Re-inserted so the Map's order is least to most recently saved
const put = (key, value) => { mem.delete(key); mem.set(key, value) }
const set = (key, value) => { put(key, value); persist() }

// The list flags the signed-in customer's favorites, so it's kept per customer too
export const getCachedRestaurantList = (customerId) => get(`list:${customerId || 'anon'}`)
export const setCachedRestaurantList = (list, customerId) => set(`list:${customerId || 'anon'}`, list)

// Menus carry isFavorited for whoever is signed in, so they're kept per customer. The page URL
// may hold the slug instead of the id, so each menu is stored under both.
const menuKey = (idOrSlug, customerId) => `menu:${customerId || 'anon'}:${idOrSlug}`
export const getCachedRestaurant = (idOrSlug, customerId) => get(menuKey(idOrSlug, customerId))
export const setCachedRestaurant = (restaurant, customerId) => {
  if (!restaurant?.id) return
  put(menuKey(restaurant.id, customerId), restaurant)
  if (restaurant.slug) put(menuKey(restaurant.slug, customerId), restaurant)
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
