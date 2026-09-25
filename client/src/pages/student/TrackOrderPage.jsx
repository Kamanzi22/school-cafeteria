import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Clock, X, Star, Loader } from 'lucide-react'
import { orderAPI, reviewAPI } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'
import { useCustomerStore } from '../../store'
import { showOrderStatusToast } from '../../hooks/useOrderNotifications'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const STEPS = [
  { key: 'pending', emoji: '📋', label: 'Order Placed', sub: 'Waiting for confirmation' },
  { key: 'confirmed', emoji: '✅', label: 'Confirmed', sub: 'Restaurant accepted your order' },
  { key: 'preparing', emoji: '👨‍🍳', label: 'Cooking', sub: 'Your food is cooking right now' },
  { key: 'ready', emoji: '🎉', label: 'Ready!', sub: 'Go pick up at the counter' },
]
const DELIVERY_STEP = { key: 'on_the_way', emoji: '🚴', label: 'Out for Delivery', sub: '' }

// Toast copy for a live status change seen on this page — guests aren't in a customer socket
// room, so this page is their only in-app notice. Signed-in customers also get the server's
// version via useOrderNotifications; the shared toast id means only one shows.
const statusToast = (order) => {
  const isDelivery = order.fulfillmentType === 'delivery'
  switch (order.status) {
    case 'confirmed': return { title: 'Order confirmed ✅', body: 'The restaurant accepted your order' }
    case 'preparing': return { title: 'Your food is cooking 👨‍🍳', body: 'The restaurant is preparing it now' }
    case 'ready': return { title: 'Your order is ready 🎉', body: isDelivery ? 'It will be on its way shortly' : 'Head over to pick it up' }
    case 'on_the_way': return { title: 'On its way 🚴', body: `Delivering to ${order.deliveryLocation}` }
    case 'picked_up': return { title: isDelivery ? 'Delivered 🍽️' : 'Picked up 🍽️', body: 'Enjoy your meal!' }
    case 'cancelled': return { title: 'Order cancelled ❌', body: order.cancelledBy === 'restaurant' && order.cancelReason ? order.cancelReason : 'Your order was cancelled' }
    default: return null
  }
}

export default function TrackOrderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [showReview, setShowReview] = useState(false)
  const [review, setReview] = useState({ foodRating: 5, serviceRating: 5, comment: '' })
  const [submitting, setSubmitting] = useState(false)
  const { customer: student } = useCustomerStore()

  const lastStatus = useRef(null)
  useEffect(() => { if (order) lastStatus.current = order.status }, [order?.status])

  const socket = useSocket({
    'order:updated': (updated) => {
      if (updated.id !== id) return
      // Several events can carry the same status (e.g. a refetch) — only toast on a real change.
      const copy = updated.status !== lastStatus.current && statusToast(updated)
      if (copy) showOrderStatusToast({ orderId: updated.id, status: updated.status, ...copy })
      // The superadmin delivery routes send a slimmer order (no status history/restaurant
      // details), so merge rather than replace to keep what the page already has.
      setOrder(prev => ({ ...prev, ...updated, restaurant: { ...prev?.restaurant, ...updated.restaurant }, statusHistory: updated.statusHistory || prev?.statusHistory }))
    }
  })

  useEffect(() => {
    socket.emit('join:order', id)
    orderAPI.get(id).then(r => setOrder(r.data.data)).catch(() => navigate('/orders'))
    return () => socket.emit('leave:order', id)
  }, [id])

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return
    try {
      const res = await orderAPI.cancel(id, 'Cancelled by customer')
      setOrder(res.data.data)
      toast.success('Order cancelled')
    } catch (e) { toast.error(e.response?.data?.error || 'Cannot cancel') }
  }

  const submitReview = async () => {
    setSubmitting(true)
    try {
      await reviewAPI.create({ orderId: id, customerId: student.id, ...review })
      toast.success('Review submitted! 🙏')
      setShowReview(false)
      setOrder(prev => ({ ...prev, review: review }))
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSubmitting(false) }
  }

  if (!order) return <div className="min-h-dvh flex items-center justify-center bg-alu-bg"><Loader size={24} className="animate-spin text-alu-red" /></div>

  const isCancelled = order.status === 'cancelled'
  const isDone = order.status === 'picked_up'
  const isDelivery = order.fulfillmentType === 'delivery'
  const deliveryLabel = order.deliveryScope === 'off_campus' ? 'off campus' : 'on campus'
  const steps = [
    ...STEPS.map(s => s.key === 'ready'
      ? { ...s, label: isDelivery ? 'Packed & Ready' : 'Ready!', sub: isDelivery ? 'Waiting for a delivery runner to pick it up' : 'Go pick up at the counter' }
      : s),
    ...(isDelivery ? [{ ...DELIVERY_STEP, sub: `Delivering ${deliveryLabel} to ${order.deliveryLocation}` }] : []),
    isDelivery
      ? { key: 'picked_up', emoji: '🚚', label: 'Delivered', sub: 'Enjoy your meal!' }
      : { key: 'picked_up', emoji: '🍽️', label: 'Picked Up', sub: 'Enjoy your meal!' },
  ]
  // When each step happened, from the timestamps the server stamps on every transition.
  const STEP_TIMES = { pending: order.createdAt, confirmed: order.confirmedAt, preparing: order.preparingAt, ready: order.readyAt, on_the_way: order.onTheWayAt, picked_up: order.pickedUpAt }
  // A cancelled order shows the steps it got through, then the cancellation in their place.
  const reachedIdx = isCancelled
    ? steps.reduce((last, st, i) => STEP_TIMES[st.key] ? i : last, 0)
    : Math.max(0, steps.findIndex(st => st.key === order.status))
  const visibleSteps = isCancelled ? steps.slice(0, reachedIdx + 1) : steps
  const cancelledByRestaurant = order.cancelledBy === 'restaurant'
  const restaurantNote = cancelledByRestaurant && order.cancelReason && order.cancelReason !== 'Cancelled by restaurant' ? order.cancelReason : null

  return (
    <div className="min-h-dvh bg-alu-bg">
      {/* Header */}
      <div className="gradient-dark text-white px-4 pt-4 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/')} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition">
              <ArrowLeft size={18} />
            </button>
            <h1 className="font-bold text-lg">HOME</h1>
          </div>
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-white/50 text-xs mb-1">Order Number</p>
            <p className="font-black text-2xl font-mono text-alu-gold">{order.orderNumber}</p>
            <p className="text-white/60 text-sm mt-1">{order.restaurant?.name} · {order.totalPrice.toLocaleString()} RWF</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-10">
        {/* Status card */}
        <div className="card p-5 mb-4 -mt-1">
          {isCancelled ? (
            <div className="text-center pt-2 pb-4">
              <div className="text-4xl mb-2">❌</div>
              <h2 className="font-bold text-xl text-red-400">Order Cancelled</h2>
              <p className="text-alu-muted text-sm mt-1">
                {cancelledByRestaurant ? `${order.restaurant?.name || 'The restaurant'} cancelled this order` : 'You cancelled this order'}
                {order.cancelledAt && ` · ${format(new Date(order.cancelledAt), 'HH:mm')}`}
              </p>
              {restaurantNote && (
                <div className="mt-3 text-left bg-red-500/10 border border-red-500/25 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-400 mb-1">Note from the restaurant</p>
                  <p className="text-sm text-alu-cream whitespace-pre-line break-words">{restaurantNote}</p>
                </div>
              )}
            </div>
          ) : isDone ? (
            <div className="text-center pt-2 pb-4">
              <div className="text-4xl mb-2">{isDelivery ? '🚚' : '🍽️'}</div>
              <h2 className="font-bold text-xl text-alu-success-fg">{isDelivery ? 'Delivered!' : 'Picked Up!'}</h2>
              <p className="text-alu-muted text-sm">Enjoy!</p>
              {!order.review && student && (
                <button onClick={() => setShowReview(true)} className="btn btn-primary mt-4">
                  <Star size={15} />Leave a Review
                </button>
              )}
            </div>
          ) : (
            <>
              {order.status === 'ready' && (
                <div className="bg-alu-success/10 border border-alu-success/25 rounded-xl p-4 mb-4 text-center">
                  <p className="font-bold text-alu-success-fg text-lg">{isDelivery ? '📦 Ready!' : '🎉 Ready for pickup!'}</p>
                  <p className="text-alu-success-fg/70 text-sm">{isDelivery ? 'Waiting for a delivery runner to pick it up' : `Head to ${order.restaurant?.location} now`}</p>
                </div>
              )}
              {order.status === 'on_the_way' && (
                <div className="bg-alu-success/10 border border-alu-success/25 rounded-xl p-4 mb-4 text-center">
                  <p className="font-bold text-alu-success-fg text-lg">🚚 On its way!</p>
                  <p className="text-alu-success-fg/70 text-sm">Delivering {deliveryLabel} to {order.deliveryLocation}</p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            {visibleSteps.map((step, i) => {
              const done = i <= reachedIdx
              const current = !isCancelled && !isDone && i === reachedIdx
              const at = STEP_TIMES[step.key]
              return (
                <div key={step.key} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${current ? 'bg-alu-red/10 border border-alu-red/25' : done ? 'opacity-70' : 'opacity-30'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-alu-red' : 'bg-alu-card'}`}>
                    {done ? <CheckCircle size={18} className="text-white" /> : <span className="text-lg">{step.emoji}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${current ? 'text-alu-red' : 'text-alu-cream'}`}>{step.label}</p>
                    <p className="text-xs text-alu-muted">{step.sub}</p>
                  </div>
                  {done && at && <span className="text-xs text-alu-muted shrink-0">{format(new Date(at), 'HH:mm')}</span>}
                  {current && <div className="w-2 h-2 bg-alu-red rounded-full animate-pulse shrink-0" />}
                </div>
              )
            })}
            {isCancelled && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-red-500">
                  <X size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-red-400">Cancelled</p>
                  <p className="text-xs text-alu-muted">{cancelledByRestaurant ? 'By the restaurant' : 'By you'}</p>
                </div>
                {order.cancelledAt && <span className="text-xs text-alu-muted shrink-0">{format(new Date(order.cancelledAt), 'HH:mm')}</span>}
              </div>
            )}
          </div>

          {!isCancelled && !isDone && order.estimatedReadyAt && (
            <div className="mt-3 bg-alu-card rounded-xl p-3 flex items-center gap-2 text-sm text-alu-muted">
              <Clock size={15} className="text-alu-red shrink-0" />
              Ready at <strong className="ml-1 text-alu-cream">{format(new Date(order.estimatedReadyAt), 'HH:mm')}</strong>
              <span className="text-alu-muted ml-1">({formatDistanceToNow(new Date(order.estimatedReadyAt), { addSuffix: true })})</span>
            </div>
          )}
        </div>

        {/* Order items */}
        <div className="card p-4 mb-4">
          <h3 className="font-bold text-alu-cream mb-3">Order Summary</h3>
          <div className="space-y-1.5">
            {order.items?.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-alu-muted">{item.quantity}× {item.menuItemName}</span>
                <span className="font-medium text-alu-cream">{item.subtotal.toLocaleString()} RWF</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-alu-cream border-t border-alu-border pt-2 mt-2">
              <span>Total</span><span>{order.totalPrice.toLocaleString()} RWF</span>
            </div>
          </div>
        </div>

        {order.status === 'pending' && (
          <button onClick={handleCancel} className="btn btn-danger w-full mb-3">
            <X size={16} />Cancel Order
          </button>
        )}
        <Link to="/orders" className="btn btn-secondary w-full">My Order History</Link>
      </div>

      {/* Review modal */}
      {showReview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="card p-6 w-full max-w-sm animate-slide-up">
            <h3 className="font-bold text-lg text-alu-cream mb-4">How was your order?</h3>
            {[['Food', 'foodRating'], ['Service', 'serviceRating']].map(([label, key]) => (
              <div key={key} className="mb-4">
                <p className="text-sm font-medium text-alu-muted mb-2">{label}</p>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setReview(r => ({ ...r, [key]: n }))}
                      className={`text-2xl transition-transform hover:scale-110 ${n <= review[key] ? '' : 'grayscale opacity-40'}`}>⭐</button>
                  ))}
                </div>
              </div>
            ))}
            <textarea value={review.comment} onChange={e => setReview(r => ({ ...r, comment: e.target.value }))}
              placeholder="Share your experience…" className="input resize-none h-24 mb-4 text-sm" />
            <div className="flex gap-3">
              <button onClick={() => setShowReview(false)} className="btn btn-secondary flex-1">Skip</button>
              <button onClick={submitReview} disabled={submitting} className="btn btn-primary flex-1">
                {submitting ? <Loader size={14} className="animate-spin" /> : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
