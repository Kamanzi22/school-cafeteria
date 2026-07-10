import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Cart — supports items from multiple restaurants; variants are separate lines
const cartKey = (itemId, variantId) => `${itemId}:${variantId || ''}`

export const useCartStore = create(persist((set, get) => ({
  items: [],
  addItem: (item, restaurant, variant = null) => {
    const key = cartKey(item.id, variant?.id)
    const existing = get().items.find(i => i.key === key)
    if (existing) set({ items: get().items.map(i => i.key === key ? { ...i, qty: i.qty+1 } : i) })
    else set({ items: [...get().items, {
      ...item, key, qty: 1,
      price: item.price + (variant?.priceDelta || 0),
      variantId: variant?.id || null, variantName: variant?.name || null,
      restaurantId: restaurant.id, restaurantName: restaurant.name, restaurantEmoji: restaurant.emoji || '🍽️',
      restaurantOffersPickup: restaurant.offersPickup !== false, restaurantOffersDelivery: !!restaurant.offersDelivery, restaurantDeliveryFee: restaurant.deliveryFee || 0,
    }] })
    return 'added'
  },
  setQty: (key, qty) => { if (qty < 1) { get().remove(key); return } set({ items: get().items.map(i => i.key===key ? { ...i, qty } : i) }) },
  remove: (key) => set({ items: get().items.filter(i => i.key!==key) }),
  clear: () => set({ items: [] }),
  subtotal: () => get().items.reduce((s,i) => s+i.price*i.qty, 0),
  count: () => get().items.reduce((s,i) => s+i.qty, 0),
  byRestaurant: () => {
    const groups = {}
    for (const item of get().items) {
      if (!groups[item.restaurantId]) groups[item.restaurantId] = { id: item.restaurantId, name: item.restaurantName, emoji: item.restaurantEmoji, offersPickup: item.restaurantOffersPickup, offersDelivery: item.restaurantOffersDelivery, deliveryFee: item.restaurantDeliveryFee, items: [] }
      groups[item.restaurantId].items.push(item)
    }
    return Object.values(groups)
  },
}), { name: 'cc-cart-v5' }))

// Customer (registered or guest)
export const useCustomerStore = create(persist((set) => ({
  customer: null, token: null, guestToken: null,
  login: (customer, token) => set({ customer, token }),
  setGuest: (customer, token, guestToken) => set({ customer, token, guestToken }),
  update: (data) => set(s => ({ customer: { ...s.customer, ...data } })),
  logout: () => set({ customer: null, token: null, guestToken: null }),
}), { name: 'cc-customer-v4' }))

// Restaurant Admin (owner or staff)
export const useAdminStore = create(persist((set) => ({
  admin: null, token: null, restaurant: null, role: null,
  loginOwner: (restaurant, token) => set({ restaurant, token, admin: { name: restaurant.ownerName, email: restaurant.ownerEmail }, role: 'owner' }),
  loginStaff: (staff, restaurant, token) => set({ admin: staff, restaurant, token, role: staff.role }),
  updateRestaurant: (r) => set(s => ({ restaurant: { ...s.restaurant, ...r } })),
  logout: () => set({ admin: null, token: null, restaurant: null, role: null }),
}), { name: 'cc-admin-v3' }))

// UI
export const useUIStore = create((set) => ({
  cartOpen: false, openCart: () => set({ cartOpen: true }), closeCart: () => set({ cartOpen: false }),
}))

// Which side of the app the customer is browsing: CAFETERIA | MARKETPLACE
export const useVenueStore = create(persist((set) => ({
  venueType: null,
  setVenueType: (venueType) => set({ venueType }),
}), { name: 'cc-venue-v1' }))
