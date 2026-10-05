// Sides picked for an order line ("+ Salad"). Orders store them as a JSON string, cart lines as
// an array; either way this hands back [{ id, name, price }].
export const parseSides = (value) => {
  if (Array.isArray(value)) return value
  try { const list = JSON.parse(value || '[]'); return Array.isArray(list) ? list : [] } catch { return [] }
}

// "Salad, Chips" — or '' when there are none
export const sidesLabel = (value) => parseSides(value).map(s => s.name).join(', ')
