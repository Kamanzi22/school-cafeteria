import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Backpack, ArrowLeft, Loader, MapPin, RefreshCw } from 'lucide-react'
import { superAdminAPI } from '../../services/api'
import { useSocket, getSocket } from '../../hooks/useSocket'
import { format } from 'date-fns'

const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-ink-100 text-ink-500' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-100 text-blue-600' },
  preparing: { label: 'Preparing', cls: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Ready for Pickup', cls: 'bg-emerald-100 text-emerald-700' },
  picked_up: { label: 'Picked Up', cls: 'bg-ink-100 text-ink-400' },
}

const shortId = (id) => id ? id.slice(-8) : '—'

const getStoredSuperAdminToken = () => {
  try { return JSON.parse(localStorage.getItem('cc-superadmin-v1') || '{}')?.state?.token || null } catch { return null }
}

export default function DeliveryPage() {
  const navigate = useNavigate()
  const [token] = useState(getStoredSuperAdminToken)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { navigate('/superadmin'); return }
    load()
    getSocket().emit('join:superadmin', { token })
  }, [token])

  const load = () => {
    setLoading(true)
    superAdminAPI.getDeliveryOrders()
      .then(r => setOrders(r.data.data))
      .finally(() => setLoading(false))
  }

  // Live updates — a delivery order was placed, changed status, or got cancelled.
  useSocket({
    'delivery:order': (order) => {
      setOrders(prev => {
        if (order.status === 'cancelled') return prev.filter(o => o.id !== order.id)
        const exists = prev.some(o => o.id === order.id)
        return exists ? prev.map(o => o.id === order.id ? order : o) : [order, ...prev]
      })
    }
  })

  if (!token) return null

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="gradient-dark text-white px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/superadmin" className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <Backpack size={22} className="text-brand-400" />
              <div><p className="font-black text-lg">Delivery</p><p className="text-ink-400 text-xs">CaféCampus Platform</p></div>
            </div>
          </div>
          <button onClick={load} className="btn btn-ghost text-ink-400 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100">
            <h2 className="font-bold text-ink-900">Delivery Orders</h2>
            <p className="text-ink-400 text-xs mt-0.5">Everyone who chose delivery, newest first. Updates live as orders come in and change status.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wider">
                {['Customer','Restaurant','Meal','Location','Ready for Pickup'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader className="animate-spin text-brand-500 mx-auto" /></td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400">No delivery orders yet</td></tr>
                ) : orders.map(o => {
                  const meta = STATUS_META[o.status] || STATUS_META.pending
                  const isReady = o.status === 'ready'
                  return (
                    <tr key={o.id} className={`border-b border-ink-50 ${isReady ? 'bg-emerald-50/60' : 'hover:bg-ink-50'}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-900">{o.customer?.name || o.guestName || 'Guest'}</p>
                        <p className="text-xs text-ink-400" title={o.customerId}>ID: {shortId(o.customerId)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{o.restaurant?.emoji}</span>
                          <span className="text-ink-900 font-medium">{o.restaurant?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-700 text-xs max-w-[220px]">
                        {o.items?.map(i => `${i.quantity}x ${i.menuItemName}`).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1 text-ink-700 text-xs">
                          <MapPin size={11} className="shrink-0 text-ink-400" />
                          {o.deliveryScope === 'off_campus' ? 'Off campus: ' : 'On campus: '}{o.deliveryLocation}
                        </p>
                        <p className="text-ink-300 text-xs mt-0.5">{format(new Date(o.createdAt), 'dd MMM HH:mm')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${meta.cls} ${isReady ? 'animate-pulse' : ''}`}>{meta.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
