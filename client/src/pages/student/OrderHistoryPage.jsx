import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, ChevronRight, RotateCcw, Package } from 'lucide-react'
import { orderAPI } from '../../services/api'
import { useCustomerStore, useCartStore } from '../../store'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready!', picked_up: 'Picked Up', cancelled: 'Cancelled' }

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const { customer: student } = useCustomerStore()
  const { addItem } = useCartStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!student) { navigate('/auth'); return }
    orderAPI.customerHistory(student.id).then(r => { setOrders(r.data.data); setLoading(false) }).catch(() => setLoading(false))
  }, [student])

  const handleReorder = (order) => {
    order.items.forEach(item => {
      addItem({ id: item.menuItemId, name: item.menuItemName, price: item.unitPrice, emoji: item.menuItemEmoji }, { id: order.restaurantId, name: order.restaurant.name, emoji: order.restaurant.emoji })
    })
    toast.success('Items added to cart!')
    navigate(`/restaurant/${order.restaurantId}`)
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  return (
    <div className="min-h-screen bg-alu-bg">
      <div className="bg-alu-surface border-b border-alu-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon"><ArrowLeft size={18} /></button>
          <h1 className="font-bold text-alu-cream">Order History</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-4">
          {['all', 'pending', 'preparing', 'ready', 'picked_up', 'cancelled'].map(f => (
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
                <div className="flex gap-2">
                  <Link to={`/order/track/${order.id}`} className="btn btn-secondary btn-sm flex-1">
                    <ChevronRight size={13} />Details
                  </Link>
                  {['picked_up', 'cancelled'].includes(order.status) && (
                    <button onClick={() => handleReorder(order)} className="btn btn-primary btn-sm flex-1">
                      <RotateCcw size={13} />Reorder
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
