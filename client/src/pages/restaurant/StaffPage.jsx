import { useState, useEffect } from 'react'
import { Plus, Users, X, Loader } from 'lucide-react'
import { restaurantAPI, authAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import AdminLayout from '../../components/restaurant/AdminLayout'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function StaffPage() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'staff' })
  const [saving, setSaving] = useState(false)
  const { admin } = useAdminStore()
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    restaurantAPI.adminGet().then(r => { setStaff(r.data.data.admins || []); setLoading(false) })
  }, [])

  const addStaff = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await authAPI.addStaff(form)
      setStaff(prev => [...prev, res.data.data])
      setForm({ name: '', username: '', password: '', role: 'staff' })
      setShowForm(false)
      toast.success('Staff account created!')
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-ink-900">Staff</h1>
            <p className="text-ink-400 text-sm">Manage who can access this dashboard</p>
          </div>
          {admin?.role === 'owner' && (
            <button onClick={() => setShowForm(s => !s)} className="btn btn-primary btn-sm">
              <Plus size={14} />Add Staff
            </button>
          )}
        </div>

        {showForm && (
          <div className="card p-5 mb-5 border-flame-200 bg-flame-50/30">
            <h3 className="font-bold text-ink-900 mb-4">New Staff Account</h3>
            <form onSubmit={addStaff} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Full Name *</label>
                  <input value={form.name} onChange={f('name')} className="input" placeholder="Jane Doe" required />
                </div>
                <div>
                  <label className="label">Username *</label>
                  <input value={form.username} onChange={f('username')} className="input" placeholder="jane_staff" required />
                </div>
                <div>
                  <label className="label">Password *</label>
                  <input type="password" value={form.password} onChange={f('password')} className="input" placeholder="Min 8 chars" required minLength={6} />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select value={form.role} onChange={f('role')} className="input">
                    <option value="staff">Staff (orders only)</option>
                    <option value="manager">Manager (orders + menu)</option>
                    <option value="owner">Owner (full access)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? <Loader size={14} className="animate-spin" /> : null}
                  {saving ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
        : (
          <div className="card overflow-hidden">
            {staff.map((s, i) => (
              <div key={s.id} className={`flex items-center gap-3 px-5 py-4 ${i < staff.length - 1 ? 'border-b border-ink-50' : ''} ${!s.isActive ? 'opacity-60' : ''}`}>
                <div className="w-10 h-10 rounded-full gradient-flame flex items-center justify-center text-white font-bold shrink-0">{s.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-ink-900">{s.name} {s.id === admin?.id && <span className="text-xs text-flame-500">(you)</span>}</p>
                  <p className="text-xs text-ink-400">@{s.username} · <span className="capitalize">{s.role}</span></p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`badge ${s.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-ink-100 text-ink-400'}`}>{s.isActive ? 'Active' : 'Inactive'}</span>
                  {s.lastLoginAt && <p className="text-[10px] text-ink-400 mt-0.5">Last: {format(new Date(s.lastLoginAt), 'dd MMM HH:mm')}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
