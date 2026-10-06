import { useState, useEffect, useMemo } from 'react'
import { Loader, ChevronLeft, ChevronRight, ShoppingBag, Banknote, Timer, XCircle, Backpack } from 'lucide-react'
import {
  format, addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfDay, endOfDay, isSameDay, isSameMonth, isAfter, differenceInMinutes,
} from 'date-fns'
import { orderAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import AdminLayout from '../../components/restaurant/AdminLayout'
import { sidesLabel } from '../../lib/sides'

// Order History = a calendar. Tap a day to see how that day's orders board looked at closing:
// every order with when it came in, when it was accepted, when it was ready, how long that took,
// and how it ended — plus the day's totals.

const FINAL_LABELS = { picked_up: 'Picked up', cancelled: 'Cancelled', pending: 'Never accepted', confirmed: 'Not finished', preparing: 'Not finished', ready: 'Ready, not collected', on_the_way: 'Out for delivery' }
const FINAL_COLORS = { picked_up: 'bg-sky-100 text-sky-700', cancelled: 'bg-red-100 text-red-600' }

// Every order placed between from and to (any status). The history endpoint pages at most 100.
async function loadOrders(restaurantId, from, to) {
  const params = { status: 'all', from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd'), pageSize: 100 }
  const out = []
  for (let page = 1; ; page++) {
    const res = await orderAPI.restaurantHistory(restaurantId, { ...params, page })
    out.push(...res.data.data)
    if (out.length >= res.data.total || res.data.data.length === 0) return out
  }
}

const orderName = (o) => o.items.map(i => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.menuItemName}${i.variantName ? ` (${i.variantName})` : ''}${i.sides ? ` + ${sidesLabel(i.sides)}` : ''}`).join(', ')
const hhmm = (iso) => (iso ? format(new Date(iso), 'HH:mm') : '—')
const minutesToReady = (o) => (o.readyAt ? differenceInMinutes(new Date(o.readyAt), new Date(o.createdAt)) : null)
const revenueOf = (orders) => orders.filter(o => o.status === 'picked_up').reduce((s, o) => s + o.totalPrice, 0)

function dayTotals(orders) {
  return {
    received: orders.length,
    pickedUp: orders.filter(o => o.status === 'picked_up').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    revenue: revenueOf(orders),
  }
}

function StatCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="card p-4 min-w-0">
      <p className={`text-xs font-semibold flex items-center gap-1.5 ${tone}`}><Icon size={13} />{label}</p>
      <p className="text-lg sm:text-xl font-black text-ink-900 mt-1 truncate">{value}</p>
      {sub && <p className="text-xs text-ink-400 truncate">{sub}</p>}
    </div>
  )
}

// ── The month calendar: each day shows how many orders came in ──────────────
function MonthCalendar({ month, setMonth, orders, selected, onSelect }) {
  const today = new Date()
  const days = []
  for (let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }); d <= endOfWeek(endOfMonth(month), { weekStartsOn: 1 }); d = addDays(d, 1)) days.push(d)
  const countOn = (d) => orders.filter(o => isSameDay(new Date(o.createdAt), d)).length

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonth(m => addMonths(m, -1))} className="btn btn-ghost btn-icon" aria-label="Previous month"><ChevronLeft size={16} /></button>
        <p className="font-bold text-ink-900">{format(month, 'MMMM yyyy')}</p>
        <button onClick={() => setMonth(m => addMonths(m, 1))} disabled={isSameMonth(month, today)} className="btn btn-ghost btn-icon disabled:opacity-30" aria-label="Next month"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-400 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const inMonth = isSameMonth(d, month)
          const future = isAfter(startOfDay(d), today)
          const count = inMonth && !future ? countOn(d) : 0
          const isSel = selected && isSameDay(d, selected)
          return (
            <button key={d.toISOString()} disabled={!inMonth || future} onClick={() => onSelect(d)}
              className={`rounded-lg py-1.5 flex flex-col items-center transition ${!inMonth ? 'invisible' : future ? 'opacity-30' : isSel ? 'bg-flame-500 text-white' : 'hover:bg-ink-100'} ${isSameDay(d, today) && !isSel ? 'ring-1 ring-flame-400' : ''}`}>
              <span className={`text-sm font-semibold ${isSel ? 'text-white' : 'text-ink-900'}`}>{format(d, 'd')}</span>
              <span className={`text-[10px] leading-tight ${isSel ? 'text-white/90' : count ? 'text-flame-500 font-semibold' : 'text-ink-300'}`}>{future ? '' : count || '·'}</span>
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-ink-400 mt-2 text-center">Number under each date = orders received that day</p>
    </div>
  )
}

// ── One day, as the board looked at closing ─────────────────────────────────
function DaySnapshot({ day, orders }) {
  const t = dayTotals(orders)
  // Oldest first, the way the day actually unfolded
  const list = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  return (
    <div className="space-y-3">
      <h2 className="font-black text-lg text-ink-900">{format(day, 'EEEE d MMMM yyyy')}</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="col-span-2 lg:col-span-1"><StatCard icon={Banknote} tone="text-emerald-600" label="Revenue" value={`${t.revenue.toLocaleString()} RWF`} sub="from picked-up orders" /></div>
        <StatCard icon={ShoppingBag} tone="text-flame-500" label="Total orders" value={t.received} sub={`${t.pickedUp} picked up${t.cancelled ? ` · ${t.cancelled} cancelled` : ''}`} />
        <StatCard icon={XCircle} tone="text-red-500" label="Cancelled" value={t.cancelled} sub={t.cancelled ? `${(orders.filter(o => o.status === 'cancelled').reduce((s, o) => s + o.totalPrice, 0)).toLocaleString()} RWF not earned` : 'none'} />
      </div>

      {list.length === 0 ? (
        <div className="card py-14 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-bold text-ink-400">No orders this day</p>
        </div>
      ) : (
        <>
          {/* Phones: one card per order with its timeline */}
          <div className="md:hidden space-y-2">
            {list.map(o => {
              const m = minutesToReady(o)
              return (
                <div key={o.id} className="card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ink-900 min-w-0">{orderName(o)}</p>
                    <span className="font-bold text-sm text-ink-900 whitespace-nowrap">{o.totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                    {[['Received', o.createdAt], ['Accepted', o.confirmedAt], ['Ready', o.readyAt]].map(([label, at]) => (
                      <div key={label} className="bg-ink-50 rounded-lg py-1.5">
                        <p className="text-[10px] text-ink-400 uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-semibold text-ink-800">{hhmm(at)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2.5 text-xs">
                    <span className="text-ink-500 flex items-center gap-1">
                      <Timer size={12} />{m !== null ? `${m} min to ready` : 'never got ready'}
                      {o.fulfillmentType === 'delivery' && <span className="flex items-center gap-1 text-indigo-600 ml-2"><Backpack size={11} />Delivery</span>}
                    </span>
                    <span className={`badge ${FINAL_COLORS[o.status] || 'bg-amber-100 text-amber-700'}`}>{FINAL_LABELS[o.status] || o.status}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tablets and computers: one row per order */}
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-400 uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">Received</th>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Accepted</th>
                  <th className="px-4 py-3 font-semibold">Ready</th>
                  <th className="px-4 py-3 font-semibold">Received → Ready</th>
                  <th className="px-4 py-3 font-semibold text-right">Price</th>
                  <th className="px-4 py-3 font-semibold">Ended as</th>
                </tr>
              </thead>
              <tbody>
                {list.map(o => {
                  const m = minutesToReady(o)
                  return (
                    <tr key={o.id} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink-900">{hhmm(o.createdAt)}</td>
                      <td className="px-4 py-3 text-ink-700">
                        {orderName(o)}
                        {o.fulfillmentType === 'delivery' && <span className="flex items-center gap-1 text-[11px] text-indigo-600 mt-0.5"><Backpack size={10} />Delivery</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-600">{hhmm(o.confirmedAt)}</td>
                      <td className="px-4 py-3 text-ink-600">{hhmm(o.readyAt)}</td>
                      <td className="px-4 py-3 text-ink-600">{m !== null ? `${m} min` : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-ink-900 whitespace-nowrap">{o.totalPrice.toLocaleString()} RWF</td>
                      <td className="px-4 py-3"><span className={`badge whitespace-nowrap ${FINAL_COLORS[o.status] || 'bg-amber-100 text-amber-700'}`}>{FINAL_LABELS[o.status] || o.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default function OrderHistoryPage() {
  const { restaurant } = useAdminStore()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  // Until someone taps a day, open on the latest day that has orders (early in the morning today is still empty)
  const [picked, setPicked] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // One fetch per month feeds both the calendar counts and the chosen day
  useEffect(() => {
    let stale = false
    setLoading(true); setError(false)
    loadOrders(restaurant.id, startOfMonth(month), endOfDay(endOfMonth(month)))
      .then(list => {
        if (stale) return
        setOrders(list)
        if (!picked && list.length) setSelected(startOfDay(new Date(list[0].createdAt))) // newest first
      })
      .catch(() => { if (!stale) setError(true) })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [restaurant.id, month.getTime()])

  const dayOrders = useMemo(() => selected ? orders.filter(o => isSameDay(new Date(o.createdAt), selected)) : [], [orders, selected])
  const monthRevenue = revenueOf(orders)

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-black text-ink-900">Order History</h1>
          <p className="text-ink-400 text-sm">Tap a day to see how its orders ended</p>
        </div>

        <div className="grid lg:grid-cols-[22rem_1fr] gap-4 items-start">
          <div className="space-y-2">
            <MonthCalendar month={month} setMonth={setMonth} orders={orders} selected={selected} onSelect={d => { setPicked(true); setSelected(d) }} />
            {!loading && !error && (
              <p className="text-xs text-ink-400 text-center">
                {format(month, 'MMMM')}: {orders.length} orders · {monthRevenue.toLocaleString()} RWF
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader size={24} className="animate-spin text-flame-500" /></div>
          ) : error ? (
            <div className="card py-16 text-center text-ink-400 text-sm">Couldn't load orders — check your connection and try again</div>
          ) : selected && isSameMonth(selected, month) ? (
            <DaySnapshot day={selected} orders={dayOrders} />
          ) : (
            <div className="card py-16 text-center text-ink-400 text-sm">Tap a day in the calendar</div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
