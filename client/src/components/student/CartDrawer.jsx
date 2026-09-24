import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Minus, Trash2, ShoppingBag, ChevronRight, Loader, Backpack, MapPin } from 'lucide-react'
import { useCartStore, useCustomerStore, useUIStore } from '../../store'
import { orderAPI } from '../../services/api'
import { enableNotifications } from '../../services/push'
import toast from 'react-hot-toast'

export default function CartDrawer() {
  const { cartOpen, closeCart } = useUIStore()
  const { items, setQty, remove, clear, subtotal, count, byRestaurant } = useCartStore()
  const { customer } = useCustomerStore()
  const [placing, setPlacing] = useState(false)
  // Per-restaurant fulfillment choice: { [restaurantId]: { type: 'pickup'|'delivery', scope: 'campus'|'off_campus', location: '' } }
  const [fulfillment, setFulfillment] = useState({})
  const navigate = useNavigate()

  const groups = byRestaurant()
  const cartSubtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const scopeFee = (g, scope) => scope === 'off_campus' ? g.offCampusDeliveryFee : g.campusDeliveryFee
  const deliveryFeeTotal = groups.reduce((s, g) => s + (fulfillment[g.id]?.type === 'delivery' ? scopeFee(g, getFulfillment(g.id).scope) : 0), 0)
  const total = cartSubtotal + deliveryFeeTotal

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
