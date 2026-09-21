import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Lock, User, Phone, Loader, UserCheck, Eye, EyeOff } from 'lucide-react'
import { authAPI } from '../../services/api'
import { useCustomerStore } from '../../store'
import { useBackNavigate } from '../../hooks/useBackNavigate'
import GoogleSignInButton from '../../components/shared/GoogleSignInButton'
import toast from 'react-hot-toast'

const GOOGLE_ENABLED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function CustomerAuthPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') === 'register' ? 'register' : 'login') // login | register (| guest)
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', phone:'' })
  const { login } = useCustomerStore()
  const navigate = useNavigate()
  const goBack = useBackNavigate()
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const payload = form.email ? { email: form.email, password: form.password } : { studentId: form.studentId, password: form.password }
      const res = await authAPI.customerLogin(payload)
      login(res.data.data.customer, res.data.data.token)
      toast.success(`Welcome back, ${res.data.data.customer.name}! 👋`)
      navigate('/')
    } catch (e) { toast.error(e.response?.data?.error || 'Login failed') }
    finally { setLoading(false) }
  }

  // First-time Google users are asked for a phone number before the account is created
  // (`googlePending` holds their verified Google token until then).
  const [googlePending, setGooglePending] = useState(null) // { credential, name, email }
  const [gPhone, setGPhone] = useState('')

  const googleAuth = async (credential, phone) => {
    setLoading(true)
    try {
      const res = await authAPI.customerGoogle({ credential, phone })
      const data = res.data.data
      if (data.needsPhone) { setGooglePending({ credential, name: data.name, email: data.email }); return }
      login(data.customer, data.token)
      toast.success(`Welcome, ${data.customer.name}! 👋`)
      navigate('/')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Google sign-in failed')
      if (e.response?.status === 401) setGooglePending(null)
    } finally { setLoading(false) }
  }

  const googleBlock = (
    <>
      <GoogleSignInButton onCredential={(c) => googleAuth(c)} />
      {GOOGLE_ENABLED && tab === 'login' && (
        <div className="flex items-center gap-3 my-4 text-xs text-ink-400">
          <div className="flex-1 h-px bg-ink-100" />or<div className="flex-1 h-px bg-ink-100" />
        </div>
      )}
    </>
  )

  return (
    <div className="min-h-dvh bg-ink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={goBack} className="btn btn-ghost btn-sm mb-6 -ml-2 text-ink-500">
          <ArrowLeft size={15} /> Back
        </button>

        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-black text-ink-900">Join CaféCampus</h1>
          <p className="text-ink-400 text-sm mt-1">Order food from your school cafeteria</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-ink-100 rounded-2xl p-1 mb-5">
          {[['login','Sign In'], ['register','Create Account']].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="card p-5">
          {googlePending ? (
            <form onSubmit={(e) => { e.preventDefault(); googleAuth(googlePending.credential, gPhone) }} className="space-y-3">
              <p className="text-sm text-ink-700">Hi <strong>{googlePending.name}</strong> 👋 — your Google account <strong>{googlePending.email}</strong> is verified. Add your phone number to finish creating your account.</p>
              <div>
                <label className="label">Phone Number *</label>
                <div className="relative"><Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" /><input type="tel" inputMode="tel" autoComplete="tel" value={gPhone} onChange={e => setGPhone(e.target.value)} className="input pl-9" placeholder="+250 78..." required minLength={9} autoFocus /></div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
                {loading ? <Loader size={16} className="animate-spin" /> : null}
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
              <button type="button" onClick={() => setGooglePending(null)} className="btn btn-ghost btn-sm w-full text-ink-500">Cancel</button>
            </form>
          ) : (<>
          {(tab === 'login' || tab === 'register') && (
            <p className="text-xs text-ink-600 bg-ink-50 rounded-xl px-3 py-2 mb-4 text-center">
              🎓 Only school emails are allowed — use your <strong>@alustudent.com</strong> or <strong>@alueducation.com</strong> address.
            </p>
          )}

          {/* ── LOGIN ── */}
          {(tab === 'login' || tab === 'register') && googleBlock}

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <p className="text-sm text-ink-500 mb-1">Sign in with email <strong>or</strong> student ID</p>
              <div>
                <label className="label">Email or Student ID</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input value={form.email || form.studentId} onChange={e => {
                    const v = e.target.value
                    if (v.includes('@')) setForm(p => ({ ...p, email:v, studentId:'' }))
                    else setForm(p => ({ ...p, studentId:v, email:'' }))
                  }} className="input pl-9" placeholder="you@alustudent.com or STU001" required />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input type={showPw?'text':'password'} value={form.password} onChange={f('password')} className="input pl-9 pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">{showPw?<EyeOff size={14}/>:<Eye size={14}/>}</button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg mt-1">
                {loading ? <Loader size={16} className="animate-spin" /> : <UserCheck size={16} />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── REGISTER — accounts are created only with Google (email verified by Google) ── */}
          {tab === 'register' && (
            <p className="text-sm text-ink-500 text-center">
              {GOOGLE_ENABLED
                ? 'Create your account with your school Google account. Google verifies your email, so there is no code to type.'
                : 'Creating accounts is temporarily unavailable. Please try again later.'}
            </p>
          )}

          </>)}
        </div>

        <p className="text-center text-xs text-ink-400 mt-4">
          By continuing you agree to our <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
