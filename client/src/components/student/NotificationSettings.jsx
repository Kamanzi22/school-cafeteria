import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader, Share } from 'lucide-react'
import { getPushState, enableNotifications } from '../../services/push'
import toast from 'react-hot-toast'

// Profile card for phone/browser order notifications. Renders nothing when this device or the
// server can't do push, so it never shows a control that can't work.
export default function NotificationSettings() {
  const [state, setState] = useState(null) // null while checking
  const [busy, setBusy] = useState(false)

  useEffect(() => { getPushState().then(setState).catch(() => setState('unsupported')) }, [])

  const enable = async () => {
    setBusy(true)
    try {
      const next = await enableNotifications()
      setState(next)
      if (next === 'on') toast.success('Notifications on 🔔')
    } catch { toast.error('Could not turn on notifications') }
    finally { setBusy(false) }
  }

  if (!state || state === 'unsupported') return null

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        {state === 'on' ? <Bell size={20} className="text-alu-success-fg mt-0.5 shrink-0" /> : <BellOff size={20} className="text-alu-muted mt-0.5 shrink-0" />}
        <div className="flex-1">
          <p className="font-bold text-alu-cream text-sm">Order notifications</p>
          {state === 'on' && <p className="text-xs text-alu-muted mt-0.5">On — this device will be alerted when your order is ready, even if the app is closed.</p>}
          {state === 'off' && (
            <>
              <p className="text-xs text-alu-muted mt-0.5">Get an alert on this device when your order is ready, even if the app is closed.</p>
              <button onClick={enable} disabled={busy} className="btn btn-primary btn-sm mt-3">
                {busy ? <Loader size={14} className="animate-spin" /> : <Bell size={14} />}Turn on notifications
              </button>
            </>
          )}
          {state === 'blocked' && <p className="text-xs text-alu-muted mt-0.5">Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here.</p>}
          {state === 'needs-install' && (
            <p className="text-xs text-alu-muted mt-0.5">
              On iPhone, first add CaféCampus to your Home Screen: tap <Share size={12} className="inline -mt-0.5" /> Share → <strong>Add to Home Screen</strong>, then open it from your Home Screen and turn on notifications here.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
