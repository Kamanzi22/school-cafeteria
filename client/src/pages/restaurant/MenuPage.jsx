import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, Search, X, Loader, ImagePlus, ShoppingBag, PackageX } from 'lucide-react'
import { menuAPI, restaurantAPI, uploadAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import AdminLayout from '../../components/restaurant/AdminLayout'
import toast from 'react-hot-toast'

const EMPTY = { name: '', description: '', price: '', prepTime: '', image: '', soldOut: false, trackStock: false, stock: '', sku: '', hasVariants: false, variants: [] }
const EMPTY_VARIANT = { name: '', priceDelta: '0', stock: '0', sku: '' }

function ItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(
    item ? {
      name: item.name, description: item.description || '', price: item.price, prepTime: item.prepTime || '', image: item.image || '', soldOut: !item.isAvailable,
      trackStock: item.trackStock || false, stock: item.stock ?? '', sku: item.sku || '', hasVariants: item.hasVariants || false,
      variants: (item.variants || []).map(v => ({ name: v.name, priceDelta: v.priceDelta, stock: v.stock, sku: v.sku || '' })),
    } : EMPTY
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const imgRef = useRef(null)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setVariant = (i, k, val) => setForm(p => ({ ...p, variants: p.variants.map((v, idx) => idx === i ? { ...v, [k]: val } : v) }))
  const addVariant = () => setForm(p => ({ ...p, variants: [...p.variants, { ...EMPTY_VARIANT }] }))
  const removeVariant = (i) => setForm(p => ({ ...p, variants: p.variants.filter((_, idx) => idx !== i) }))

  const handleImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadAPI.logo(file)
      setForm(p => ({ ...p, image: res.data.data.url }))
    } catch { toast.error('Image upload failed') }
    finally { setUploading(false) }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name || !form.price) { toast.error('Name and price are required'); return }
    if (form.hasVariants && form.variants.length === 0) { toast.error('Add at least one option, or turn off "Has options"'); return }
    if (form.hasVariants && form.variants.some(v => !v.name.trim())) { toast.error('Every option needs a name'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: form.price,
        prepTime: form.prepTime,
        image: form.image || null,
        isAvailable: !form.soldOut,
        trackStock: form.trackStock,
        stock: form.trackStock && !form.hasVariants ? form.stock : '',
        sku: !form.hasVariants ? form.sku : '',
        hasVariants: form.hasVariants,
        variants: form.hasVariants ? form.variants : [],
      }
      const res = item?.id ? await menuAPI.update(item.id, payload) : await menuAPI.create(payload)
      onSave(res.data.data, !!item?.id)
      toast.success(item?.id ? 'Item updated!' : 'Item added!')
      onClose()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-ink-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-ink-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-bold text-lg text-ink-900">{item?.id ? 'Edit Item' : 'Add Menu Item'}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          {/* Image upload */}
          <div>
            <label className="label">Item Photo</label>
            <div className="flex items-center gap-4">
              <div onClick={() => imgRef.current?.click()}
                className="w-24 h-24 rounded-2xl border-2 border-dashed border-ink-200 hover:border-brand-400 bg-ink-50 flex items-center justify-center cursor-pointer transition overflow-hidden shrink-0">
                {uploading
                  ? <Loader size={20} className="animate-spin text-ink-400" />
                  : form.image
                    ? <img src={form.image} alt="preview" className="w-full h-full object-cover" />
                    : <ImagePlus size={24} className="text-ink-400" />}
              </div>
              <div className="text-xs text-ink-400">
                <p className="font-medium text-ink-600">Click to upload photo</p>
                <p className="mt-0.5">PNG, JPG up to 5 MB</p>
                {form.image && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, image: '' }))}
                    className="mt-1.5 text-red-400 hover:text-red-600 font-medium">Remove</button>
                )}
              </div>
            </div>
            <input ref={imgRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </div>

          {/* Name */}
          <div>
            <label className="label">Item Name *</label>
            <input value={form.name} onChange={f('name')} className="input" placeholder="e.g. Grilled Chicken" required />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={f('description')} className="input resize-none h-20 text-sm" placeholder="Describe this dish…" />
          </div>

          {/* Price & Prep time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (RWF) *</label>
              <input type="number" value={form.price} onChange={f('price')} className="input" placeholder="2500" min="0" required />
            </div>
            <div>
              <label className="label">Prep Time (min)</label>
              <input type="number" value={form.prepTime} onChange={f('prepTime')} className="input" placeholder="10" min="1" />
            </div>
          </div>

          {/* Sold Out */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-ink-100 hover:bg-ink-50 transition">
            <input type="checkbox" checked={!!form.soldOut} onChange={f('soldOut')} className="w-4 h-4 rounded accent-red-500" />
            <div>
              <p className="text-sm font-semibold text-ink-800">Mark as Sold Out</p>
              <p className="text-xs text-ink-400">Customers will see this item is unavailable</p>
            </div>
          </label>

          {/* Stock & variants */}
          <div className="space-y-3 border border-ink-100 rounded-xl p-3.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.hasVariants} onChange={e => setForm(p => ({ ...p, hasVariants: e.target.checked }))} className="w-4 h-4 rounded accent-brand-500" />
              <div>
                <p className="text-sm font-semibold text-ink-800">Has options (size, color…)</p>
                <p className="text-xs text-ink-400">Each option tracks its own stock</p>
              </div>
            </label>

            {form.hasVariants ? (
              <div className="space-y-2 pl-1">
                {form.variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={v.name} onChange={e => setVariant(i, 'name', e.target.value)} placeholder="e.g. Medium / Blue" className="input text-sm flex-1" />
                    <input type="number" value={v.priceDelta} onChange={e => setVariant(i, 'priceDelta', e.target.value)} placeholder="+RWF" className="input text-sm w-16" title="Price adjustment" />
                    <input type="number" value={v.stock} onChange={e => setVariant(i, 'stock', e.target.value)} placeholder="Stock" min="0" className="input text-sm w-16" />
                    <input value={v.sku} onChange={e => setVariant(i, 'sku', e.target.value)} placeholder="SKU" className="input text-sm w-20" title="Stock keeping unit" />
                    <button type="button" onClick={() => removeVariant(i)} className="btn btn-ghost btn-icon text-ink-400 hover:text-red-500 shrink-0"><X size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={addVariant} className="btn btn-secondary btn-sm text-xs"><Plus size={12} /> Add option</button>
              </div>
            ) : (
              <>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.trackStock} onChange={e => setForm(p => ({ ...p, trackStock: e.target.checked }))} className="w-4 h-4 rounded accent-brand-500" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink-800">Track stock</p>
                    <p className="text-xs text-ink-400">Auto-marks out of stock at zero</p>
                  </div>
                  {form.trackStock && (
                    <input type="number" value={form.stock} onChange={f('stock')} placeholder="Qty" min="0" className="input text-sm w-20" />
                  )}
                </label>
                <div className="pl-7">
                  <label className="label">SKU (optional)</label>
                  <input value={form.sku} onChange={f('sku')} placeholder="e.g. BRC-001" className="input text-sm" />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="btn btn-primary flex-1">
              {saving ? <Loader size={14} className="animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const { role } = useAdminStore()
  const isViewer = role === 'viewer'

  useEffect(() => {
    menuAPI.list()
      .then(r => { setItems(r.data.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const saveItem = (item, isEdit) =>
    setItems(prev => isEdit ? prev.map(i => i.id === item.id ? item : i) : [...prev, item])

  const toggleSoldOut = async (item) => {
    try {
      const res = await menuAPI.update(item.id, { isAvailable: !item.isAvailable })
      setItems(prev => prev.map(i => i.id === item.id ? res.data.data : i))
    } catch { toast.error('Failed to update') }
  }

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this item permanently?')) return
    await menuAPI.delete(id)
    setItems(prev => prev.filter(i => i.id !== id))
    toast.success('Deleted')
  }

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    return !q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
  })

  const available = items.filter(i => i.isAvailable).length
  const soldOut = items.filter(i => !i.isAvailable).length

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-ink-900">Menu</h1>
            <p className="text-ink-400 text-sm">
              {items.length} items · {available} available
              {soldOut > 0 && <span className="text-red-400"> · {soldOut} sold out</span>}
            </p>
          </div>
          {!isViewer && (
            <button onClick={() => { setEditItem(null); setShowModal(true) }} className="btn btn-primary btn-sm">
              <Plus size={14} /> Add Item
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-5 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu…" className="input pl-8 py-2 text-sm" />
        </div>

        {loading ? (
          <div className="space-y-2">{Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag size={40} className="mx-auto text-ink-200 mb-3" />
            <p className="text-ink-400 font-semibold">No items yet</p>
            {!isViewer && (
              <button onClick={() => { setShowModal(true); setEditItem(null) }} className="btn btn-primary mt-4">
                <Plus size={16} /> Add First Item
              </button>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {filtered.map((item, idx) => (
              <div key={item.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-ink-50 transition ${idx < filtered.length - 1 ? 'border-b border-ink-100' : ''}`}>
                {/* Photo or emoji */}
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-ink-100 flex items-center justify-center shrink-0">
                  {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    : <span className="text-2xl">{item.emoji}</span>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-ink-900 truncate">{item.name}</span>
                    {!item.isAvailable && (
                      <span className="badge bg-red-100 text-red-500 text-[10px] shrink-0">Sold Out</span>
                    )}
                    {item.hasVariants && (
                      <span className="badge bg-ink-100 text-ink-500 text-[10px] shrink-0">{item.variants?.length || 0} options</span>
                    )}
                    {!item.hasVariants && item.trackStock && (
                      <span className={`badge text-[10px] shrink-0 ${item.stock > 0 ? 'bg-ink-100 text-ink-500' : 'bg-red-100 text-red-500'}`}>
                        {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-400 mt-0.5">
                    <span className="font-semibold text-brand-500">{item.price.toLocaleString()} RWF</span>
                    {item.prepTime && <span>· {item.prepTime} min</span>}
                  </div>
                </div>

                {/* Actions — hidden for a read-only viewer, since the server rejects these anyway */}
                {!isViewer && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleSoldOut(item)}
                      title={item.isAvailable ? 'Mark sold out' : 'Mark available'}
                      className={`btn btn-ghost btn-sm text-xs font-semibold px-2.5 ${!item.isAvailable ? 'text-emerald-600 hover:bg-emerald-50' : 'text-red-400 hover:bg-red-50'}`}>
                      {item.isAvailable ? 'Sold Out' : 'Available'}
                    </button>
                    <button onClick={() => { setEditItem(item); setShowModal(true) }}
                      className="btn btn-ghost btn-icon text-ink-400 hover:text-blue-500">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => deleteItem(item.id)}
                      className="btn btn-ghost btn-icon text-ink-400 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ItemModal
          item={editItem}
          onSave={saveItem}
          onClose={() => { setShowModal(false); setEditItem(null) }}
        />
      )}
    </AdminLayout>
  )
}
