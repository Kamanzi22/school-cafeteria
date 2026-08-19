import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Backpack, Loader, LogIn, Eye, EyeOff } from 'lucide-react'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'

export default function DeliveryAuthPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await authAPI.deliveryLogin(form)
      localStorage.setItem('cc-delivery-v1', JSON.stringify({ state: { token: res.data.data.token } }))
      toast.success(`Welcome, ${res.data.data.staff.name}`)
      navigate('/delivery')
    } catch { toast.error('Invalid credentials') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Backpack size={40} className="text-brand-500 mx-auto mb-3" />
          <h1 className="text-2xl font-black text-white">Delivery Login</h1>
          <p className="text-ink-500 text-sm mt-1">CaféCampus Platform</p>
        </div>
        <div className="bg-ink-900 rounded-2xl p-6 border border-ink-800">
          <form onSubmit={handleLogin} className="space-y-4">
            {[['Username', 'username'], ['Password', 'password']].map(([l, k]) => (
              <div key={k}>
                <label className="label text-ink-500">{l}</label>
                <div className="relative">
                  <input
                    type={k === 'password' && !showPw ? 'password' : 'text'}
                    value={form[k]}
                    onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                    className="w-full bg-ink-800 border border-ink-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 pr-10"
                    required
                  />
                  {k === 'password' && (
                    <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn btn-primary w-full btn-lg">
              {loading ? <Loader size={16} className="animate-spin" /> : <LogIn size={16} />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
