import { useState, useEffect } from 'react'
import { Loader, DollarSign, ShoppingBag, Crown, Clock } from 'lucide-react'
import { analyticsAPI } from '../../services/api'
import AdminLayout from '../../components/restaurant/AdminLayout'
import { format } from 'date-fns'

const RANGES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const MONTHS = [
  { value: 0, label: 'Jan' }, { value: 1, label: 'Feb' }, { value: 2, label: 'Mar' },
  { value: 3, label: 'Apr' }, { value: 4, label: 'May' }, { value: 5, label: 'Jun' },
  { value: 6, label: 'Jul' }, { value: 7, label: 'Aug' }, { value: 8, label: 'Sep' },
  { value: 9, label: 'Oct' }, { value: 10, label: 'Nov' }, { value: 11, label: 'Dec' },
]
const YEARS = [2026, 2027, 2028, 2029, 2030]

export default function SalesReportPage() {
  const now = new Date()
  const [range, setRange] = useState('day')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(Math.min(Math.max(now.getFullYear(), YEARS[0]), YEARS[YEARS.length - 1]))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsAPI.salesReport(range, range === 'month' ? { month, year } : {}).then(r => { setData(r.data.data); setLoading(false) }).catch(() => setLoading(false))
  }, [range, month, year])

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-ink-900">Sales Report</h1>
            <p className="text-ink-400 text-sm">What sold, how much, and when</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={range} onChange={e => setRange(e.target.value)} className="input w-auto">
              {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            {range === 'month' && (
              <>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input w-auto">
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-auto">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader size={24} className="animate-spin text-flame-500" /></div>
        ) : !data ? (
          <div className="card py-20 text-center">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="font-bold text-ink-400 text-lg">Couldn't load the sales report</p>
          </div>
        ) : (
          <>
            {/* Sales table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-400 uppercase tracking-wide">
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold text-right">Qty Sold</th>
                      <th className="px-4 py-3 font-semibold text-right">Unit Price</th>
                      <th className="px-4 py-3 font-semibold text-right">Subtotal</th>
                      <th className="px-4 py-3 font-semibold text-right">Time Sold</th>
                      <th className="px-4 py-3 font-semibold text-right">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length ? data.rows.map(row => (
                      <tr key={row.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                        <td className="px-4 py-3">
                          <span className="text-base mr-1.5">{row.emoji}</span>
                          <span className="font-medium text-white">{row.name}</span>
                          {row.variantName && <span className="text-ink-400"> ({row.variantName})</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-alu-cream">{row.quantity}</td>
                        <td className="px-4 py-3 text-right text-alu-cream">{row.unitPrice.toLocaleString()} RWF</td>
                        <td className="px-4 py-3 text-right font-semibold text-white">{row.subtotal.toLocaleString()} RWF</td>
                        <td className="px-4 py-3 text-right text-ink-400">{format(new Date(row.time), 'd MMM, HH:mm')}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${row.fulfillmentType === 'delivery' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {row.fulfillmentType === 'delivery' ? 'Delivery' : 'Pick up'}
                          </span>
                        </td>
                      </tr>
                    )) : data.placeholderDays.map(day => (
                      <tr key={day} className="border-b border-ink-50 last:border-0 text-ink-300">
                        <td className="px-4 py-3">—</td>
                        <td className="px-4 py-3 text-right">0</td>
                        <td className="px-4 py-3 text-right">0 RWF</td>
                        <td className="px-4 py-3 text-right">0 RWF</td>
                        <td className="px-4 py-3 text-right">----</td>
                        <td className="px-4 py-3 text-right">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Top Seller</p>
                  <Crown size={16} className="text-amber-400" />
                </div>
                {data.topSeller ? (
                  <>
                    <p className="font-black text-lg text-white leading-tight">{data.topSeller.emoji} {data.topSeller.name}</p>
                    <p className="text-xs text-ink-400 mt-1">{data.topSeller.quantity} sold</p>
                  </>
                ) : <p className="text-ink-300">—</p>}
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Peak Sales Time</p>
                  <Clock size={16} className="text-flame-400" />
                </div>
                {data.peakHour ? (
                  <>
                    <p className="font-black text-lg text-white leading-tight">{data.peakHour.label}</p>
                    <p className="text-xs text-ink-400 mt-1">{data.peakHour.orders} orders</p>
                  </>
                ) : <p className="text-ink-300">—</p>}
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Total Revenue</p>
                  <DollarSign size={16} className="text-emerald-500" />
                </div>
                <p className="font-black text-2xl text-white leading-tight">{data.totals.revenue.toLocaleString()} RWF</p>
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Total Orders</p>
                  <ShoppingBag size={16} className="text-indigo-500" />
                </div>
                <p className="font-black text-2xl text-white leading-tight">{data.totals.orders}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
