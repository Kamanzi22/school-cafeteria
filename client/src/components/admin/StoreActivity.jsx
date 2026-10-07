import { useState, useEffect } from 'react'
import { Store, Loader } from 'lucide-react'
import { format } from 'date-fns'
import { superAdminAPI } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'

const fmtDuration = (sec) => {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const ROLE_STYLE = {
  owner: 'bg-brand-50 text-brand-600',
  manager: 'bg-indigo-50 text-indigo-600',
  staff: 'bg-ink-100 text-ink-600',
}
const RoleBadge = ({ role }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${ROLE_STYLE[role] || ROLE_STYLE.staff}`}>{role}</span>
)

const StoreCell = ({ s }) => (
  <div className="flex items-center gap-2">
    <span className="text-lg">{s.restaurant?.emoji}</span>
    <span className="text-ink-900 font-medium">{s.restaurant?.name || 'Unknown'}</span>
  </div>
)

// When the store's owner and staff are in the restaurant app, and for how long — the store-side
// counterpart of the Visitors section above it. Time counts only while the app is open on screen.
export default function StoreActivity() {
  const [tab, setTab] = useState('live')
  const [live, setLive] = useState([])
  const [periodType, setPeriodType] = useState('day')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [year, setYear] = useState(() => format(new Date(), 'yyyy'))
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { superAdminAPI.getLiveStoreSessions().then(r => setLive(r.data.data)).catch(() => {}) }, [])

  useSocket({
    'store-session:update': (s) => setLive(prev => {
      const others = prev.filter(x => x.id !== s.id)
      return s.leftAt ? others : [s, ...others]
    }),
  })

  const anchor = periodType === 'month' ? `${month}-01` : periodType === 'year' ? `${year}-01-01` : date
  useEffect(() => {
    if (tab !== 'history') return
    setLoading(true)
    superAdminAPI.getStoreSessionHistory(anchor, periodType)
      .then(r => setHistory(r.data.data)).catch(() => setHistory({ sessions: [], perStore: [] }))
      .finally(() => setLoading(false))
  }, [tab, periodType, anchor])

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="bg-white rounded-2xl border border-ink-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-ink-900 flex items-center gap-2"><Store size={16} className="text-brand-400" /> Store activity</h2>
          <p className="text-xs text-ink-400 mt-0.5">When store owners and staff are in the restaurant app</p>
        </div>
        <div className="flex bg-ink-100 rounded-xl p-1">
          {[['live', `Live${live.length ? ` (${live.length})` : ''}`], ['history', 'History']].map(([v, label]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'history' && (
        <>
          <div className="px-5 py-3 border-b border-ink-100 bg-ink-50/50 flex items-center gap-3 flex-wrap">
            <div className="flex bg-white border border-ink-200 rounded-lg p-0.5">
              {[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([v, label]) => (
                <button key={v} onClick={() => setPeriodType(v)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${periodType === v ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            {(periodType === 'day' || periodType === 'week') && (
              <input type="date" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)} className="input py-1.5 text-sm w-auto" />
            )}
            {periodType === 'month' && (
              <input type="month" value={month} max={today.slice(0, 7)} onChange={e => e.target.value && setMonth(e.target.value)} className="input py-1.5 text-sm w-auto" />
            )}
            {periodType === 'year' && (
              <input type="number" value={year} min="2020" max={today.slice(0, 4)} onChange={e => e.target.value && setYear(e.target.value)} className="input py-1.5 text-sm w-24" />
            )}
          </div>
          {history?.perStore?.length > 0 && (
            <div className="px-5 py-3 border-b border-ink-100 flex flex-wrap gap-2">
              {history.perStore.map(p => (
                <span key={p.restaurantId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-50 text-xs text-ink-600">
                  <span>{p.emoji}</span><strong className="text-ink-900">{p.name}</strong>
                  {fmtDuration(p.totalSec)} in the app · {p.sessions} {p.sessions === 1 ? 'session' : 'sessions'}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wider">
            {['Store', 'Who', 'Entered', 'Left', 'Time spent'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {tab === 'live' ? (
              live.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400">No store owner or staff is in the app right now</td></tr>
              ) : live.map(s => (
                <tr key={s.id} className="border-b border-ink-50 hover:bg-ink-50">
                  <td className="px-4 py-3"><StoreCell s={s} /></td>
                  <td className="px-4 py-3"><p className="text-ink-900 font-medium">{s.userName}</p><RoleBadge role={s.role} /></td>
                  <td className="px-4 py-3 text-ink-600">{format(new Date(s.enteredAt), 'HH:mm')}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-semibold"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />In the app now</span></td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{fmtDuration(s.durationSec)}</td>
                </tr>
              ))
            ) : loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader className="animate-spin text-brand-500 mx-auto" /></td></tr>
            ) : !history?.sessions?.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-400">No store activity in this period</td></tr>
            ) : history.sessions.map(s => (
              <tr key={s.id} className="border-b border-ink-50 hover:bg-ink-50">
                <td className="px-4 py-3"><StoreCell s={s} /></td>
                <td className="px-4 py-3"><p className="text-ink-900 font-medium">{s.userName}</p><RoleBadge role={s.role} /></td>
                <td className="px-4 py-3 text-ink-600">{format(new Date(s.enteredAt), 'dd/MM/yyyy HH:mm')}</td>
                <td className="px-4 py-3 text-ink-600">
                  {s.leftAt ? format(new Date(s.leftAt), 'HH:mm')
                    // Closed without saying goodbye (e.g. the phone was switched off): when last seen
                    : Date.now() - new Date(s.lastSeenAt).getTime() > 90 * 1000 ? <span>{format(new Date(s.lastSeenAt), 'HH:mm')} <span className="text-ink-400 text-xs">(last seen)</span></span>
                    : <span className="text-emerald-600 text-xs font-semibold">Still in the app</span>}
                </td>
                <td className="px-4 py-3 font-semibold text-ink-900">{fmtDuration(s.durationSec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
