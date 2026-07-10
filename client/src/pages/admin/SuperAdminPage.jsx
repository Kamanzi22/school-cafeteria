import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Store, Users, ShoppingBag, CheckCircle, XCircle, Trash2, Loader, LogIn } from 'lucide-react'
import { superAdminAPI, authAPI } from '../../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function SuperAdminPage() {
  const [authed, setAuthed] = useState(false)
  const [token, setToken] = useState(null)
  const [form, setForm] = useState({ username:'', password:'' })
  const [restaurants, setRestaurants] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [venueFilter, setVenueFilter] = useState('all')

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginLoading(true)
    try {
      const res = await authAPI.superAdminLogin(form)
      localStorage.setItem('cc-admin-v3', JSON.stringify({ state:{ token: res.data.data.token } }))
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
    }).catch(() => setLoading(false))
  }, [authed])

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
                <input type={k==='password'?'password':'text'} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]:e.target.value }))} className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500" required />
              </div>
            ))}
            <button type="submit" disabled={loginLoading} className="btn btn-primary w-full btn-lg">
              {loginLoading ? <Loader size={16} className="animate-spin"/> : <LogIn size={16}/>}
              {loginLoading ? 'Signing in…' : 'Access Admin Panel'}
            </button>
          </form>
          <p className="text-xs text-ink-600 text-center mt-3">Demo: superadmin / super123</p>
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
              <div key={l} className="card p-4">
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
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-ink-900">All Stores</h2>
            <div className="flex gap-1 bg-ink-100 rounded-lg p-1">
              {[['all', 'All'], ['CAFETERIA', '🍽️ Cafeteria'], ['MARKETPLACE', '🛍️ Marketplace']].map(([val, label]) => (
                <button key={val} onClick={() => setVenueFilter(val)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${venueFilter === val ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {loading ? <div className="p-8 text-center"><Loader className="animate-spin text-brand-500 mx-auto" /></div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-ink-100 text-xs text-ink-400 uppercase tracking-wider">
                  {['Store','Venue','Owner','Status','Approved','Orders','Joined','Actions'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {restaurants.filter(r => venueFilter === 'all' || r.venueType === venueFilter).map(r => (
                    <tr key={r.id} className={`border-b border-ink-50 hover:bg-ink-50 ${r.isDeleted ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{r.emoji}</span>
                          <div><p className="font-semibold text-ink-900">{r.name}</p><p className="text-xs text-ink-400">{r.category}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${r.venueType === 'MARKETPLACE' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                          {r.venueType === 'MARKETPLACE' ? '🛍️ Marketplace' : '🍽️ Cafeteria'}
                        </span>
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
                          <button onClick={() => deleteRestaurant(r.id, r.name)} className="btn btn-ghost btn-icon text-red-400 hover:text-red-600">
                            <Trash2 size={15}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
