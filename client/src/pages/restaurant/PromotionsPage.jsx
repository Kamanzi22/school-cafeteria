import { useState, useEffect } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Tag, Loader, X } from 'lucide-react'
import { promoAPI } from '../../services/api'
import AdminLayout from '../../components/restaurant/AdminLayout'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const EMPTY_PROMO = { code: '', title: '', description: '', type: 'percentage', value: '', minOrder: '', maxDiscount: '', usageLimit: '', validFrom: '', validUntil: '' }

function PromoModal({ onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_PROMO)
  const [saving, setSaving] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await promoAPI.create(form)
      onSave(res.data.data)
      toast.success('Promotion created!')
      onClose()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink-950/60 z-50 flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">New Promotion</h3>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Promo Code *</label>
              <input value={form.code} onChange={f('code')} className="input uppercase font-mono" placeholder="SAVE20" required />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={f('type')} className="input">
                <option value="percentage">Percentage %</option>
                <option value="fixed">Fixed RWF</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Title *</label>
            <input value={form.title} onChange={f('title')} className="input" placeholder="10% Off Your Order" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Discount Value *</label>
              <input type="number" value={form.value} onChange={f('value')} className="input" placeholder={form.type === 'percentage' ? '10' : '500'} required min="0" />
            </div>
            <div>
              <label className="label">Min Order (RWF)</label>
              <input type="number" value={form.minOrder} onChange={f('minOrder')} className="input" placeholder="2000" min="0" />
            </div>
            <div>
              <label className="label">Max Discount (RWF)</label>
              <input type="number" value={form.maxDiscount} onChange={f('maxDiscount')} className="input" placeholder="1000" min="0" />
            </div>
            <div>
              <label className="label">Usage Limit</label>
              <input type="number" value={form.usageLimit} onChange={f('usageLimit')} className="input" placeholder="∞" min="1" />
            </div>
            <div>
              <label className="label">Valid From *</label>
              <input type="datetime-local" value={form.validFrom} onChange={f('validFrom')} className="input text-sm" required />
            </div>
            <div>
              <label className="label">Valid Until *</label>
              <input type="datetime-local" value={form.validUntil} onChange={f('validUntil')} className="input text-sm" required />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? '…' : 'Create Promo'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PromotionsPage() {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { promoAPI.list().then(r => { setPromos(r.data.data); setLoading(false) }) }, [])

  const toggle = async (id) => {
    const res = await promoAPI.toggle(id)
    setPromos(prev => prev.map(p => p.id === id ? res.data.data : p))
  }

  const del = async (id) => {
    if (!window.confirm('Delete this promotion?')) return
    await promoAPI.delete(id)
    setPromos(prev => prev.filter(p => p.id !== id))
    toast.success('Deleted')
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-ink-900">Promotions</h1>
            <p className="text-ink-400 text-sm">Create discount codes for your customers</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm"><Plus size={14} />New Promo</button>
        </div>

        {loading ? <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
        : promos.length === 0 ? (
          <div className="text-center py-20">
            <Tag size={40} className="text-ink-200 mx-auto mb-3" />
            <p className="text-ink-400 font-semibold">No promotions yet</p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary mt-4"><Plus size={16} />Create First Promo</button>
          </div>
        ) : (
          <div className="space-y-3">
            {promos.map(p => {
              const expired = new Date(p.validUntil) < new Date()
              return (
                <div key={p.id} className={`card p-4 flex items-center gap-4 ${!p.isActive || expired ? 'opacity-60' : ''}`}>
                  <div className="w-12 h-12 bg-flame-100 rounded-xl flex items-center justify-center shrink-0">
                    <Tag size={20} className="text-flame-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-flame-500">{p.code}</span>
                      <span className="badge bg-ink-100 text-ink-600 font-semibold">
                        {p.type === 'percentage' ? `${p.value}% off` : `${p.value.toLocaleString()} RWF off`}
                      </span>
                      {expired && <span className="badge bg-red-100 text-red-500">Expired</span>}
                      {!p.isActive && !expired && <span className="badge bg-ink-100 text-ink-400">Paused</span>}
                    </div>
                    <p className="font-semibold text-sm text-ink-900 mt-0.5">{p.title}</p>
                    <p className="text-xs text-ink-400">
                      Used {p.usageCount}{p.usageLimit ? `/${p.usageLimit}` : ''} times ·
                      Until {format(new Date(p.validUntil), 'dd MMM yyyy')}
                      {p.minOrder > 0 && ` · Min ${p.minOrder.toLocaleString()} RWF`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggle(p.id)} className={`btn btn-ghost btn-icon ${p.isActive ? 'text-emerald-500' : 'text-ink-400'}`}>
                      {p.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button onClick={() => del(p.id)} className="btn btn-ghost btn-icon text-ink-400 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {showModal && <PromoModal onSave={p => setPromos(prev => [p, ...prev])} onClose={() => setShowModal(false)} />}
    </AdminLayout>
  )
}
