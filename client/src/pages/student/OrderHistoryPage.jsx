import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Clock, ChevronRight, RotateCcw, Package, Trash2 } from 'lucide-react'
import { orderAPI, restaurantAPI } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'
import { useCustomerStore, useCartStore, useUIStore } from '../../store'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready!', on_the_way: 'On the Way', picked_up: 'Picked Up', cancelled: 'Cancelled' }

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [deletingId, setDeletingId] = useState(null)
  const [reorderingId, setReorderingId] = useState(null)
  const { customer: student } = useCustomerStore()
  const { addItem } = useCartStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { openCart } = useUIStore()
  // Opened from the cart: return to the page it was on and slide the cart back open
  const goBack = () => {
    const back = location.state
    if (back?.fromCart) openCart()
    navigate(back?.from || '/')
  }

  const load = () => orderAPI.customerHistory(student.id).then(r => { setOrders(r.data.data); setLoading(false) }).catch(() => setLoading(false))

  useEffect(() => {
    if (!student) { navigate('/auth'); return }
    load()
    // Coming back to the tab/app — the statuses may have moved on while it was in the background
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [student])

  // Keep statuses live while the page is open (the customer's socket room gets every change to their orders)
  useSocket({
    'order:updated': (updated) => setOrders(prev => prev.map(o => o.id === updated.id
      ? { ...o, status: updated.status, cancelReason: updated.cancelReason, cancelledBy: updated.cancelledBy }
      : o))
  })

  // Puts the order's items back in the cart at today's menu prices (the cart shows what the order
  // will actually cost), in the same quantities, leaving out anything no longer on offer.
  const handleReorder = async (order) => {
    setReorderingId(order.id)
    try {
      const r = (await restaurantAPI.get(order.restaurantId)).data.data
      const restaurant = {
        id: r.id, name: r.name, emoji: r.emoji,
        offersPickup: r.offersPickup, offersDelivery: r.offersDelivery,
        offersCampusDelivery: r.offersCampusDelivery, offersOffCampusDelivery: r.offersOffCampusDelivery,
        campusDeliveryFee: r.campusDeliveryFee, offCampusDeliveryFee: r.offCampusDeliveryFee,
      }
      const unavailable = []
      let added = 0
      for (const item of order.items) {
        const m = r.items.find(mi => mi.id === item.menuItemId)
        const variant = item.variantId ? m?.variants?.find(v => v.id === item.variantId) : null
        if (!m || !m.isAvailable || (item.variantId ? !variant?.isAvailable : m.hasVariants)) { unavailable.push(item.menuItemName); continue }
        for (let n = 0; n < item.quantity; n++) addItem({ id: m.id, name: m.name, price: m.price, emoji: m.emoji }, restaurant, variant)
        added++
      }
      if (added === 0) { toast.error('None of these items are available anymore'); return }
      if (unavailable.length) toast(`Added to cart. No longer available: ${unavailable.join(', ')}`, { icon: '🛒', duration: 6000 })
      else toast.success('Items added to cart!')
      navigate(`/restaurant/${r.id}`)
    } catch (e) {
      toast.error(e.response?.status === 404 ? 'This restaurant is no longer available' : 'Could not reorder — try again')
    } finally { setReorderingId(null) }
  }

  // Removes the order from this list only. A pending order is cancelled too, so warn about that;
  // an order the restaurant is already working on still goes ahead.
  const handleDelete = async (order) => {
    const warning = order.status === 'pending'
      ? 'This order is still pending. Deleting it will also cancel it. Continue?'
      : ['picked_up', 'cancelled'].includes(order.status)
        ? 'Delete this order from your history?'
        : 'Delete this order from your history? The restaurant is already working on it, so it will NOT be cancelled.'
    if (!window.confirm(warning)) return
    setDeletingId(order.id)
    try {
      const res = await orderAPI.removeFromHistory(order.id)
      setOrders(prev => prev.filter(o => o.id !== order.id))
      toast.success(res.data.data.cancelled ? 'Order cancelled and deleted' : 'Order deleted')
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete') }
    finally { setDeletingId(null) }
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  return (
    <div className="min-h-dvh bg-alu-bg">
      <div className="bg-alu-surface border-b border-alu-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="btn btn-ghost btn-icon"><ArrowLeft size={18} /></button>
          <h1 className="font-bold text-alu-cream">Order History</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-4">
          {['all', 'pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'picked_up', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition ${filter === f ? 'bg-alu-red text-white' : 'bg-alu-surface text-alu-muted hover:bg-alu-card hover:text-alu-cream border border-alu-border'}`}>
              {f === 'all' ? 'All' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="text-alu-muted/40 mx-auto mb-3" />
            <p className="font-semibold text-alu-muted">No orders yet</p>
            <Link to="/" className="btn btn-primary mt-4">Browse Restaurants</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => (
              <div key={order.id} className="card p-4 animate-fade-up">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{order.restaurant?.emoji}</span>
                    <div>
                      <p className="font-bold text-alu-cream text-sm">{order.restaurant?.name}</p>
                      <p className="text-xs text-alu-muted flex items-center gap-1">
                        <Clock size={10} />{format(new Date(order.createdAt), 'dd MMM · HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status]}</span>
                    <p className="font-bold text-alu-cream text-sm mt-1">{order.totalPrice.toLocaleString()} RWF</p>
                  </div>
                </div>
                <p className="text-xs text-alu-muted mb-3 line-clamp-1">
                  {order.items.map(i => `${i.quantity}× ${i.menuItemName}`).join(', ')}
                </p>
                {order.status === 'cancelled' && order.cancelledBy === 'restaurant' && order.cancelReason && order.cancelReason !== 'Cancelled by restaurant' && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5 mb-3 line-clamp-2">
                    Restaurant: “{order.cancelReason}”
                  </p>
                )}
                <div className="flex gap-2">
                  <Link to={`/order/track/${order.id}`} state={{ from: '/orders', fromState: location.state }} className="btn btn-secondary btn-sm flex-1">
                    <ChevronRight size={13} />Details
                  </Link>
                  {['picked_up', 'cancelled'].includes(order.status) && (
                    <button onClick={() => handleReorder(order)} disabled={reorderingId === order.id} className="btn btn-primary btn-sm flex-1">
                      <RotateCcw size={13} />Reorder
                    </button>
                  )}
                  <button onClick={() => handleDelete(order)} disabled={deletingId === order.id} aria-label="Delete order" title="Delete order"
                    className="btn btn-secondary btn-sm btn-icon text-red-400 hover:text-red-300">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
