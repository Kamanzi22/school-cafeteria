import { useState } from 'react'
import { Download, Share, MoreHorizontal, ArrowRight, X } from 'lucide-react'
import { useInstallState, promptInstall } from '../../services/install'
import toast from 'react-hot-toast'

const DISMISS_KEY = 'installBannerDismissed'
const wasDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false } }

const IosSteps = () => (
  <p className="text-xs text-alu-muted mt-3 flex flex-wrap items-center gap-1.5">
    <span className="inline-flex items-center gap-1">Tap <Share size={12} className="inline -mt-0.5" /> <strong>Share</strong></span>
    <ArrowRight size={11} className="inline text-alu-muted/70" />
    <span className="inline-flex items-center gap-1"><MoreHorizontal size={12} className="inline -mt-0.5" /> <strong>View More</strong></span>
    <ArrowRight size={11} className="inline text-alu-muted/70" />
    <strong>Add to Home Screen</strong>
  </p>
)

// "Install CaféCampus" button. variant="banner" is the dismissible strip on the home page;
// variant="card" is the permanent entry on the profile/settings page; variant="button" is a bare
// button for a toolbar/header (e.g. the super admin header). Renders nothing when the app is
// already installed or this browser can't install it, so it never shows a control that can't
// work. title/subtitle/emoji/installedToast let the restaurant and super admin apps reuse this
// with their own copy — the underlying install prompt is the same browser API either way.
export default function InstallApp({ variant = 'card', title = 'Get the CaféCampus app', subtitle = 'Add it to your phone for order-ready alerts.', emoji = '🍽️', installedToast = 'CaféCampus installed 🎉', buttonClassName = 'btn btn-ghost text-ink-400 text-sm', onInstalled }) {
  const state = useInstallState()
  const [showSteps, setShowSteps] = useState(false)
  const [dismissed, setDismissed] = useState(variant === 'banner' && wasDismissed())

  if (state === 'installed' || state === 'unavailable' || dismissed) return null

  // Android/desktop only — the native prompt resolves right here, still within the tap's user
  // activation, so this is the one place we can chase it with a second prompt (e.g. notification
  // permission) without the browser silently ignoring it. iOS has no such signal (see AppNudge).
  const install = async () => {
    if (state === 'ios') return setShowSteps(s => !s)
    const outcome = await promptInstall()
    if (outcome === 'accepted') { toast.success(installedToast); onInstalled?.() }
  }
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  if (variant === 'button') {
    return (
      <div className="relative inline-block">
        <button onClick={install} className={buttonClassName}><Download size={14} /> Install app</button>
        {state === 'ios' && showSteps && (
          <div className="absolute right-0 top-full mt-2 w-64 card p-3 z-20 shadow-lg"><IosSteps /></div>
        )}
      </div>
    )
  }

  return (
    <div className="card p-4 flex items-start gap-3">
      <span className="text-2xl leading-none mt-0.5">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-alu-cream text-sm">{title}</p>
        <p className="text-xs text-alu-muted mt-0.5">{subtitle}</p>
        <button onClick={install} className="btn btn-primary btn-sm mt-3"><Download size={14} />Install app</button>
        {state === 'ios' && showSteps && <IosSteps />}
      </div>
      {variant === 'banner' && (
        <button onClick={dismiss} aria-label="Dismiss" className="btn btn-ghost btn-icon -mt-1 -mr-1"><X size={16} /></button>
      )}
    </div>
  )
}
