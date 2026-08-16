import { useState, useEffect, useRef } from 'react'
import { Save, Loader, ToggleLeft, ToggleRight, Lock, Trash2, AlertTriangle, ImagePlus } from 'lucide-react'
import { restaurantAPI, uploadAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import AdminLayout from '../../components/restaurant/AdminLayout'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { restaurant, role, updateRestaurant, logout } = useAdminStore()
  const isViewer = role === 'viewer'
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', description:'', phone:'', prepTimeMin:10, prepTimeMax:20, openTime:'07:00', closeTime:'18:00', minOrder:0, notice:'', coverColor:'#f97316', ownerPhone:'', offersPickup:true, offersDelivery:false, deliveryNote:'', offersCampusDelivery:true, offersOffCampusDelivery:false, campusDeliveryFee:0, offCampusDeliveryFee:0 })
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [pwForm, setPwForm] = useState({ currentPassword:'', newPassword:'', confirm:'' })
  const [pwSaving, setPwSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteForm, setDeleteForm] = useState({ password:'', reason:'' })
  const [deleting, setDeleting] = useState(false)
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    if (restaurant) {
      setForm({ name:restaurant.name||'', description:restaurant.description||'', phone:restaurant.phone||'', prepTimeMin:restaurant.prepTimeMin||10, prepTimeMax:restaurant.prepTimeMax||20, openTime:restaurant.openTime||'07:00', closeTime:restaurant.closeTime||'18:00', minOrder:restaurant.minOrder||0, notice:restaurant.notice||'', coverColor:restaurant.coverColor||'#f97316', ownerPhone:restaurant.ownerPhone||'', offersPickup:restaurant.offersPickup!==false, offersDelivery:!!restaurant.offersDelivery, deliveryNote:restaurant.deliveryNote||'', offersCampusDelivery:restaurant.offersCampusDelivery!==false, offersOffCampusDelivery:!!restaurant.offersOffCampusDelivery, campusDeliveryFee:restaurant.campusDeliveryFee||0, offCampusDeliveryFee:restaurant.offCampusDeliveryFee||0 })
      setLogoPreview(restaurant.logo || '')
    }
  }, [restaurant])

  const handleLogoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const res = await uploadAPI.logo(file)
      const url = res.data.data.url
      setLogoPreview(url)
      await restaurantAPI.updateSettings({ ...form, logo: url })
      updateRestaurant({ logo: url })
      toast.success('Logo updated!')
    } catch { toast.error('Logo upload failed') }
    finally { setLogoUploading(false) }
  }

  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await restaurantAPI.updateSettings(form)
      updateRestaurant(res.data.data)
      toast.success('Settings saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleToggleAccepting = async () => {
    setToggling(true)
    try {
      const res = await restaurantAPI.toggleAccepting()
      updateRestaurant({ isAccepting: res.data.data.isAccepting })
      toast.success(res.data.data.isAccepting ? '✅ Now accepting orders' : '⏸ Order paused')
    } catch { toast.error('Failed') }
    finally { setToggling(false) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirm) { toast.error("Passwords don't match"); return }
    if (pwForm.newPassword.length < 6) { toast.error("Min 6 characters"); return }
    setPwSaving(true)
    try {
      const { authAPI } = await import('../../services/api')
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      toast.success('Password changed!')
      setPwForm({ currentPassword:'', newPassword:'', confirm:'' })
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setPwSaving(false) }
  }

  const handleDeleteAccount = async () => {
    if (!deleteForm.password) { toast.error('Enter your password to confirm'); return }
    if (!window.confirm('This will PERMANENTLY delete your restaurant from the app. Are you absolutely sure?')) return
    setDeleting(true)
    try {
      await restaurantAPI.deleteAccount({ password: deleteForm.password, reason: deleteForm.reason })
      toast.success('Account deleted. Goodbye!')
      logout()
      navigate('/')
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete') }
    finally { setDeleting(false) }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-black text-ink-900">Settings</h1>
          <p className="text-ink-400 text-sm">Manage your restaurant profile</p>
        </div>

        {/* Quick controls */}
        <div className="card p-5">
          <h2 className="font-bold text-white mb-4">Quick Controls</h2>
          <div className="flex items-center justify-between">
            <div><p className="font-semibold text-sm">Accept Orders</p><p className="text-xs text-ink-400">Pause ordering without closing</p></div>
            <button onClick={handleToggleAccepting} disabled={toggling || isViewer} className={`btn btn-sm ${restaurant?.isAccepting ? 'btn-secondary text-emerald-600 border-emerald-200' : 'btn-secondary text-red-500 border-red-200'}`}>
              {restaurant?.isAccepting ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
              {restaurant?.isAccepting ? 'Accepting' : 'Paused'}
            </button>
          </div>
        </div>

        {/* Profile */}
        <div className="card p-5">
          <h2 className="font-bold text-white mb-4">Restaurant Profile</h2>
          <form onSubmit={save} className="space-y-4">
          <fieldset disabled={isViewer} className="space-y-4 border-0 p-0 m-0 disabled:opacity-60">
            {/* Logo */}
            <div>
              <label className="label">Restaurant Logo</label>
              <div className="flex items-center gap-4">
                <div onClick={() => logoInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-ink-200 hover:border-brand-400 bg-ink-50 flex items-center justify-center cursor-pointer transition overflow-hidden shrink-0">
                  {logoUploading
                    ? <Loader size={20} className="animate-spin text-ink-400" />
                    : logoPreview
                      ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      : <ImagePlus size={22} className="text-ink-400" />}
                </div>
                <div className="text-xs text-ink-400">
                  <p className="font-medium">Click to change logo</p>
                  <p className="text-ink-300 mt-0.5">PNG, JPG up to 5 MB</p>
                </div>
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </div>

            <div>
              <label className="label">Brand Colour</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.coverColor} onChange={f('coverColor')} className="w-12 h-10 rounded-xl border border-ink-200 cursor-pointer" />
                <div className="w-16 h-10 rounded-xl border border-ink-200" style={{ background:form.coverColor }} />
                <span className="text-sm text-ink-400 font-mono">{form.coverColor}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[['Restaurant Name','name','col-span-2'],['Phone','phone'],['Owner Phone','ownerPhone']].map(([label, key, span]) => (
                <div key={key} className={span}>
                  <label className="label">{label}</label>
                  <input value={form[key]||''} onChange={f(key)} className="input" />
                </div>
              ))}
              <div><label className="label">Min Prep (min)</label><input type="number" value={form.prepTimeMin} onChange={f('prepTimeMin')} className="input" min="1" /></div>
              <div><label className="label">Max Prep (min)</label><input type="number" value={form.prepTimeMax} onChange={f('prepTimeMax')} className="input" min="1" /></div>
              <div><label className="label">Opens At</label><input type="time" value={form.openTime} onChange={f('openTime')} className="input" /></div>
              <div><label className="label">Closes At</label><input type="time" value={form.closeTime} onChange={f('closeTime')} className="input" /></div>
              <div><label className="label">Min Order (RWF)</label><input type="number" value={form.minOrder} onChange={f('minOrder')} className="input" min="0" /></div>

              {/* Fulfillment */}
              <div className="col-span-2 border border-ink-100 rounded-xl p-3.5 space-y-3">
                <p className="label mb-0">Fulfillment</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.offersPickup} onChange={e => setForm(p => ({ ...p, offersPickup: e.target.checked }))} className="w-4 h-4 rounded accent-brand-500" />
                  <span className="text-sm font-medium text-alu-cream">Offer pickup</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.offersDelivery} onChange={e => setForm(p => ({ ...p, offersDelivery: e.target.checked }))} className="w-4 h-4 rounded accent-brand-500" />
                  <span className="text-sm font-medium text-alu-cream">Offer delivery</span>
                </label>
                {form.offersDelivery && (
                  <div className="pl-7 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.offersCampusDelivery} onChange={e => setForm(p => ({ ...p, offersCampusDelivery: e.target.checked }))} className="w-4 h-4 rounded accent-brand-500" />
                      <span className="text-sm text-alu-cream">Deliver on campus</span>
                    </label>
                    {form.offersCampusDelivery && (
                      <div className="pl-7"><label className="label">On-Campus Delivery Fee (RWF)</label><input type="number" value={form.campusDeliveryFee} onChange={f('campusDeliveryFee')} className="input" min="0" /></div>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.offersOffCampusDelivery} onChange={e => setForm(p => ({ ...p, offersOffCampusDelivery: e.target.checked }))} className="w-4 h-4 rounded accent-brand-500" />
                      <span className="text-sm text-alu-cream">Deliver off campus</span>
                    </label>
                    {form.offersOffCampusDelivery && (
                      <div className="pl-7"><label className="label">Off-Campus Delivery Fee (RWF)</label><input type="number" value={form.offCampusDeliveryFee} onChange={f('offCampusDeliveryFee')} className="input" min="0" /></div>
                    )}
                    <div><label className="label">Delivery Note</label><input value={form.deliveryNote} onChange={f('deliveryNote')} className="input" placeholder="e.g. Delivered within 30 min. On-campus map coming soon." /></div>
                  </div>
                )}
              </div>

              <div className="col-span-2"><label className="label">Notice to Customers</label><input value={form.notice} onChange={f('notice')} className="input" placeholder="e.g. Closed on public holidays" /></div>
              <div className="col-span-2"><label className="label">Description</label><textarea value={form.description} onChange={f('description')} rows={3} className="input resize-none" /></div>
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader size={14} className="animate-spin"/> : <Save size={14}/>}
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </fieldset>
          </form>
        </div>

        {/* Change password — not applicable to a read-only viewer session */}
        {!isViewer && (
        <div className="card p-5">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2"><Lock size={16}/>Change Password</h2>
          <form onSubmit={changePassword} className="space-y-3">
            {[['Current Password','currentPassword'],['New Password','newPassword'],['Confirm New Password','confirm']].map(([label,key]) => (
              <div key={key}><label className="label">{label}</label><input type="password" value={pwForm[key]} onChange={e => setPwForm(p => ({ ...p, [key]:e.target.value }))} className="input" required /></div>
            ))}
            <button type="submit" disabled={pwSaving} className="btn btn-secondary">{pwSaving?'Changing…':'Change Password'}</button>
          </form>
        </div>
        )}

        {/* ── DANGER ZONE — Delete Account — not applicable to a read-only viewer session ── */}
        {!isViewer && (
        <div className="card p-5 border-red-200 bg-red-50/50">
          <h2 className="font-bold text-red-700 mb-1 flex items-center gap-2"><AlertTriangle size={16}/>Danger Zone</h2>
          <p className="text-sm text-red-600 mb-4">Deleting your account removes your restaurant <strong>immediately</strong> from the student app. All your menus, orders, and data will be permanently deleted.</p>

          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="btn btn-danger">
              <Trash2 size={15}/>Delete My Restaurant Account
            </button>
          ) : (
            <div className="space-y-3 border border-red-200 rounded-xl p-4 bg-white">
              <p className="font-semibold text-red-700 text-sm">⚠️ This action cannot be undone.</p>
              <div><label className="label text-red-600">Reason for closing (optional)</label><input value={deleteForm.reason} onChange={e => setDeleteForm(p => ({ ...p, reason:e.target.value }))} className="input border-red-200" placeholder="Moving locations, business closing…" /></div>
              <div><label className="label text-red-600">Enter your password to confirm *</label><input type="password" value={deleteForm.password} onChange={e => setDeleteForm(p => ({ ...p, password:e.target.value }))} className="input border-red-300 focus:border-red-400 focus:ring-red-300/30" placeholder="Your account password" required /></div>
              <div className="flex gap-2">
                <button onClick={() => setShowDelete(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleting || !deleteForm.password} className="btn btn-danger flex-1">
                  {deleting ? <Loader size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                  {deleting ? 'Deleting…' : 'Yes, Delete Everything'}
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </AdminLayout>
  )
}
