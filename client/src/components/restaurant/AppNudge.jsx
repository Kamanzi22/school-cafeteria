import { useState, useEffect } from 'react'
import { Bell, Loader, X } from 'lucide-react'
import InstallApp from '../shared/InstallApp'
import { useInstallState } from '../../services/install'
import { restaurantPush } from '../../services/push'
import toast from 'react-hot-toast'

const DISMISS_KEY = 'restaurantNotifNudgeDismissed'
const wasDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false } }

// Shown at the top of the restaurant dashboard (the first thing an owner/staff sees after
// login): an "Install app" banner while this device hasn't installed it yet, then — once it
// has — a one-tap nudge to turn on new-order push notifications. This doubles as the
// install-time notification prompt: Android/desktop already chases the install accept with a
// permission prompt (see InstallApp's onInstalled), but iOS gives no signal when someone
// finishes Add to Home Screen, so the first standalone launch is the earliest point we can
// reliably ask.
export default function AppNudge() {
  const installState = useInstallState()
  const [pushState, setPushState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(wasDismissed())

  useEffect(() => { restaurantPush.getPushState().then(setPushState).catch(() => setPushState('unsupported')) }, [])

  if (installState !== 'installed') {
    return (
      <div className="mb-5">
        <InstallApp
          variant="banner"
          title="Get the CaféCampus restaurant app"
          subtitle="Add it to this device for a faster dashboard and new-order alerts."
          emoji="🏪"
          installedToast="Restaurant app installed 🎉"
          onInstalled={() => restaurantPush.enableNotifications().then(setPushState)}
        />
      </div>
    )
  }

  if (dismissed || !pushState || ['on', 'unsupported', 'blocked'].includes(pushState)) return null

  const enable = async () => {
    setBusy(true)
    try {
      const next = await restaurantPush.enableNotifications()
      setPushState(next)
      if (next === 'on') toast.success('Notifications on 🔔')
    } catch { toast.error('Could not turn on notifications') }
    finally { setBusy(false) }
  }
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, '1') } catch {}; setDismissed(true) }

  return (
    <div className="card p-4 flex items-start gap-3 mb-5">
      <Bell size={20} className="text-brand-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-alu-cream text-sm">Turn on new-order alerts</p>
        <p className="text-xs text-alu-muted mt-0.5">Get notified the instant a customer orders, even if the app is closed.</p>
        <button onClick={enable} disabled={busy} className="btn btn-primary btn-sm mt-3">
          {busy ? <Loader size={14} className="animate-spin" /> : <Bell size={14} />}Turn on notifications
        </button>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="btn btn-ghost btn-icon -mt-1 -mr-1"><X size={16} /></button>
    </div>
  )
}
