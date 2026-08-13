import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CheckCircle, Clock, MapPin, Truck, Receipt, Home, Radar } from 'lucide-react'
import { orderAPI } from '../../services/api'
import { format } from 'date-fns'

export default function OrderConfirmPageImpl() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)

  useEffect(() => { orderAPI.get(id).then(r => setOrder(r.data.data)) }, [id])

  if (!order) return <div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">🎉</div></div>

  const isDelivery = order.fulfillmentType === 'delivery'

  return (
    <div className="min-h-screen bg-alu-bg flex items-center justify-center p-4">
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
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-alu-muted">{item.quantity}× {item.menuItemName}</span>
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
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="card p-4 text-center">
            <Clock size={20} className="text-alu-red mx-auto mb-1" />
            <p className="text-xs text-alu-muted">Ready by</p>
            <p className="font-bold text-sm text-alu-cream">{order.estimatedReadyAt ? format(new Date(order.estimatedReadyAt), 'HH:mm') : '—'}</p>
          </div>
          <div className="card p-4 text-center">
            {isDelivery ? <Truck size={20} className="text-alu-red mx-auto mb-1" /> : <MapPin size={20} className="text-alu-red mx-auto mb-1" />}
            <p className="text-xs text-alu-muted">{isDelivery ? `Delivering ${order.deliveryScope === 'off_campus' ? 'off campus' : 'on campus'} to` : 'Pickup at'}</p>
            <p className="font-bold text-sm text-alu-cream">{isDelivery ? order.deliveryLocation : order.restaurant?.location}</p>
          </div>
        </div>

        <div className="bg-alu-surface border border-alu-border rounded-2xl p-4 text-center mb-5">
          <Receipt size={18} className="text-alu-gold mx-auto mb-1" />
          <p className="font-semibold text-alu-gold text-sm">{isDelivery ? 'Show this order number when it arrives' : 'Show this order number at pickup'}</p>
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
