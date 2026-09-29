import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader, Pencil, X, Search, ChevronLeft, ChevronRight, Backpack, Phone, Mail } from 'lucide-react'
import { orderAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import AdminLayout from '../../components/restaurant/AdminLayout'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_LABELS = { pending: 'Received', confirmed: 'Confirmed', preparing: 'Cooking', ready: 'Ready', on_the_way: 'On the way', picked_up: 'Picked up', cancelled: 'Cancelled' }
const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-amber-100 text-amber-700', preparing: 'bg-orange-100 text-orange-700',
  ready: 'bg-emerald-100 text-emerald-700', on_the_way: 'bg-indigo-100 text-indigo-700', picked_up: 'bg-sky-100 text-sky-700', cancelled: 'bg-red-100 text-red-600',
}
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Not finished' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'cancelled', label: 'Cancelled' },
]
const PAGE_SIZE = 30

// Lets staff correct an order after the fact — close out one that got stuck at "ready",
// undo a mistaken pickup, or cancel one that was never collected.
function EditOrderModal({ order, onClose, onSaved }) {
  const isDelivery = order.fulfillmentType === 'delivery'
  // Cancelled is final (stock has already gone back), and a picked-up order has to be moved back first
  const options = Object.keys(STATUS_LABELS).filter(s =>
    (s !== 'on_the_way' || isDelivery) && !(s === 'cancelled' && order.status === 'picked_up'))
  const [status, setStatus] = useState(order.status)
  const [note, setNote] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [notify, setNotify] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await orderAPI.updateStatus(order.id, { status, note, notify, ...(status === 'cancelled' ? { cancelReason } : {}) })
      onSaved(res.data.data)
      toast.success(`Order ${order.orderNumber} updated`)
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-lg text-ink-900">Edit order</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 p-1 -mr-1"><X size={18} /></button>
        </div>
        <p className="text-sm text-ink-500 mb-4">
          <span className="font-mono font-semibold text-flame-500">{order.orderNumber}</span> · {format(new Date(order.createdAt), 'd MMM yyyy · HH:mm')}
        </p>

        <label className="text-xs font-semibold text-ink-600 mb-1.5 block">Status</label>
        <select value={status} onChange={e => setStatus(e.target.value)} className="input w-full mb-3">
          {options.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>

        {status === 'cancelled' && status !== order.status && (
          <>
            <label className="text-xs font-semibold text-ink-600 mb-1.5 block">Reason shown to the customer <span className="font-normal text-ink-400">(optional)</span></label>
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} maxLength={300}
              placeholder="e.g. Never collected" className="input w-full text-sm mb-3" />
          </>
        )}

        <label className="text-xs font-semibold text-ink-600 mb-1.5 block">Staff note <span className="font-normal text-ink-400">(optional, not shown to the customer)</span></label>
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={300}
          placeholder="e.g. Collected yesterday, forgot to mark it" className="input w-full text-sm mb-3" />

        <label className="flex items-center gap-2 text-sm text-ink-600 mb-4 cursor-pointer">
          <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
          Notify the customer about this change
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving} className="btn btn-secondary flex-1 text-sm">Close</button>
          <button onClick={save} disabled={saving || status === order.status} className="btn btn-primary flex-1 text-sm">
            {saving && <Loader size={14} className="animate-spin" />}Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrderHistoryPage() {
  const { restaurant, role } = useAdminStore()
  const isViewer = role === 'viewer'
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const latestRequest = useRef(0)

  // Any filter change starts back at page 1
  const withReset = (setter) => (value) => { setter(value); setPage(1) }

  // Wait for a pause in typing before searching
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    const req = ++latestRequest.current
    setLoading(true)
    try {
      const res = await orderAPI.restaurantHistory(restaurant.id, { status, from: from || undefined, to: to || undefined, q: query || undefined, page, pageSize: PAGE_SIZE })
      // A newer filter/page request may have gone out while this one was in flight
      if (req !== latestRequest.current) return
      setOrders(res.data.data)
      setTotal(res.data.total)
    } catch { if (req === latestRequest.current) toast.error('Failed to load orders') }
    finally { if (req === latestRequest.current) setLoading(false) }
  }, [restaurant.id, status, from, to, query, page])

  useEffect(() => { load() }, [load])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const onSaved = (updated) => {
    // Drop it from the "Not finished" view once it's closed out; otherwise update in place
    if (status === 'open' && ['picked_up', 'cancelled'].includes(updated.status)) {
      setOrders(prev => prev.filter(o => o.id !== updated.id))
      setTotal(t => t - 1)
    } else {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    }
    setEditing(null)
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-ink-900">Order History</h1>
          <p className="text-ink-400 text-sm">Every order, any day — fix ones that got stuck</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-ink-100 rounded-xl p-1 max-w-full">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => withReset(setStatus)(f.key)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${status === f.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="text-xs text-ink-500">From
            <input type="date" value={from} onChange={e => withReset(setFrom)(e.target.value)} className="input w-auto block mt-0.5" />
          </label>
          <label className="text-xs text-ink-500">To
            <input type="date" value={to} onChange={e => withReset(setTo)(e.target.value)} className="input w-auto block mt-0.5" />
          </label>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Order number or customer" className="input w-full pl-8" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader size={24} className="animate-spin text-flame-500" /></div>
        ) : orders.length === 0 ? (
          <div className="card py-20 text-center">
            <p className="text-5xl mb-4">{status === 'open' ? '🎉' : '📋'}</p>
            <p className="font-bold text-ink-400 text-lg">{status === 'open' ? 'No unfinished orders' : 'No orders found'}</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs text-ink-400 uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Placed</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Items</th>
                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    {!isViewer && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b border-ink-50 last:border-0 align-top">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-flame-500">{o.orderNumber}</span>
                        {o.fulfillmentType === 'delivery' && <span className="flex items-center gap-1 text-[11px] text-indigo-600 mt-0.5"><Backpack size={10} />Delivery</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-500 whitespace-nowrap">{format(new Date(o.createdAt), 'd MMM yyyy · HH:mm')}</td>
                      <td className="px-4 py-3 text-ink-700">
                        {o.customer?.name || o.guestName || 'Customer'}
                        {(o.guestPhone || o.customer?.phone) && (
                          <a href={`tel:${o.guestPhone || o.customer.phone}`} className="flex items-center gap-1 text-[11px] text-ink-400 hover:text-flame-500 mt-0.5 whitespace-nowrap"><Phone size={10} />{o.guestPhone || o.customer.phone}</a>
                        )}
                        {o.customer?.email && (
                          <a href={`mailto:${o.customer.email}`} className="flex items-center gap-1 text-[11px] text-ink-400 hover:text-flame-500 mt-0.5 break-all"><Mail size={10} />{o.customer.email}</a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-500 max-w-[240px]">
                        <span className="line-clamp-2">{o.items.map(i => `${i.quantity}× ${i.menuItemName}${i.variantName ? ` (${i.variantName})` : ''}${i.notes ? ` — “${i.notes}”` : ''}`).join(', ')}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink-900 whitespace-nowrap">{o.totalPrice.toLocaleString()} RWF</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${STATUS_COLORS[o.status] || 'bg-ink-100 text-ink-600'}`}>{STATUS_LABELS[o.status] || o.status}</span>
                      </td>
                      {!isViewer && (
                        <td className="px-4 py-3 text-right">
                          {o.status !== 'cancelled' && (
                            <button onClick={() => setEditing(o)} className="btn btn-secondary btn-sm"><Pencil size={12} />Edit</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-ink-500">
            <span>{total.toLocaleString()} orders</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading} className="btn btn-secondary btn-sm"><ChevronLeft size={14} /></button>
              <span>Page {page} of {pages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= pages || loading} className="btn btn-secondary btn-sm"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {editing && <EditOrderModal order={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </AdminLayout>
  )
}
