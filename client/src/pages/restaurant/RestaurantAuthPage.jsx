import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Mail, Lock, User, Store, Phone, Loader, Eye, EyeOff, LogIn, UserPlus, ImagePlus } from 'lucide-react'
import { authAPI } from '../../services/api'
import { useAdminStore } from '../../store'
import toast from 'react-hot-toast'

export default function RestaurantAuthPage() {
  const { tab: initialTab } = useParams()
  const [tab, setTab] = useState(initialTab === 'register' ? 'register' : 'login')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { loginOwner, logout, restaurant } = useAdminStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (restaurant) logout()
  }, [])
  const logoInputRef = useRef(null)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [regForm, setRegForm] = useState({ ownerName: '', ownerEmail: '', ownerPhone: '', password: '', restaurantName: '', description: '', phone: '', venueType: 'CAFETERIA', storeMode: 'ON_CAMPUS' })
  const isMarketplace = regForm.venueType === 'MARKETPLACE'
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const rf = k => e => setRegForm(p => ({ ...p, [k]: e.target.value }))

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await authAPI.restaurantLogin(loginForm)
      loginOwner(res.data.data.restaurant, res.data.data.token)
      toast.success(`Welcome back! ${res.data.data.restaurant.name} 🎉`)
      navigate('/admin')
    } catch (e) { toast.error(e.response?.data?.error || 'Login failed') }
    finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(regForm).forEach(([k, v]) => fd.append(k, v))
      if (logoFile) fd.append('logo', logoFile)
      const res = await authAPI.restaurantRegister(fd)
      loginOwner(res.data.data.restaurant, res.data.data.token)
      toast.success(`${res.data.data.restaurant.name} is now live! 🎉`)
      navigate('/admin')
    } catch (e) { toast.error(e.response?.data?.error || 'Registration failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="btn text-ink-400 hover:text-white btn-sm mb-6 inline-flex gap-2">
          <ArrowLeft size={15} /> Back to student app
        </Link>

        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-2xl font-black text-white">Seller Portal</h1>
          <p className="text-ink-500 text-sm mt-1">Manage your cafeteria stall or marketplace store</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-ink-900 rounded-2xl p-1 mb-5 border border-ink-800">
          {[['login', 'Owner Login', LogIn], ['register', 'Register', UserPlus]].map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t ? 'bg-brand-500 text-white' : 'text-ink-500 hover:text-ink-300'}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        <div className="bg-ink-900 rounded-2xl p-6 border border-ink-800">

          {/* ── OWNER LOGIN ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <p className="text-ink-400 text-sm mb-2">Sign in with the email you registered with.</p>
              <div>
                <label className="label text-ink-500">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
                  <input type="email" value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 pl-9 text-white placeholder-ink-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                    placeholder="you@restaurant.com" required />
                </div>
              </div>
              <div>
                <label className="label text-ink-500">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
                  <input type={showPw ? 'text' : 'password'} value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 pl-9 pr-10 text-white placeholder-ink-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                    placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-600">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg mt-1">
                {loading ? <Loader size={16} className="animate-spin" /> : null}
                {loading ? 'Signing in…' : 'Sign In to Dashboard'}
              </button>
              <div className="border-t border-ink-800 pt-3 text-xs text-ink-500 text-center">
                Don't have an account?{' '}
                <button type="button" onClick={() => setTab('register')} className="text-brand-400 hover:text-brand-300 font-semibold">Register here</button>
              </div>
            </form>
          )}

          {/* ── RESTAURANT REGISTRATION ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 text-xs text-brand-300">
                ✨ Register your store and it goes live instantly on the student app.
              </div>

              <p className="text-xs font-bold text-ink-400 uppercase tracking-wider">What are you setting up?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { type: 'CAFETERIA', emoji: '🏫', title: 'Cafeteria Stall', sub: 'A food stall in the school cafeteria' },
                  { type: 'MARKETPLACE', emoji: '🛍️', title: 'Marketplace Store', sub: 'Your own student-run online store' },
                ].map(v => (
                  <button key={v.type} type="button" onClick={() => setRegForm(p => ({ ...p, venueType: v.type }))}
                    className={`text-left p-3.5 rounded-xl border-2 transition ${regForm.venueType === v.type ? 'border-brand-500 bg-brand-500/10' : 'border-ink-700 hover:border-ink-600'}`}>
                    <span className="text-2xl">{v.emoji}</span>
                    <p className="font-semibold text-sm text-white mt-1.5">{v.title}</p>
                    <p className="text-[11px] text-ink-500 mt-0.5">{v.sub}</p>
                  </button>
                ))}
              </div>

              {isMarketplace && (
                <>
                  <p className="text-xs font-bold text-ink-400 uppercase tracking-wider pt-1">Is your store on campus or online?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { mode: 'ON_CAMPUS', emoji: '🏬', title: 'On Campus', sub: 'You have a physical spot on campus' },
                      { mode: 'VIRTUAL', emoji: '🌐', title: 'Online (Digital)', sub: 'Fully digital — no physical spot' },
                    ].map(v => (
                      <button key={v.mode} type="button" onClick={() => setRegForm(p => ({ ...p, storeMode: v.mode }))}
                        className={`text-left p-3.5 rounded-xl border-2 transition ${regForm.storeMode === v.mode ? 'border-brand-500 bg-brand-500/10' : 'border-ink-700 hover:border-ink-600'}`}>
                        <span className="text-2xl">{v.emoji}</span>
                        <p className="font-semibold text-sm text-white mt-1.5">{v.title}</p>
                        <p className="text-[11px] text-ink-500 mt-0.5">{v.sub}</p>
                      </button>
                    ))}
                  </div>
                  {regForm.storeMode === 'VIRTUAL' && (
                    <p className="text-[11px] text-ink-500 bg-ink-800/60 rounded-lg px-3 py-2">🌐 Your store will be delivery-only (no pickup location) and you'll get full stock & inventory tools — track quantities, SKUs, and options like size or color.</p>
                  )}
                </>
              )}

              <p className="text-xs font-bold text-ink-400 uppercase tracking-wider pt-1">Owner Information</p>
              {[
                { label: 'Your Full Name *', key: 'ownerName', placeholder: 'Amina Uwase', Icon: User },
                { label: 'Your Email * (used to log in)', key: 'ownerEmail', placeholder: 'amina@restaurant.com', Icon: Mail, type: 'email' },
                { label: 'Your Password * (min 6 chars)', key: 'password', placeholder: '••••••••', Icon: Lock, type: showPw ? 'text' : 'password' },
                { label: 'Your Phone', key: 'ownerPhone', placeholder: '+250 78…', Icon: Phone },
              ].map(({ label, key, placeholder, Icon, type }) => (
                <div key={key}>
                  <label className="label text-ink-500">{label}</label>
                  <div className="relative">
                    <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
                    <input type={type || 'text'} value={regForm[key]} onChange={rf(key)} required={label.includes('*')} minLength={key === 'password' ? 6 : undefined}
                      className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 pl-9 text-white placeholder-ink-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      placeholder={placeholder} />
                    {key === 'password' && (
                      <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-600">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <p className="text-xs font-bold text-ink-400 uppercase tracking-wider pt-2">{isMarketplace ? 'Store Details' : 'Restaurant Details'}</p>

              {/* Logo upload */}
              <div>
                <label className="label text-ink-500">{isMarketplace ? 'Store Logo' : 'Restaurant Logo'}</label>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-ink-700 hover:border-brand-500 bg-ink-800 flex items-center justify-center cursor-pointer transition overflow-hidden shrink-0">
                    {logoPreview
                      ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                      : <ImagePlus size={24} className="text-ink-600" />}
                  </div>
                  <div className="text-xs text-ink-500">
                    <p>Click to upload your logo</p>
                    <p className="mt-0.5 text-ink-600">PNG, JPG up to 5 MB</p>
                    {logoPreview && (
                      <button type="button" onClick={() => { setLogoFile(null); setLogoPreview('') }}
                        className="mt-1.5 text-red-400 hover:text-red-300">Remove</button>
                    )}
                  </div>
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </div>

              {[
                { label: isMarketplace ? 'Store Name *' : 'Restaurant Name *', key: 'restaurantName', placeholder: isMarketplace ? 'e.g. Amina\'s Crafts' : 'e.g. Mama Africa Kitchen', Icon: Store },
                { label: 'Contact Phone', key: 'phone', placeholder: '+250 78…', Icon: Phone },
              ].map(({ label, key, placeholder, Icon }) => (
                <div key={key}>
                  <label className="label text-ink-500">{label}</label>
                  <div className="relative">
                    <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
                    <input type="text" value={regForm[key]} onChange={rf(key)} required={label.includes('*')}
                      className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 pl-9 text-white placeholder-ink-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition"
                      placeholder={placeholder} />
                  </div>
                </div>
              ))}

              <div>
                <label className="label text-ink-500">Short Description</label>
                <textarea value={regForm.description} onChange={rf('description')} rows={3}
                  className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 text-white placeholder-ink-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition resize-none"
                  placeholder={isMarketplace ? 'Tell shoppers what makes your store special…' : 'Tell customers what makes your restaurant special…'} />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg mt-2">
                {loading ? <Loader size={16} className="animate-spin" /> : <Store size={16} />}
                {loading ? 'Creating your store…' : isMarketplace ? 'Register My Store' : 'Register My Restaurant'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
