import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { getPushState, enableNotifications, disablePush } from '../../services/push'
import toast from 'react-hot-toast'

// One-tap order-notification toggle for the customer header, mirroring the restaurant app's bell.
// States that need more than a tap (iPhone not added to Home Screen) go to the profile card,
// which explains what to do; hidden entirely when this device/server can't do push.
export default function NotificationBell() {
  const [state, setState] = useState(null)
  const navigate = useNavigate()

  // 'unsupported' can also mean the server was asleep/slow when asked (Render cold start), so on a
  // browser that can do push, keep the bell visible as 'off' — tapping re-checks the server.
  const browserCanPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  useEffect(() => {
    getPushState().catch(() => 'unsupported').then(s => setState(s === 'unsupported' && browserCanPush ? 'off' : s))
  }, [])

  const toggle = async () => {
    if (state === 'on') {
      await disablePush()
      setState('off')
      toast.success('Notifications off')
      return
    }
    if (state === 'blocked') { toast.error('Notifications are blocked for this site — allow them in your browser or phone settings'); return }
    if (state === 'needs-install') { navigate('/profile'); return }
    const next = await enableNotifications()
    if (next === 'unsupported') { toast.error("Couldn't turn on notifications — try again in a moment"); return }
    setState(next)
    if (next === 'on') toast.success('Notifications on 🔔')
  }

  if (!state || state === 'unsupported') return null

  return (
    <button onClick={toggle} title={state === 'on' ? 'Turn off notifications' : 'Turn on order notifications'} className="btn btn-ghost btn-icon">
      <Bell size={18} className={state === 'on' ? 'text-alu-gold fill-alu-gold' : ''} />
    </button>
  )
}
