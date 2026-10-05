// Sides picked for an order line ("+ Salad"). Orders store them as a JSON string, cart lines as
// an array; either way this hands back [{ id, name, price }].
export const parseSides = (value) => {
  if (Array.isArray(value)) return value
  try { const list = JSON.parse(value || '[]'); return Array.isArray(list) ? list : [] } catch { return [] }
}

// A restaurant's "Sides" category holds the extras (e.g. Salad) customers can add to any meal
export const isSide = (item) => item?.category?.name?.trim().toLowerCase() === 'sides'

// The sides a customer can add to a meal right now: available, simple (no options), in stock
export const availableSides = (items = []) => items.filter(i => isSide(i) && i.isAvailable && !i.hasVariants && !(i.trackStock && i.stock <= 0))

// "Salad, Chips" — or '' when there are none
export const sidesLabel = (value) => parseSides(value).map(s => s.name).join(', ')
