import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle, MapPin, Backpack, Home, Radar } from 'lucide-react'
import { fetchOrder, getRememberedOrder, rememberOrder } from '../../lib/earlyData'

export default function OrderConfirmPageImpl() {
  const { id } = useParams()
  // Placing the order already returned it in full (see CartDrawer), so show that straight away;
  // the fetch below still brings it up to date
  const [order, setOrder] = useState(() => getRememberedOrder(id))
  // null while loading or loaded; 'missing' (no such order) or 'failed' (couldn't reach the server)
  const [loadError, setLoadError] = useState(null)

  const load = () => {
    setLoadError(null)
    fetchOrder(id)
      .then(o => { rememberOrder(o); setOrder(o) })
      .catch(e => setLoadError(e?.response?.status === 404 ? 'missing' : 'failed'))
  }
  useEffect(load, [id])

  // Only when there's nothing to show — a remembered order stays on screen if the refresh fails
  if (!order && loadError) return (
    <div className="min-h-dvh bg-alu-bg flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-sm text-center">
        <p className="text-4xl mb-3">{loadError === 'missing' ? '🔍' : '📡'}</p>
        <h1 className="font-bold text-alu-cream text-lg">{loadError === 'missing' ? "We couldn't find this order" : "Couldn't load your order"}</h1>
        <p className="text-alu-muted text-sm mt-1">
          {loadError === 'missing' ? 'It may have been removed. Your other orders are in Order History.' : 'Check your connection and try again. If you placed it, it is in your Order History.'}
        </p>
        <div className="flex gap-2 mt-5">
          {loadError === 'failed' && <button onClick={load} className="btn btn-primary flex-1">Try again</button>}
          <Link to="/orders" className="btn btn-secondary flex-1">Order History</Link>
        </div>
      </div>
    </div>
  )
  if (!order) return <div className="min-h-dvh flex items-center justify-center"><div className="text-4xl animate-pulse">🎉</div></div>

  const isDelivery = order.fulfillmentType === 'delivery'

  return (
    <div className="min-h-dvh bg-alu-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-up">
        {/* Success */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-alu-success/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
            <CheckCircle size={40} className="text-alu-success-fg" />
          </div>
          <h1 className="text-2xl font-black text-alu-cream">Order Placed!</h1>
          <p className="text-alu-muted mt-1">{isDelivery ? 'Your order is being prepared for delivery' : 'Your order is being prepared'}</p>
        </div>

        {/* Order number */}
        <div className="card p-5 mb-4 text-center border-2 border-dashed border-alu-red/30">
          <p className="text-xs font-bold uppercase tracking-wider text-alu-muted mb-1">Order Reference</p>
          <p className="text-3xl font-black text-alu-red font-mono">{order.orderNumber}</p>
          <p className="text-sm text-alu-muted mt-1">from {order.restaurant?.name}</p>
        </div>

        {/* Items */}
        <div className="card p-5 mb-4">
          <h3 className="font-bold text-alu-cream mb-3">What you ordered</h3>
          <div className="space-y-2">
            {order.items.map(item => (
              <div key={item.id} className="flex justify-between gap-3 text-sm">
                <span className="text-alu-muted min-w-0">
                  {item.quantity}× {item.menuItemName}
                  {item.notes && <span className="block text-xs italic break-words">“{item.notes}”</span>}
                </span>
                <span className="font-semibold text-alu-cream">{item.subtotal.toLocaleString()} RWF</span>
              </div>
            ))}
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-alu-success-fg border-t border-alu-border pt-2">
                <span>Discount</span><span>−{order.discountAmount.toLocaleString()} RWF</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-alu-muted border-t border-alu-border pt-2">
                <span>Delivery fee</span><span>{order.deliveryFee.toLocaleString()} RWF</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-alu-cream border-t border-alu-border pt-2">
              <span>Total</span><span className="text-alu-red">{order.totalPrice.toLocaleString()} RWF</span>
            </div>
          </div>
          {order.specialInstructions && (
            <div className="mt-3 bg-alu-card rounded-xl p-3 text-sm text-alu-muted">📝 {order.specialInstructions}</div>
          )}
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 gap-3 mb-5">
          <div className="card p-4 text-center">
            {isDelivery ? <Backpack size={20} className="text-alu-red mx-auto mb-1" /> : <MapPin size={20} className="text-alu-red mx-auto mb-1" />}
            <p className="text-xs text-alu-muted">{isDelivery ? `Delivering ${order.deliveryScope === 'off_campus' ? 'off campus' : 'on campus'} to` : 'Pickup at'}</p>
            <p className="font-bold text-sm text-alu-cream">{isDelivery ? order.deliveryLocation : order.restaurant?.location}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Link to={`/order/track/${order.id}`} className="btn btn-primary flex-1">
            <Radar size={16} />Track Order
          </Link>
          <Link to="/" className="btn btn-secondary flex-1">
            <Home size={16} />Home
          </Link>
        </div>
      </div>
    </div>
  )
}
