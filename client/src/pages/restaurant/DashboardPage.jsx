import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, ChefHat, Bell, DollarSign, ShoppingBag, Clock, X, RefreshCw, Loader, Bike, MapPin } from 'lucide-react'
import { orderAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import { useSocket, getSocket } from '../../hooks/useSocket'
import AdminLayout from '../../components/restaurant/AdminLayout'
import { format, formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_NEXT = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'picked_up' }
const BTN_LABELS = { pending: 'Confirm Order', confirmed: 'Start Cooking', preparing: 'Mark Ready', ready: 'Picked Up ✓' }
const BTN_ICONS = { pending: CheckCircle, confirmed: ChefHat, preparing: Bell, ready: CheckCircle }
const TABS = [
  { key: 'received', statuses: ['pending', 'confirmed'], label: 'Received', color: 'text-amber-600 bg-amber-100' },
  { key: 'preparing', statuses: ['preparing'], label: 'Cooking', color: 'text-orange-600 bg-orange-100' },
  { key: 'ready', statuses: ['ready'], label: 'Ready', color: 'text-emerald-600 bg-emerald-100' },
  { key: 'all', statuses: null, label: 'All Today', color: 'text-ink-600 bg-ink-100' },
]

function OrderCard({ order, onUpdate, isViewer }) {
  const [loading, setLoading] = useState(false)
  const nextStatus = STATUS_NEXT[order.status]
  const Icon = BTN_ICONS[order.status]
  const isNew = Date.now() - new Date(order.createdAt) < 90000

  const advance = async () => {
    setLoading(true)
    try {
      const res = await orderAPI.updateStatus(order.id, { status: nextStatus })
      onUpdate(res.data.data)
    } catch { toast.error('Failed to update') }
    finally { setLoading(false) }
  }

  const cancel = async () => {
    setLoading(true)
    try {
      const res = await orderAPI.updateStatus(order.id, { status: 'cancelled', cancelReason: 'Cancelled by restaurant' })
      onUpdate(res.data.data)
      toast.success('Order cancelled')
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className={`bg-white rounded-2xl border-2 p-4 transition-all duration-200 ${order.status === 'pending' ? 'border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.2)]' : order.status === 'ready' ? 'border-emerald-300' : 'border-ink-100'} ${isNew ? 'animate-scale-in' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-flame-500 text-sm">{order.orderNumber}</span>
            {isNew && <span className="badge bg-red-100 text-red-600 animate-pulse">🔴 NEW</span>}
            {order.fulfillmentType === 'delivery' && (
              <span className="badge bg-indigo-100 text-indigo-600"><Bike size={10} className="mr-0.5" />Delivery · {order.deliveryScope === 'off_campus' ? 'Off campus' : 'On campus'}</span>
            )}
          </div>
          <p className="font-bold text-ink-900 text-sm mt-0.5">{order.customer?.name}</p>
          <p className="text-xs text-ink-400">{order.customer?.studentId} · {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</p>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className="font-black text-ink-900">{order.totalPrice.toLocaleString()} <span className="text-xs font-normal text-ink-400">RWF</span></p>
          <p className="text-xs text-ink-400 mt-0.5">{format(new Date(order.createdAt), 'HH:mm')}</p>
        </div>
      </div>

      {/* Items */}
      <div className="bg-ink-50 rounded-xl p-3 mb-3 space-y-1.5">
        {order.items.map(item => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-ink-700 font-medium">
              <span className="text-base mr-1">{item.menuItemEmoji}</span>
              {item.quantity}× {item.menuItemName}
              {item.variantName && <span className="text-ink-400 font-normal"> ({item.variantName})</span>}
            </span>
            <span className="text-ink-500 shrink-0">{item.subtotal.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Delivery location */}
      {order.fulfillmentType === 'delivery' && order.deliveryLocation && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700 mb-3 flex items-center gap-1.5">
          <MapPin size={12} className="shrink-0" />Deliver to: {order.deliveryLocation}
        </div>
      )}

      {/* Notes */}
      {order.specialInstructions && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 mb-3">
          📝 {order.specialInstructions}
        </div>
      )}

      {/* ETA if set */}
      {order.estimatedReadyAt && (
        <p className="text-xs text-ink-400 flex items-center gap-1 mb-3">
          <Clock size={11} />Ready at {format(new Date(order.estimatedReadyAt), 'HH:mm')}
        </p>
      )}

      {/* Actions — hidden for a read-only viewer, since the server rejects these anyway */}
      {!isViewer && (
        <div className="flex gap-2">
          {nextStatus && (
            <button onClick={advance} disabled={loading}
              className="btn btn-primary flex-1 text-sm py-2.5">
              {loading ? <Loader size={14} className="animate-spin" /> : Icon ? <Icon size={14} /> : null}
              {BTN_LABELS[order.status]}
            </button>
          )}
          {['pending', 'confirmed'].includes(order.status) && (
            <button onClick={cancel} disabled={loading}
              className="btn btn-secondary text-red-500 border-red-200 hover:bg-red-50 p-2.5">
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('received')
  const [refreshing, setRefreshing] = useState(false)
  const { restaurant, token, role } = useAdminStore()
  const isViewer = role === 'viewer'

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await orderAPI.restaurantOrders(restaurant.id, { status: 'all' })
      setOrders(res.data.data)
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [restaurant.id])

  useSocket({
    'order:new': (order) => {
      if (order.restaurantId !== restaurant.id) return
      setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)])
      toast.success(`🔔 New order from ${order.customer?.name}!`, { duration: 6000 })
      try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA').play() } catch {}
    },
    'order:statusChanged': (updated) => {
      if (updated.restaurantId !== restaurant.id) return
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    },
    'order:cancelled': (updated) => {
      if (updated.restaurantId !== restaurant.id) return
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
      toast.error(`Order ${updated.orderNumber} cancelled by student`)
    }
  })

  useEffect(() => {
    getSocket().emit('join:restaurant', { id: restaurant.id, token })
    fetch()
    const iv = setInterval(() => fetch(true), 30000)
    return () => clearInterval(iv)
  }, [fetch])

  const updateOrder = (updated) => setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))

  const todayOrders = orders.filter(o => o.status !== 'cancelled')
  const revenue = todayOrders.reduce((s, o) => s + o.totalPrice, 0)
  const newCount = orders.filter(o => o.status === 'pending').length

  const filtered = activeTab === 'all' ? orders : orders.filter(o => TABS.find(t => t.key === activeTab).statuses.includes(o.status))
  const tabCount = (k) => {
    if (k === 'all') return orders.length
    const statuses = TABS.find(t => t.key === k).statuses
    return orders.filter(o => statuses.includes(o.status)).length
  }

  return (
    <AdminLayout newOrderCount={newCount}>
      <div className="p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-ink-900">Live Orders</h1>
            <p className="text-ink-400 text-sm">{format(new Date(), 'EEEE, d MMMM yyyy')} · auto-refreshes</p>
          </div>
          <button onClick={() => fetch(true)} disabled={refreshing} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {[
            { label: "Today's Orders", val: todayOrders.length, sub: 'not cancelled' },
            { label: "Today's Revenue", val: `${revenue.toLocaleString()} RWF`, sub: 'total' },
            { label: 'In Progress', val: orders.filter(o => !['ready', 'picked_up', 'cancelled'].includes(o.status)).length, sub: 'not yet ready', alert: newCount > 0 },
          ].map(s => (
            <div key={s.label} className={`card p-4 ${s.alert && s.val > 0 ? 'border-amber-300 bg-amber-50' : ''}`}>
              <p className="text-xs text-ink-400 mb-1">{s.label}</p>
              <p className={`font-black text-xl ${s.alert && s.val > 0 ? 'text-amber-600' : 'text-white'}`}>{s.val}</p>
              <p className="text-xs text-ink-300 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-5 bg-ink-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
              {t.label}
              {tabCount(t.key) > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.key ? t.color : 'bg-ink-200 text-ink-500'}`}>
                  {tabCount(t.key)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-52 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-5xl mb-4">{activeTab === 'received' ? '🎉' : '📋'}</p>
            <p className="font-bold text-ink-400 text-lg">{activeTab === 'received' ? 'No new orders right now' : `No ${activeTab} orders`}</p>
            <p className="text-ink-300 text-sm mt-1">New orders appear here instantly</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(order => <OrderCard key={order.id} order={order} onUpdate={updateOrder} isViewer={isViewer} />)}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
