import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Backpack, ArrowLeft, Loader, MapPin, RefreshCw, CheckCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { superAdminAPI } from '../../services/api'
import { useSocket, getSocket } from '../../hooks/useSocket'
import { format, addDays, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-ink-100 text-ink-500' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-100 text-blue-600' },
  preparing: { label: 'Preparing', cls: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Ready for Pickup', cls: 'bg-emerald-100 text-emerald-700' },
}

const shortId = (id) => id ? id.slice(-8) : '—'

const getStoredSuperAdminToken = () => {
  try { return JSON.parse(localStorage.getItem('cc-superadmin-v1') || '{}')?.state?.token || null } catch { return null }
}

// Custom picker (native <input type="date"> can't highlight a range) — picking a day selects
// it plus the next 6 days as the week, with the whole 7-day span shown highlighted.
function WeekRangePicker({ startDate, onSelect }) {
  const rangeStart = new Date(`${startDate}T00:00:00`)
  const rangeEnd = addDays(rangeStart, 6)
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(startOfMonth(rangeStart))
  const [coords, setCoords] = useState(null)
  const boxRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const CALENDAR_HEIGHT = 300 // roughly a 6-row month grid + header, used to decide which way it opens

  const toggle = () => {
    if (!open) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < CALENDAR_HEIGHT && rect.top > spaceBelow
      setCoords(openUpward
        ? { bottom: window.innerHeight - rect.top + 8, left: rect.left }
        : { top: rect.bottom + 8, left: rect.left })
    }
    setViewMonth(startOfMonth(rangeStart))
    setOpen(o => !o)
  }

  const gridStart = startOfWeek(startOfMonth(viewMonth))
  const gridEnd = endOfWeek(endOfMonth(viewMonth))
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div ref={boxRef}>
      <button ref={btnRef} type="button" onClick={toggle}
        className="btn btn-sm bg-white border border-ink-200 text-ink-900 hover:bg-ink-50">
        <Calendar size={14} className="text-ink-400" /> {format(rangeStart, 'dd MMM yyyy')}
      </button>
      {open && coords && (
        <div className="fixed z-50 bg-white border border-ink-100 rounded-xl shadow-lg p-3 w-72 overflow-y-auto" style={{ ...coords, maxHeight: '80vh' }}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewMonth(m => subMonths(m, 1))} className="btn btn-icon text-ink-400 hover:text-ink-700"><ChevronLeft size={16} /></button>
            <p className="font-semibold text-sm text-ink-900">{format(viewMonth, 'MMMM yyyy')}</p>
            <button type="button" onClick={() => setViewMonth(m => addMonths(m, 1))} className="btn btn-icon text-ink-400 hover:text-ink-700"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-400 mb-1">
            {['S','M','T','W','T','F','S'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map(d => {
              const inRange = d >= rangeStart && d <= rangeEnd
              const isStart = isSameDay(d, rangeStart)
              const outsideMonth = !isSameMonth(d, viewMonth)
              return (
                <button key={d.toISOString()} type="button"
                  onClick={() => { onSelect(format(d, 'yyyy-MM-dd')); setOpen(false) }}
                  className={`text-xs py-1.5 rounded-lg transition-colors ${
                    isStart ? 'bg-brand-600 text-white font-bold' :
                    inRange ? 'bg-brand-100 text-brand-700 font-semibold' :
                    outsideMonth ? 'text-ink-300 hover:bg-ink-50' : 'text-ink-700 hover:bg-ink-100'
                  }`}>
                  {format(d, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function LocationCell({ o, dateField }) {
  return (
    <>
      <p className="flex items-center gap-1 text-ink-700 text-xs">
        <MapPin size={11} className="shrink-0 text-ink-400" />
        {o.deliveryScope === 'off_campus' ? 'Off campus: ' : 'On campus: '}{o.deliveryLocation}
      </p>
      <p className="text-ink-300 text-xs mt-0.5">{format(new Date(o[dateField]), 'dd MMM HH:mm')}</p>
    </>
  )
}

export default function DeliveryPage() {
  const navigate = useNavigate()
  const [token] = useState(getStoredSuperAdminToken)
  const [tab, setTab] = useState('live') // live | history
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [delivering, setDelivering] = useState(null) // id currently being marked delivered

  const [periodType, setPeriodType] = useState('day') // day | week | month | year
  const [historyDate, setHistoryDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [historyMonth, setHistoryMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [historyYear, setHistoryYear] = useState(() => format(new Date(), 'yyyy'))
  const [historyOrders, setHistoryOrders] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

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

  const periodAnchorDate =
    periodType === 'month' ? `${historyMonth}-01` :
    periodType === 'year' ? `${historyYear}-01-01` :
    historyDate

  const fetchHistory = () => {
    setHistoryLoading(true)
    superAdminAPI.getDeliveryHistory(periodAnchorDate, periodType)
      .then(r => setHistoryOrders(r.data.data))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => {
    if (tab !== 'history') return
    fetchHistory()
  }, [tab, periodType, historyDate, historyMonth, historyYear])

  // Live updates — a delivery order was placed, changed status, or got cancelled/delivered.
  useSocket({
    'delivery:order': (order) => {
      setOrders(prev => {
        if (order.status === 'cancelled' || order.status === 'picked_up') return prev.filter(o => o.id !== order.id)
        const exists = prev.some(o => o.id === order.id)
        return exists ? prev.map(o => o.id === order.id ? order : o) : [order, ...prev]
      })
      if (order.status === 'picked_up' && tab === 'history') fetchHistory()
    }
  })

  const markDelivered = async (id) => {
    setDelivering(id)
    try {
      await superAdminAPI.markDelivered(id)
      setOrders(prev => prev.filter(o => o.id !== id))
      toast.success('Marked delivered')
    } catch (e) { toast.error(e.response?.data?.error || 'Could not mark delivered') }
    finally { setDelivering(null) }
  }

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
          <div className="flex bg-white/10 rounded-xl p-1">
            {[['live','Live'],['history','History']].map(([v,label]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab===v ? 'bg-white text-ink-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
          {tab === 'live' ? (
            <>
              <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-ink-900">Delivery Orders</h2>
                  <p className="text-ink-400 text-xs mt-0.5">Everyone who chose delivery, newest first. Updates live as orders come in and change status.</p>
                </div>
                <button onClick={load} className="btn btn-sm bg-white border border-ink-200 text-ink-700 hover:bg-ink-50">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wider">
                    {['Customer','Restaurant','Meal','Location','Ready for Pickup',''].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader className="animate-spin text-brand-500 mx-auto" /></td></tr>
                    ) : orders.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">No delivery orders in progress</td></tr>
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
                          <td className="px-4 py-3"><LocationCell o={o} dateField="createdAt" /></td>
                          <td className="px-4 py-3">
                            <span className={`badge ${meta.cls} ${isReady ? 'animate-pulse' : ''}`}>{meta.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => markDelivered(o.id)} disabled={delivering === o.id}
                              title="Mark this order delivered — moves it to History"
                              className="btn btn-sm bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 whitespace-nowrap">
                              {delivering === o.id ? <Loader size={13} className="animate-spin" /> : <CheckCircle size={13} />} Delivered
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-ink-100">
                <h2 className="font-bold text-ink-900">Delivery History</h2>
                <p className="text-ink-400 text-xs mt-0.5">Orders marked delivered, by period.</p>
              </div>
              <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center gap-3 flex-wrap">
                <div className="flex bg-white border border-ink-200 rounded-lg p-0.5">
                  {[['day','Day'],['week','Week'],['month','Month'],['year','Year']].map(([v,label]) => (
                    <button key={v} onClick={() => setPeriodType(v)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${periodType===v ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {periodType === 'day' && (
                  <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                    className="bg-white border border-ink-200 rounded-xl px-3.5 py-2 text-sm text-ink-900 w-auto focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    max={format(new Date(), 'yyyy-MM-dd')} />
                )}
                {periodType === 'week' && (
                  <>
                    <WeekRangePicker startDate={historyDate} onSelect={setHistoryDate} />
                    <span className="text-xs text-ink-500 font-medium">
                      → {format(addDays(new Date(`${historyDate}T00:00:00`), 6), 'dd MMM yyyy')} (7 days)
                    </span>
                  </>
                )}
                {periodType === 'month' && (
                  <input type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)}
                    className="bg-white border border-ink-200 rounded-xl px-3.5 py-2 text-sm text-ink-900 w-auto focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    max={format(new Date(), 'yyyy-MM')} />
                )}
                {periodType === 'year' && (
                  <select value={historyYear} onChange={e => setHistoryYear(e.target.value)}
                    className="bg-white border border-ink-200 rounded-xl px-3.5 py-2 text-sm text-ink-900 w-28 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500">
                    {['2026','2027','2028','2029','2030'].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
                <button onClick={fetchHistory} disabled={historyLoading} className="btn btn-sm ml-auto bg-white border border-ink-200 text-ink-700 hover:bg-ink-50">
                  <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wider">
                    {['Customer','Restaurant','Meal','Location','Delivered'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {historyLoading ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader className="animate-spin text-brand-500 mx-auto" /></td></tr>
                    ) : historyOrders.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400">No deliveries in this period</td></tr>
                    ) : historyOrders.map(o => (
                      <tr key={o.id} className="border-b border-ink-50 hover:bg-ink-50">
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
                        <td className="px-4 py-3"><LocationCell o={o} dateField="pickedUpAt" /></td>
                        <td className="px-4 py-3"><span className="badge bg-emerald-100 text-emerald-700"><CheckCircle size={11} /> Delivered</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
