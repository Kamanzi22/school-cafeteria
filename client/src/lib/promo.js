// Mirrors the server's discount math in routes/orders.js so the cart can show the discount
// live as quantities change. The server recomputes it when the order is placed.
export const promoDiscount = (promo, subtotal) => {
  if (!promo || subtotal < (promo.minOrder || 0)) return 0
  let d = promo.type === 'percentage' ? subtotal * (promo.value / 100) : promo.value
  if (promo.maxDiscount) d = Math.min(d, promo.maxDiscount)
  return Math.min(d, subtotal)
}

// Short headline for an offer, e.g. "20% off" or "500 RWF off".
export const promoHeadline = (promo) =>
  promo.type === 'percentage' ? `${promo.value}% off` : `${promo.value.toLocaleString()} RWF off`

// Fine print: minimum order, discount cap.
export const promoTerms = (promo) => [
  promo.minOrder > 0 && `Min. order ${promo.minOrder.toLocaleString()} RWF`,
  promo.type === 'percentage' && promo.maxDiscount && `up to ${promo.maxDiscount.toLocaleString()} RWF`,
].filter(Boolean).join(' · ')
