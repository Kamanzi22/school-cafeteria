import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Store, Users, ShoppingBag, CheckCircle, XCircle, Trash2, Loader, LogIn, Eye, EyeOff, Radio, History, MapPin, RefreshCw, Clock, Globe, RotateCcw, Truck } from 'lucide-react'
import { superAdminAPI, authAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import { useSocket, getSocket } from '../../hooks/useSocket'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const fmtDuration = (sec) => {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60), s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const shortId = (id) => id ? id.slice(-8) : '—'

const VISITOR_LABEL = {
  account: { label: 'Account', cls: 'bg-emerald-100 text-emerald-700' },
  guest: { label: 'Guest', cls: 'bg-amber-100 text-amber-700' },
  anonymous: { label: 'Anonymous', cls: 'bg-ink-100 text-ink-500' },
}

const PAYMENT_LABEL = {
  cash: { label: 'Cash', cls: 'bg-emerald-100 text-emerald-700' },
  momo: { label: 'Momo', cls: 'bg-amber-100 text-amber-700' },
  card: { label: 'Card', cls: 'bg-blue-100 text-blue-700' },
}

function VisitorBadge({ type }) {
  const v = VISITOR_LABEL[type] || VISITOR_LABEL.anonymous
  return <span className={`badge ${v.cls}`}>{v.label}</span>
}

// Live tab — a raw, currently-happening feed. Kept simple (no order correlation / stats,
// which only make sense once a visit is finished and part of a historical dataset).
function LiveVisitRow({ v }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])
  const durationSec = Math.round((now - new Date(v.enteredAt).getTime()) / 1000)

  return (
    <tr className="border-b border-ink-50 hover:bg-ink-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <VisitorBadge type={v.visitorType} />
          <span className="text-ink-700">{v.visitorName || `${v.visitorType} visitor`}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{v.restaurant?.emoji}</span>
          <span className="text-ink-900 font-medium">{v.restaurant?.name || 'Unknown'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-ink-500 text-xs">{format(new Date(v.enteredAt), 'dd/MM/yyyy HH:mm')}</td>
      <td className="px-4 py-3 font-semibold text-ink-900">{fmtDuration(durationSec)}</td>
      <td className="px-4 py-3"><span className="badge bg-emerald-100 text-emerald-700"><Radio size={10} /> Live</span></td>
    </tr>
  )
}

// History tab — each visit is its own row (never merged), enriched with the visitor's login
// credential, the order placed during that specific visit (if any), and their running total
// time across the whole site for this period.
function HistoryVisitRow({ v }) {
  const identity = v.visitorLogin || (v.visitorType === 'anonymous' ? `anon-${shortId(v.visitorId)}` : `${v.visitorType} visitor`)
  return (
    <tr className="border-b border-ink-50 hover:bg-ink-50 align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 mb-0.5"><VisitorBadge type={v.visitorType} /></div>
        <p className="text-ink-700 text-xs">{identity}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{v.restaurant?.emoji}</span>
          <span className="text-ink-900 font-medium">{v.restaurant?.name || 'Unknown'}</span>
        </div>
        <p className="text-ink-400 text-xs mt-0.5">
          {format(new Date(v.enteredAt), 'dd/MM/yyyy HH:mm')} → {v.leftAt ? format(new Date(v.leftAt), 'HH:mm') : 'still active'}
        </p>
      </td>
      <td className="px-4 py-3 text-xs space-y-0.5">
        <p className="flex items-center gap-1 text-ink-500"><Globe size={11} /> Website: <strong className="text-ink-900">{fmtDuration(v.websiteDurationSec)}</strong></p>
        <p className="flex items-center gap-1 text-ink-500"><Store size={11} /> This store: <strong className="text-ink-900">{fmtDuration(v.durationSec)}</strong></p>
      </td>
      <td className="px-4 py-3">
        {v.order ? (
          <div>
            <p className="text-ink-900 font-medium text-xs">{v.order.itemsLabel || '—'}</p>
            <p className="text-xs font-semibold text-emerald-600 mt-0.5">{v.order.amount.toLocaleString()} RWF</p>
          </div>
        ) : <span className="text-ink-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-3">
        {v.order ? (
          v.order.status === 'cancelled' ? (
            <span className="badge bg-red-100 text-red-600">Canceled</span>
          ) : (
            <span className={`badge ${PAYMENT_LABEL[v.order.paymentMethod]?.cls || 'bg-ink-100 text-ink-600'}`}>
              {PAYMENT_LABEL[v.order.paymentMethod]?.label || v.order.paymentMethod}
            </span>
          )
        ) : <span className="text-ink-300 text-xs">—</span>}
      </td>
    </tr>
  )
}

const getStoredSuperAdminToken = () => {
  try { return JSON.parse(localStorage.getItem('cc-superadmin-v1') || '{}')?.state?.token || null } catch { return null }
}

export default function SuperAdminPage() {
  // Restore an existing session on mount — otherwise every navigation back to this page
  // (e.g. exiting a "view store" session) drops back to the login screen even though the
  // token in localStorage is still valid.
  const [authed, setAuthed] = useState(() => !!getStoredSuperAdminToken())
  const [token, setToken] = useState(getStoredSuperAdminToken)
  const [form, setForm] = useState({ username:'', password:'' })
  const [showPw, setShowPw] = useState(false)
  const [restaurants, setRestaurants] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [viewingId, setViewingId] = useState(null)
  const [visitTab, setVisitTab] = useState('live')
  const [liveVisits, setLiveVisits] = useState([])
  const [periodType, setPeriodType] = useState('day') // day | week | month | year
  const [historyDate, setHistoryDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [historyMonth, setHistoryMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [historyYear, setHistoryYear] = useState(() => format(new Date(), 'yyyy'))
  const [historyVisits, setHistoryVisits] = useState([])
  const [historyStats, setHistoryStats] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const navigate = useNavigate()
  const { loginViewer, logout: exitAdminSession } = useAdminStore()

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginLoading(true)
    try {
      const res = await authAPI.superAdminLogin(form)
      localStorage.setItem('cc-superadmin-v1', JSON.stringify({ state:{ token: res.data.data.token } }))
      setAuthed(true)
      setToken(res.data.data.token)
      toast.success('Super admin access granted')
    } catch { toast.error('Invalid credentials') }
    finally { setLoginLoading(false) }
  }

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    Promise.all([superAdminAPI.getRestaurants(), superAdminAPI.getStats()]).then(([r, s]) => {
      setRestaurants(r.data.data); setStats(s.data.data); setLoading(false)
    }).catch((e) => {
      setLoading(false)
      // Stored token is invalid/expired — drop back to the login screen instead of a blank page.
      if (e.response?.status === 401 || e.response?.status === 403) {
        localStorage.removeItem('cc-superadmin-v1')
        setAuthed(false)
      }
    })
  }, [authed])

  // Live visitor feed — seed with a snapshot, then keep it current via socket updates.
  const [trashCount, setTrashCount] = useState(0)

  useEffect(() => {
    if (!authed || !token) return
    getSocket().emit('join:superadmin', { token })
    superAdminAPI.getLiveVisits().then(r => setLiveVisits(r.data.data)).catch(() => {})
    superAdminAPI.getTrashCount().then(r => setTrashCount(r.data.data.count)).catch(() => {})
  }, [authed, token])

  useSocket({
    'visit:update': (visit) => {
      setLiveVisits(prev => {
        const withoutIt = prev.filter(v => v.id !== visit.id)
        return visit.leftAt ? withoutIt : [visit, ...withoutIt]
      })
    }
  })

  // The anchor date sent to the backend depends on which period type is selected — day/week
  // reuse the plain date picker, month/year have their own inputs.
  const periodAnchorDate =
    periodType === 'month' ? `${historyMonth}-01` :
    periodType === 'year' ? `${historyYear}-01-01` :
    historyDate

  const fetchHistory = () => {
    setHistoryLoading(true)
    superAdminAPI.getVisitHistory(periodAnchorDate, periodType).then(r => {
      setHistoryVisits(r.data.data.visits); setHistoryStats(r.data.data.stats); setHistoryLoading(false)
    }).catch(() => setHistoryLoading(false))
  }

  useEffect(() => {
    if (!authed || visitTab !== 'history') return
    fetchHistory()
  }, [authed, visitTab, periodType, historyDate, historyMonth, historyYear])

  const clearVisitData = async () => {
    if (!window.confirm('Move all recorded visits to trash? They stay recoverable with Restore until you explicitly Delete Permanently.')) return
    const res = await superAdminAPI.clearVisits()
    setLiveVisits([])
    setHistoryVisits([])
    setHistoryStats(null)
    setTrashCount(res.data.data.count)
    toast.success('Visit history moved to trash')
  }

  const restoreVisitData = async () => {
    await superAdminAPI.restoreVisits()
    setTrashCount(0)
    toast.success('Visit history restored')
    if (visitTab === 'live') superAdminAPI.getLiveVisits().then(r => setLiveVisits(r.data.data)).catch(() => {})
    else fetchHistory()
  }

  const purgeVisitData = async () => {
    if (!window.confirm(`Permanently delete ${trashCount} trashed visit${trashCount === 1 ? '' : 's'}? This cannot be undone.`)) return
    await superAdminAPI.purgeVisits()
    setTrashCount(0)
    toast.success('Trash permanently deleted')
  }

  const toggleApprove = async (id) => {
    const res = await superAdminAPI.toggleApprove(id)
    setRestaurants(prev => prev.map(r => r.id===id ? { ...r, isApproved: res.data.data.isApproved } : r))
    toast.success('Status updated')
  }

  const deleteRestaurant = async (id, name) => {
    if (!window.confirm(`Delete "${name}" permanently?`)) return
    await superAdminAPI.deleteRestaurant(id)
    setRestaurants(prev => prev.filter(r => r.id!==id))
    toast.success('Restaurant deleted')
  }

  const enableDeliveryForAll = async () => {
    const input = window.prompt('Campus delivery fee for every store (RWF):', '300')
    if (input === null) return
    const fee = Number(input)
    if (!Number.isFinite(fee) || fee < 0) { toast.error('Enter a valid, non-negative number'); return }
    const res = await superAdminAPI.updateCampusDeliveryAll({ enabled: true, fee })
    setRestaurants(prev => prev.map(r => ({ ...r, offersDelivery: true, offersCampusDelivery: true, campusDeliveryFee: fee })))
    toast.success(`Enabled ${fee.toLocaleString()} RWF delivery for ${res.data.data.count} store(s)`)
  }

  const disableDeliveryForAll = async () => {
    if (!window.confirm('Turn OFF campus delivery for every store?')) return
    const res = await superAdminAPI.updateCampusDeliveryAll({ enabled: false })
    setRestaurants(prev => prev.map(r => ({ ...r, offersCampusDelivery: false })))
    toast.success(`Disabled delivery for ${res.data.data.count} store(s)`)
  }

  const viewStore = async (id) => {
    setViewingId(id)
    try {
      // Exit any previous viewer/owner session first — same browser storage, don't mix sessions.
      exitAdminSession()
      const res = await superAdminAPI.getViewToken(id)
      loginViewer(res.data.data.restaurant, res.data.data.token)
      navigate('/admin')
    } catch (e) { toast.error(e.response?.data?.error || 'Could not open store') }
    finally { setViewingId(null) }
  }

  if (!authed) return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Shield size={40} className="text-brand-500 mx-auto mb-3" />
          <h1 className="text-2xl font-black text-white">Super Admin</h1>
          <p className="text-ink-500 text-sm mt-1">Platform administration</p>
        </div>
        <div className="bg-ink-900 rounded-2xl p-6 border border-ink-800">
          <form onSubmit={handleLogin} className="space-y-4">
            {[['Username','username'],['Password','password']].map(([l,k]) => (
              <div key={k}>
                <label className="label text-ink-500">{l}</label>
                <div className="relative">
                  <input
                    type={k==='password' && !showPw ? 'password' : 'text'}
                    value={form[k]}
                    onChange={e => setForm(p => ({ ...p, [k]:e.target.value }))}
                    className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 pr-10"
                    required
                  />
                  {k==='password' && (
                    <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300">
                      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="submit" disabled={loginLoading} className="btn btn-primary w-full btn-lg">
              {loginLoading ? <Loader size={16} className="animate-spin"/> : <LogIn size={16}/>}
              {loginLoading ? 'Signing in…' : 'Access Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="gradient-dark text-white px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-brand-400" />
            <div><p className="font-black text-lg">Super Admin Panel</p><p className="text-ink-400 text-xs">CaféCampus Platform</p></div>
          </div>
          <a href="/" className="btn btn-ghost text-ink-400 text-sm">← Student App</a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['Total Stores', stats.totalRestaurants, Store],['Open Now', stats.activeRestaurants, CheckCircle],['Total Orders', stats.totalOrders, ShoppingBag],['Customers', stats.totalCustomers, Users]].map(([l,v,Icon]) => (
              <div key={l} className="bg-white rounded-2xl border border-ink-100 p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-ink-400">{l}</p>
                  <Icon size={14} className="text-brand-400" />
                </div>
                <p className="font-black text-2xl text-ink-900">{v}</p>
              </div>
            ))}
          </div>
        )}

        {/* Restaurants table */}
        <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-ink-900">All Restaurants</h2>
            <div className="flex items-center gap-2">
              <button onClick={enableDeliveryForAll} title="Turn on campus delivery for every store, with a fee you set"
                className="btn btn-sm bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                <Truck size={13}/> Enable Delivery for All
              </button>
              <button onClick={disableDeliveryForAll} title="Turn off campus delivery for every store"
                className="btn btn-sm bg-white border border-ink-200 text-ink-500 hover:bg-ink-50">
                Disable All
              </button>
            </div>
          </div>
          {loading ? <div className="p-8 text-center"><Loader className="animate-spin text-brand-500 mx-auto" /></div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wider">
                  {['Restaurant','Owner','Status','Approved','Orders','Joined','Actions'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {restaurants.map(r => (
                    <tr key={r.id} className={`border-b border-ink-50 hover:bg-ink-50 ${r.isDeleted ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{r.emoji}</span>
                          <div><p className="font-semibold text-ink-900">{r.name}</p><p className="text-xs text-ink-400">{r.category}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><p className="text-ink-700">{r.ownerName}</p><p className="text-xs text-ink-400">{r.ownerEmail}</p></td>
                      <td className="px-4 py-3">
                        {r.isDeleted ? <span className="badge bg-red-100 text-red-600">Deleted</span>
                        : r.isOpen ? <span className="badge-open">Open</span>
                        : <span className="badge-closed">Closed</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleApprove(r.id)} disabled={r.isDeleted}
                          className={`badge cursor-pointer ${r.isApproved ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                          {r.isApproved ? <CheckCircle size={11}/> : <XCircle size={11}/>}
                          {r.isApproved ? 'Approved' : 'Suspended'}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold">{r._count?.orders || 0}</td>
                      <td className="px-4 py-3 text-ink-400 text-xs">{format(new Date(r.createdAt), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-3">
                        {!r.isDeleted && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => viewStore(r.id)} disabled={viewingId === r.id}
                              title="View store's admin portal (read-only)"
                              className="btn btn-icon text-ink-400 hover:text-brand-600 hover:bg-ink-100">
                              {viewingId === r.id ? <Loader size={15} className="animate-spin"/> : <Eye size={15}/>}
                            </button>
                            <button onClick={() => deleteRestaurant(r.id, r.name)} title="Delete permanently"
                              className="btn btn-icon text-red-400 hover:text-red-600 hover:bg-ink-100">
                              <Trash2 size={15}/>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Visitor tracking */}
        <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-ink-900 flex items-center gap-2"><MapPin size={16} className="text-brand-400" /> Visitors</h2>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <div className="flex bg-ink-100 rounded-xl p-1">
                  {[['live','Live'],['history','History']].map(([v,label]) => (
                    <button key={v} onClick={() => setVisitTab(v)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${visitTab===v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={clearVisitData} title="Move all recorded visit data to trash"
                  className="btn btn-sm bg-white border border-red-200 text-red-500 hover:bg-red-50">
                  <Trash2 size={13} /> Clear Data
                </button>
              </div>
              {trashCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-400">{trashCount} in trash</span>
                  <button onClick={purgeVisitData} title="Permanently delete everything in trash"
                    className="btn btn-sm bg-white border border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 size={13} /> Delete Permanently
                  </button>
                  <button onClick={restoreVisitData} title="Undo the last Clear Data click"
                    className="btn btn-sm bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                    <RotateCcw size={13} /> Restore
                  </button>
                </div>
              )}
            </div>
          </div>

          {visitTab === 'history' && (
            <>
              <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center gap-3 flex-wrap">
                <div className="flex bg-white border border-ink-200 rounded-lg p-0.5">
                  {[['day','Day'],['week','Week'],['month','Month'],['year','Year']].map(([v,label]) => (
                    <button key={v} onClick={() => setPeriodType(v)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${periodType===v ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {(periodType === 'day' || periodType === 'week') && (
                  <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                    className="input py-1.5 text-sm w-auto" max={format(new Date(), 'yyyy-MM-dd')} />
                )}
                {periodType === 'month' && (
                  <input type="month" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)}
                    className="input py-1.5 text-sm w-auto" max={format(new Date(), 'yyyy-MM')} />
                )}
                {periodType === 'year' && (
                  <input type="number" value={historyYear} onChange={e => setHistoryYear(e.target.value)}
                    className="input py-1.5 text-sm w-24" min="2020" max={format(new Date(), 'yyyy')} />
                )}
                <button onClick={fetchHistory} disabled={historyLoading} className="btn btn-sm ml-auto bg-white border border-ink-200 text-ink-700 hover:bg-ink-50">
                  <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {historyStats && (
                <div className="px-5 py-4 border-b border-ink-100 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-[11px] text-ink-400 uppercase tracking-wider mb-1">Total Visitors</p>
                      <p className="font-black text-xl text-ink-900">{historyStats.totalVisitors}</p>
                    </div>
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-[11px] text-ink-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Globe size={11}/> Time on Website</p>
                      <p className="font-black text-xl text-ink-900">{fmtDuration(historyStats.totalWebsiteTimeSec)}</p>
                    </div>
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-[11px] text-ink-400 uppercase tracking-wider mb-1">Most Visited</p>
                      <p className="font-bold text-sm text-ink-900 truncate">{historyStats.topByVisitors ? `${historyStats.topByVisitors.name} (${historyStats.topByVisitors.count})` : '—'}</p>
                    </div>
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-[11px] text-ink-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={11}/> Most Time Spent</p>
                      <p className="font-bold text-sm text-ink-900 truncate">{historyStats.topByTime ? `${historyStats.topByTime.name} (${fmtDuration(historyStats.topByTime.totalTimeSec)})` : '—'}</p>
                    </div>
                  </div>

                  {historyStats.perRestaurant.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-ink-400 uppercase tracking-wider">
                          <th className="px-2 py-1.5 text-left font-semibold">Store</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Visitors</th>
                          <th className="px-2 py-1.5 text-left font-semibold">Total Time</th>
                        </tr></thead>
                        <tbody>
                          {historyStats.perRestaurant.map(r => (
                            <tr key={r.restaurantId} className="border-t border-ink-100">
                              <td className="px-2 py-1.5 text-ink-700">{r.emoji} {r.name}</td>
                              <td className="px-2 py-1.5 text-ink-900 font-semibold">{r.visitorCount}</td>
                              <td className="px-2 py-1.5 text-ink-900 font-semibold">{fmtDuration(r.totalTimeSec)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wider">
                {(visitTab === 'live' ? ['Visitor','Restaurant','Entered','Time Spent','Status'] : ['Visitor','Store','Time Spent','Ordered','Paid']).map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {visitTab === 'live' ? (
                  liveVisits.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400">No one is browsing right now</td></tr>
                  ) : liveVisits.map(v => <LiveVisitRow key={v.id} v={v} />)
                ) : historyLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader className="animate-spin text-brand-500 mx-auto" /></td></tr>
                ) : historyVisits.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400">No visits in this period</td></tr>
                ) : historyVisits.map(v => <HistoryVisitRow key={v.id} v={v} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
