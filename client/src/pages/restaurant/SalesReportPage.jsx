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

export default function SalesReportPage() {
  const [range, setRange] = useState('day')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    analyticsAPI.salesReport(range).then(r => { setData(r.data.data); setLoading(false) }).catch(() => setLoading(false))
  }, [range])

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-ink-900">Sales Report</h1>
            <p className="text-ink-400 text-sm">What sold, how much, and when</p>
          </div>
          <select value={range} onChange={e => setRange(e.target.value)} className="input w-auto">
            {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader size={24} className="animate-spin text-flame-500" /></div>
        ) : !data?.rows?.length ? (
          <div className="card py-20 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="font-bold text-ink-400 text-lg">No sales in this period</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(row => (
                      <tr key={row.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/50">
                        <td className="px-4 py-3">
                          <span className="text-base mr-1.5">{row.emoji}</span>
                          <span className="font-medium text-ink-900">{row.name}</span>
                          {row.variantName && <span className="text-ink-400"> ({row.variantName})</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-700">{row.quantity}</td>
                        <td className="px-4 py-3 text-right text-ink-500">{row.unitPrice.toLocaleString()} RWF</td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-900">{row.subtotal.toLocaleString()} RWF</td>
                        <td className="px-4 py-3 text-right text-ink-400">{format(new Date(row.time), 'd MMM, HH:mm')}</td>
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
                    <p className="font-black text-lg text-ink-900 leading-tight">{data.topSeller.emoji} {data.topSeller.name}</p>
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
                    <p className="font-black text-lg text-ink-900 leading-tight">{data.peakHour.label}</p>
                    <p className="text-xs text-ink-400 mt-1">{data.peakHour.orders} orders</p>
                  </>
                ) : <p className="text-ink-300">—</p>}
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Total Revenue</p>
                  <DollarSign size={16} className="text-emerald-500" />
                </div>
                <p className="font-black text-2xl text-ink-900 leading-tight">{data.totals.revenue.toLocaleString()} RWF</p>
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Total Orders</p>
                  <ShoppingBag size={16} className="text-indigo-500" />
                </div>
                <p className="font-black text-2xl text-ink-900 leading-tight">{data.totals.orders}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
