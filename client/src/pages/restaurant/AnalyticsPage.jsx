import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Star, Loader } from 'lucide-react'
import { analyticsAPI } from '../../services/api'
import AdminLayout from '../../components/restaurant/AdminLayout'

const COLORS = ['#ff5c1a', '#f04010', '#c72e0e', '#7c3aed', '#0891b2', '#16a34a', '#d97706']

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsAPI.get().then(r => { setData(r.data.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <AdminLayout><div className="p-6 flex items-center justify-center h-64"><Loader size={24} className="animate-spin text-flame-500" /></div></AdminLayout>

  const statusData = data?.statusBreakdown ? Object.entries(data.statusBreakdown).map(([status, count]) => ({ name: status, value: count })) : []

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-ink-900">Analytics</h1>
          <p className="text-ink-400 text-sm">Performance overview for your restaurant</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Today's Orders", val: data?.today.orders, sub: 'orders placed', icon: ShoppingBag, trend: null },
            { label: "Today's Revenue", val: `${(data?.today.revenue || 0).toLocaleString()} RWF`, sub: 'earned today', icon: DollarSign },
            { label: 'This Week', val: `${(data?.week.revenue || 0).toLocaleString()} RWF`, sub: `${data?.week.orders} orders`, icon: TrendingUp },
            { label: 'Avg Rating', val: data?.avgRating ? `${data.avgRating.toFixed(1)} ★` : 'No reviews', sub: 'customer satisfaction', icon: Star },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">{s.label}</p>
                <s.icon size={16} className="text-flame-400" />
              </div>
              <p className="font-black text-2xl text-ink-900 leading-tight">{s.val ?? '—'}</p>
              <p className="text-xs text-ink-400 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Revenue 7 days */}
          <div className="card p-5">
            <h2 className="font-bold text-ink-900 mb-4">Revenue — Last 7 Days</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.dailyStats || []} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#90909c' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#90909c' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={v => [`${v.toLocaleString()} RWF`, 'Revenue']} contentStyle={{ borderRadius: 12, border: '1px solid #eeeef0', fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#ff5c1a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly orders */}
          <div className="card p-5">
            <h2 className="font-bold text-ink-900 mb-4">Orders by Hour — Today</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.byHour?.filter(h => h.hour >= 6 && h.hour <= 20) || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#90909c' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#90909c' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [v, 'Orders']} contentStyle={{ borderRadius: 12, border: '1px solid #eeeef0', fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#ff5c1a" strokeWidth={2.5} dot={{ fill: '#ff5c1a', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top items + status breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Top items */}
          <div className="card p-5 lg:col-span-2">
            <h2 className="font-bold text-ink-900 mb-4">Top Selling Items</h2>
            {!data?.topItems?.length ? (
              <p className="text-ink-300 text-sm text-center py-8">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {data.topItems.map((item, i) => {
                  const pct = Math.max(4, Math.round((item.totalOrdered / (data.topItems[0]?.totalOrdered || 1)) * 100))
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <span className="font-black text-ink-300 text-sm w-4 text-center">#{i + 1}</span>
                      <span className="text-xl w-7">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-ink-900 truncate">{item.name}</span>
                          <span className="text-xs text-ink-400 ml-2 shrink-0">{item.totalOrdered} sold</span>
                        </div>
                        <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                          <div className="h-full bg-flame-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-ink-700 w-20 text-right shrink-0">{item.price.toLocaleString()} RWF</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Status breakdown pie */}
          {statusData.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold text-ink-900 mb-4">Today's Breakdown</h2>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {statusData.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                      <span className="capitalize text-ink-600">{s.name.replace('_', ' ')}</span>
                    </div>
                    <span className="font-bold text-ink-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent reviews */}
        {data?.recentReviews?.length > 0 && (
          <div className="card p-5">
            <h2 className="font-bold text-ink-900 mb-4">Recent Reviews</h2>
            <div className="space-y-3">
              {data.recentReviews.slice(0, 5).map(r => (
                <div key={r.id} className="flex gap-3 p-3 bg-ink-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-flame-100 flex items-center justify-center text-sm font-bold text-flame-600 shrink-0">
                    {r.student?.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink-900">{r.student?.name}</span>
                      <span className="text-xs text-ink-400">{'⭐'.repeat(r.overallRating)}</span>
                    </div>
                    {r.comment && <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{r.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
