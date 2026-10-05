import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Cart — supports items from multiple restaurants; each option (variant) and each set of sides
// is its own line. A meal with no option and no sides keeps the plain `${id}:` key.
const cartKey = (itemId, variantId, sides = []) => {
  const base = `${itemId}:${variantId || ''}`
  return sides.length ? `${base}:${sides.map(s => s.id).sort().join(',')}` : base
}

export const useCartStore = create(persist((set, get) => ({
  items: [],
  addItem: (item, restaurant, variant = null, sides = []) => {
    const key = cartKey(item.id, variant?.id, sides)
    const existing = get().items.find(i => i.key === key)
    if (existing) set({ items: get().items.map(i => i.key === key ? { ...i, qty: i.qty+1 } : i) })
    else set({ items: [...get().items, {
      ...item, key, qty: 1,
      price: item.price + (variant?.priceDelta || 0) + sides.reduce((s, sd) => s + sd.price, 0),
      variantId: variant?.id || null, variantName: variant?.name || null,
      sides: sides.map(({ id, name, price }) => ({ id, name, price })),
      restaurantId: restaurant.id, restaurantName: restaurant.name, restaurantEmoji: restaurant.emoji || '🍽️',
      restaurantOffersPickup: restaurant.offersPickup !== false, restaurantOffersDelivery: !!restaurant.offersDelivery,
      restaurantOffersCampusDelivery: !!restaurant.offersCampusDelivery, restaurantOffersOffCampusDelivery: !!restaurant.offersOffCampusDelivery,
      restaurantCampusDeliveryFee: restaurant.campusDeliveryFee || 0, restaurantOffCampusDeliveryFee: restaurant.offCampusDeliveryFee || 0,
    }] })
    return 'added'
  },
  setQty: (key, qty) => { if (qty < 1) { get().remove(key); return } set({ items: get().items.map(i => i.key===key ? { ...i, qty } : i) }) },
  remove: (key) => set({ items: get().items.filter(i => i.key!==key) }),
  // The customer's request for one cart line ("no onions"), sent with the order as that item's note
  setNote: (key, notes) => set({ items: get().items.map(i => i.key===key ? { ...i, notes } : i) }),
  // Promo code chosen per restaurant ({ [restaurantId]: 'CODE' }) — set from the offers on a
  // restaurant's page or typed in the cart, and sent with that restaurant's order.
  promoCodes: {},
  setPromoCode: (restaurantId, code) => set({ promoCodes: { ...get().promoCodes, [restaurantId]: code || undefined } }),
  clear: () => set({ items: [], promoCodes: {} }),
  // Drops one restaurant's lines and promo code — after its order went through but another
  // restaurant's in the same checkout didn't, so trying again can't order it twice
  removeRestaurant: (restaurantId) => set({ items: get().items.filter(i => i.restaurantId !== restaurantId), promoCodes: { ...get().promoCodes, [restaurantId]: undefined } }),
  subtotal: () => get().items.reduce((s,i) => s+i.price*i.qty, 0),
  count: () => get().items.reduce((s,i) => s+i.qty, 0),
  byRestaurant: () => {
    const groups = {}
    for (const item of get().items) {
      if (!groups[item.restaurantId]) groups[item.restaurantId] = {
        id: item.restaurantId, name: item.restaurantName, emoji: item.restaurantEmoji,
        offersPickup: item.restaurantOffersPickup, offersDelivery: item.restaurantOffersDelivery,
        offersCampusDelivery: item.restaurantOffersCampusDelivery, offersOffCampusDelivery: item.restaurantOffersOffCampusDelivery,
        campusDeliveryFee: item.restaurantCampusDeliveryFee, offCampusDeliveryFee: item.restaurantOffCampusDeliveryFee,
        items: [],
      }
      groups[item.restaurantId].items.push(item)
    }
    return Object.values(groups)
  },
}), { name: 'cc-cart-v6' }))

// Customer
export const useCustomerStore = create(persist((set) => ({
  customer: null, token: null,
  login: (customer, token) => set({ customer, token }),
  update: (data) => set(s => ({ customer: { ...s.customer, ...data } })),
  logout: () => set({ customer: null, token: null }),
}), { name: 'cc-customer-v4' }))

// Restaurant Admin (owner or staff) — or a super-admin's read-only 'viewer' mirror session
export const useAdminStore = create(persist((set) => ({
  admin: null, token: null, restaurant: null, role: null,
  loginOwner: (restaurant, token) => set({ restaurant, token, admin: { name: restaurant.ownerName, email: restaurant.ownerEmail }, role: 'owner' }),
  loginStaff: (staff, restaurant, token) => set({ admin: staff, restaurant, token, role: staff.role }),
  loginViewer: (restaurant, token) => set({ restaurant, token, admin: { name: 'Super Admin' }, role: 'viewer' }),
  updateRestaurant: (r) => set(s => ({ restaurant: { ...s.restaurant, ...r } })),
  logout: () => set({ admin: null, token: null, restaurant: null, role: null }),
}), { name: 'cc-admin-v3' }))

// UI
export const useUIStore = create((set) => ({
  cartOpen: false, openCart: () => set({ cartOpen: true }), closeCart: () => set({ cartOpen: false }),
}))
