import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Minus, Trash2, ShoppingBag, ChevronRight, Loader, Backpack, MapPin, Tag } from 'lucide-react'
import { useCartStore, useCustomerStore, useUIStore } from '../../store'
import { orderAPI, restaurantAPI, promoAPI } from '../../services/api'
import { promoDiscount, promoHeadline } from '../../lib/promo'
import { enableNotifications } from '../../services/push'
import toast from 'react-hot-toast'

export default function CartDrawer() {
  const { cartOpen, closeCart } = useUIStore()
  const { items, setQty, remove, clear, subtotal, count, byRestaurant, promoCodes, setPromoCode } = useCartStore()
  const { customer } = useCustomerStore()
  const [placing, setPlacing] = useState(false)
  // Per-restaurant fulfillment choice: { [restaurantId]: { type: 'pickup'|'delivery', scope: 'campus'|'off_campus', location: '' } }
  const [fulfillment, setFulfillment] = useState({})
  // Cart items only carry a snapshot of each store's delivery offering from whenever they were
  // added — a restaurant can flip "Offer delivery" on any time after that, so refetch live on
  // open rather than trusting the stale snapshot (which would otherwise hide the toggle even
  // after delivery is turned on).
  const [liveRestaurants, setLiveRestaurants] = useState({})
  // What's typed in each restaurant's promo box, and promos confirmed by the server that aren't
  // in the live list yet (e.g. the restaurant fetch hasn't come back).
  const [promoInput, setPromoInput] = useState({})
  const [validatedPromos, setValidatedPromos] = useState({})
  const [promoLoading, setPromoLoading] = useState(null)
  const navigate = useNavigate()

  const rawGroups = byRestaurant()
  const restaurantIds = rawGroups.map(g => g.id).join(',')
  useEffect(() => {
    if (!cartOpen || !restaurantIds) return
    Promise.all(restaurantIds.split(',').map(id => restaurantAPI.get(id).then(r => [id, r.data.data]).catch(() => null)))
      .then(pairs => setLiveRestaurants(prev => ({ ...prev, ...Object.fromEntries(pairs.filter(Boolean)) })))
  }, [cartOpen, restaurantIds])

  const groups = rawGroups.map(g => {
    const live = liveRestaurants[g.id]
    const withLive = live ? { ...g, offersPickup: live.offersPickup, offersDelivery: live.offersDelivery, offersCampusDelivery: live.offersCampusDelivery, offersOffCampusDelivery: live.offersOffCampusDelivery, campusDeliveryFee: live.campusDeliveryFee, offCampusDeliveryFee: live.offCampusDeliveryFee } : g
    const promotions = live?.promotions || []
    const code = promoCodes[g.id]
    const promo = code ? (promotions.find(p => p.code === code) || validatedPromos[g.id]?.code === code && validatedPromos[g.id]) || null : null
    const groupSubtotal = g.items.reduce((s, i) => s + i.price * i.qty, 0)
    return { ...withLive, promotions, promo, groupSubtotal, discount: promoDiscount(promo, groupSubtotal) }
  })
  const cartSubtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const scopeFee = (g, scope) => scope === 'off_campus' ? g.offCampusDeliveryFee : g.campusDeliveryFee
  const deliveryFeeTotal = groups.reduce((s, g) => s + (fulfillment[g.id]?.type === 'delivery' ? scopeFee(g, getFulfillment(g.id).scope) : 0), 0)
  const discountTotal = groups.reduce((s, g) => s + g.discount, 0)
  const total = cartSubtotal - discountTotal + deliveryFeeTotal

  // A code picked on the restaurant page (or earlier) that has since expired/been switched off
  // disappears from the live list — drop it once that list has loaded so it isn't sent silently.
  useEffect(() => {
    for (const g of groups) {
      if (promoCodes[g.id] && liveRestaurants[g.id] && !g.promo) setPromoCode(g.id, null)
    }
  }, [liveRestaurants])

  const applyPromo = async (group, code) => {
    code = (code || '').trim().toUpperCase()
    if (!code) return
    setPromoLoading(group.id)
    try {
      const res = await promoAPI.validate({ code, restaurantId: group.id, subtotal: group.groupSubtotal })
      setValidatedPromos(prev => ({ ...prev, [group.id]: res.data.data.promo }))
      setPromoCode(group.id, code)
      setPromoInput(prev => ({ ...prev, [group.id]: '' }))
      toast.success(`Promo applied! −${res.data.data.discount.toLocaleString()} RWF`)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Invalid code')
    } finally { setPromoLoading(null) }
  }

  function getFulfillment(restaurantId) {
    const group = groups.find(g => g.id === restaurantId)
    const defaultScope = group?.offersCampusDelivery ? 'campus' : 'off_campus'
    const defaultType = group && !group.offersPickup && group.offersDelivery ? 'delivery' : 'pickup'
    return fulfillment[restaurantId] || { type: defaultType, location: '', scope: defaultScope }
  }
  const setGroupFulfillment = (restaurantId, patch) =>
    setFulfillment(prev => ({ ...prev, [restaurantId]: { ...getFulfillment(restaurantId), ...patch } }))

  const placeOrder = async () => {
    if (!customer) { closeCart(); navigate('/auth'); return }
    if (items.length === 0) return
    for (const group of groups) {
      const f = getFulfillment(group.id)
      if (f.type === 'delivery' && !f.location.trim()) {
        toast.error(`Enter a delivery location for ${group.name}`)
        return
      }
    }
    // Straight from the click, so the browser lets the permission prompt show.
    enableNotifications().catch(() => {})
    setPlacing(true)
    try {
      const results = await Promise.all(groups.map(group => {
        const f = getFulfillment(group.id)
        return orderAPI.place({
          customerId: customer.id,
          restaurantId: group.id,
          items: group.items.map(i => ({ menuItemId: i.id, variantId: i.variantId || undefined, quantity: i.qty })),
          paymentMethod: 'cash',
          fulfillmentType: f.type,
          deliveryScope: f.type === 'delivery' ? f.scope : undefined,
          deliveryLocation: f.type === 'delivery' ? f.location.trim() : undefined,
          promoCode: group.promo ? group.promo.code : undefined,
        })
      }))
      clear()
      closeCart()
      setFulfillment({})
      navigate(`/order/confirm/${results[0].data.data.id}`)
      toast.success(`${results.length > 1 ? `${results.length} orders` : 'Order'} placed! 🎉`)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not place order')
    } finally { setPlacing(false) }
  }

  return (
    <>
      {cartOpen && <div className="fixed inset-0 bg-ink-950/50 z-40 backdrop-blur-sm" onClick={closeCart} />}
      <div className={`fixed right-0 top-0 h-dvh w-full max-w-[420px] bg-white z-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${cartOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div>
            <h2 className="font-bold text-ink-900">Your Order</h2>
            {items.length > 0 && <p className="text-xs text-ink-400 mt-0.5">{groups.length} store{groups.length !== 1 ? 's' : ''}</p>}
          </div>
          <button onClick={closeCart} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag size={48} className="text-ink-200 mb-4" />
              <p className="font-semibold text-ink-400 text-lg">Cart is empty</p>
              <p className="text-ink-300 text-sm mt-1">Add items from a restaurant to begin</p>
              <button onClick={closeCart} className="btn btn-secondary mt-5">Browse Restaurants</button>
            </div>
          ) : (
            <>
              {groups.map(group => {
                const f = getFulfillment(group.id)
                return (
                  <div key={group.id} className="mb-4">
                    <p className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-2">{group.emoji} {group.name}</p>
                    {group.items.map(item => (
                      <div key={item.key} className="flex items-center gap-3 bg-ink-50 rounded-2xl p-3 mb-2">
                        <span className="text-2xl">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-ink-900 truncate">{item.name}</p>
                          {item.variantName && <p className="text-xs text-ink-500">{item.variantName}</p>}
                          <p className="text-xs text-ink-400">{item.price.toLocaleString()} RWF each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setQty(item.key, item.qty - 1)} className="w-7 h-7 rounded-lg bg-white border border-ink-200 flex items-center justify-center text-ink-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors">
                            {item.qty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                          </button>
                          <span className="font-bold text-sm text-ink-900 w-5 text-center">{item.qty}</span>
                          <button onClick={() => setQty(item.key, item.qty + 1)} className="w-7 h-7 rounded-lg bg-flame-500 flex items-center justify-center text-white hover:bg-flame-600 transition-colors">
                            <Plus size={12} />
                          </button>
                        </div>
                        <p className="font-bold text-sm text-ink-900 w-20 text-right">{(item.price * item.qty).toLocaleString()}</p>
                      </div>
                    ))}

                    {/* Fulfillment choice — only shown if this store offers delivery */}
                    {group.offersDelivery && (group.offersCampusDelivery || group.offersOffCampusDelivery) && (
                      <div className="mt-1">
                        {group.offersPickup ? (
                          <div className="flex gap-2">
                            <button onClick={() => setGroupFulfillment(group.id, { type: 'pickup' })}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${f.type === 'pickup' ? 'border-flame-500 bg-flame-50 text-flame-600' : 'border-ink-200 text-ink-500'}`}>
                              <MapPin size={13} /> Pickup
                            </button>
                            <button onClick={() => setGroupFulfillment(group.id, { type: 'delivery' })}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition ${f.type === 'delivery' ? 'border-flame-500 bg-flame-50 text-flame-600' : 'border-ink-200 text-ink-500'}`}>
                              <Backpack size={13} /> Delivery
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] font-semibold text-ink-500 flex items-center gap-1.5">
                            <Backpack size={12} /> Delivery only — this is a virtual store with no pickup location
                          </p>
                        )}
                        {f.type === 'delivery' && (
                          <>
                            {group.offersCampusDelivery && group.offersOffCampusDelivery && (
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => setGroupFulfillment(group.id, { scope: 'campus' })}
                                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition ${f.scope === 'campus' ? 'border-flame-500 bg-flame-50 text-flame-600' : 'border-ink-200 text-ink-500'}`}>
                                  🏬 On campus{group.campusDeliveryFee > 0 ? ` (+${group.campusDeliveryFee.toLocaleString()})` : ''}
                                </button>
                                <button onClick={() => setGroupFulfillment(group.id, { scope: 'off_campus' })}
                                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition ${f.scope === 'off_campus' ? 'border-flame-500 bg-flame-50 text-flame-600' : 'border-ink-200 text-ink-500'}`}>
                                  🌆 Off campus{group.offCampusDeliveryFee > 0 ? ` (+${group.offCampusDeliveryFee.toLocaleString()})` : ''}
                                </button>
                              </div>
                            )}
                            <input value={f.location} onChange={e => setGroupFulfillment(group.id, { location: e.target.value })}
                              placeholder={f.scope === 'off_campus' ? 'Delivery address (e.g. Kacyiru, KG 5 Ave)' : 'Delivery location (e.g. Dorm B, Room 204)'}
                              className="input text-sm mt-2" />
                          </>
                        )}
                      </div>
                    )}

                    {/* Promo — the applied code, or this store's offers + a box to type one */}
                    {group.promo ? (
                      <div className="mt-2 flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                        <Tag size={12} className="text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-emerald-700 truncate">{group.promo.code} · {group.promo.title}</p>
                          {group.discount > 0
                            ? <p className="text-emerald-600">−{group.discount.toLocaleString()} RWF</p>
                            : <p className="text-amber-600">Add {(group.promo.minOrder - group.groupSubtotal).toLocaleString()} RWF more to use this code</p>}
                        </div>
                        <button onClick={() => setPromoCode(group.id, null)} className="text-ink-400 hover:text-red-500 p-1 -mr-1" title="Remove code"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="mt-2">
                        {group.promotions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {group.promotions.map(p => (
                              <button key={p.id} onClick={() => applyPromo(group, p.code)} disabled={promoLoading === group.id}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1">
                                <Tag size={10} />{promoHeadline(p)} · {p.code}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input value={promoInput[group.id] || ''} onChange={e => setPromoInput(prev => ({ ...prev, [group.id]: e.target.value.toUpperCase() }))}
                            onKeyDown={e => e.key === 'Enter' && applyPromo(group, promoInput[group.id])}
                            placeholder="Promo code" className="input text-sm flex-1 py-2" />
                          <button onClick={() => applyPromo(group, promoInput[group.id])} disabled={promoLoading === group.id || !promoInput[group.id]?.trim()}
                            className="btn btn-secondary text-sm shrink-0 py-2">
                            {promoLoading === group.id ? <Loader size={14} className="animate-spin" /> : 'Apply'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-ink-100 px-5 py-5 space-y-4">
            {/* Price breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-500">
                <span>Subtotal ({count()} items)</span>
                <span>{cartSubtotal.toLocaleString()} RWF</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>−{discountTotal.toLocaleString()} RWF</span>
                </div>
              )}
              {deliveryFeeTotal > 0 && (
                <div className="flex justify-between text-ink-500">
                  <span>Delivery fee</span>
                  <span>{deliveryFeeTotal.toLocaleString()} RWF</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-ink-900 text-base pt-1 border-t border-ink-100">
                <span>Total</span>
                <span>{total.toLocaleString()} RWF</span>
              </div>
              <p className="text-xs text-ink-400 text-center">💵 Pay cash on {groups.some(g => getFulfillment(g.id).type === 'delivery') ? 'delivery' : 'pickup'}</p>
            </div>

            <button onClick={placeOrder} disabled={placing}
              className="btn btn-primary w-full btn-lg">
              {placing ? <Loader size={18} className="animate-spin" /> : null}
              {placing ? 'Placing order…' : 'Place Order'}
              {!placing && <ChevronRight size={18} />}
            </button>
            <button onClick={clear} className="w-full text-xs text-ink-400 hover:text-red-400 transition-colors text-center">
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  )
}
