import { useState, useEffect } from 'react'
import { Backpack, Loader, Plus, Trash2, KeyRound, ToggleLeft, ToggleRight } from 'lucide-react'
import { superAdminAPI } from '../../services/api'
import PasswordInput from '../shared/PasswordInput'
import toast from 'react-hot-toast'

const EMPTY = { name: '', username: '', password: '' }

// The logins delivery runners use at /delivery/login. Turning one off or deleting it locks it out
// straight away (the server re-checks on every request).
export default function DeliveryRunners() {
  const [runners, setRunners] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = () => superAdminAPI.getRunners().then(r => setRunners(r.data.data)).catch(() => { setRunners([]); toast.error('Could not load delivery runners') })
  useEffect(() => { load() }, [])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const add = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await superAdminAPI.createRunner(form)
      setRunners(prev => [...(prev || []), res.data.data])
      setForm(EMPTY)
      toast.success(`Runner account created — they sign in at /delivery/login as "${res.data.data.username}"`, { duration: 6000 })
    } catch (e2) { toast.error(e2.response?.data?.error || 'Could not create runner') }
    finally { setAdding(false) }
  }

  const act = async (runner, fn) => {
    setBusyId(runner.id)
    try { await fn() } catch (e) { toast.error(e.response?.data?.error || 'Something went wrong') }
    finally { setBusyId(null) }
  }

  const toggle = (runner) => act(runner, async () => {
    const res = await superAdminAPI.toggleRunner(runner.id)
    setRunners(prev => prev.map(r => r.id === runner.id ? res.data.data : r))
    toast.success(res.data.data.isActive ? `${runner.name} can sign in again` : `${runner.name} is signed out and can't sign in`)
  })

  const resetPassword = (runner) => {
    const password = window.prompt(`New password for ${runner.name} (at least 6 characters):`)
    if (password === null) return
    act(runner, async () => {
      await superAdminAPI.resetRunnerPassword(runner.id, password)
      toast.success(`Password changed for ${runner.name}`)
    })
  }

  const remove = (runner) => {
    if (!window.confirm(`Delete ${runner.name}'s runner account? They won't be able to sign in any more.`)) return
    act(runner, async () => {
      await superAdminAPI.deleteRunner(runner.id)
      setRunners(prev => prev.filter(r => r.id !== runner.id))
      toast.success('Runner account deleted')
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-ink-100 p-5">
      <h2 className="font-bold text-ink-900 mb-1 flex items-center gap-2"><Backpack size={16} />Delivery Runners</h2>
      <p className="text-sm text-ink-400 mb-4">Logins for the people who deliver orders. They sign in at <span className="font-mono">/delivery/login</span> and only see delivery orders.</p>

      {runners === null ? (
        <div className="py-4 text-center"><Loader size={18} className="animate-spin text-brand-500 mx-auto" /></div>
      ) : runners.length === 0 ? (
        <p className="text-sm text-ink-400 mb-4">No runner accounts yet.</p>
      ) : (
        <ul className="divide-y divide-ink-100 mb-4 border border-ink-100 rounded-xl">
          {runners.map(r => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <p className={`font-semibold text-sm ${r.isActive ? 'text-ink-900' : 'text-ink-400 line-through'}`}>{r.name}</p>
                <p className="text-xs text-ink-400 font-mono">{r.username}</p>
              </div>
              {busyId === r.id && <Loader size={14} className="animate-spin text-brand-500" />}
              <button onClick={() => toggle(r)} disabled={busyId === r.id} title={r.isActive ? 'Turn off this login' : 'Turn this login back on'}
                className={`btn btn-sm ${r.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'}`}>
                {r.isActive ? <><ToggleRight size={14} />Active</> : <><ToggleLeft size={14} />Off</>}
              </button>
              <button onClick={() => resetPassword(r)} disabled={busyId === r.id} className="btn btn-ghost btn-sm text-ink-500" title="Set a new password">
                <KeyRound size={14} />Password
              </button>
              <button onClick={() => remove(r)} disabled={busyId === r.id} className="btn btn-ghost btn-sm text-red-500" title="Delete this runner account">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input value={form.name} onChange={f('name')} placeholder="Full name" className="input text-sm" required />
        <input value={form.username} onChange={f('username')} placeholder="Username" className="input text-sm" autoCapitalize="none" autoComplete="off" required />
        <PasswordInput value={form.password} onChange={f('password')} placeholder="Password (6+ chars)" className="text-sm" autoComplete="new-password" required minLength={6} />
        <button type="submit" disabled={adding} className="btn btn-primary text-sm">
          {adding ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}Add runner
        </button>
      </form>
    </div>
  )
}
