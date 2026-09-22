import { useState } from 'react'
import { Download, Share, MoreHorizontal, ArrowRight, X } from 'lucide-react'
import { useInstallState, promptInstall } from '../../services/install'
import toast from 'react-hot-toast'

const DISMISS_KEY = 'installBannerDismissed'
const wasDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false } }

// "Install CaféCampus" button. variant="banner" is the dismissible strip on the home page;
// variant="card" is the permanent entry on the profile page. Renders nothing when the app is
// already installed or this browser can't install it, so it never shows a button that can't work.
export default function InstallApp({ variant = 'card' }) {
  const state = useInstallState()
  const [showSteps, setShowSteps] = useState(false)
  const [dismissed, setDismissed] = useState(variant === 'banner' && wasDismissed())

  if (state === 'installed' || state === 'unavailable' || dismissed) return null

  const install = async () => {
    if (state === 'ios') return setShowSteps(s => !s)
    const outcome = await promptInstall()
    if (outcome === 'accepted') toast.success('CaféCampus installed 🎉')
  }
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div className="card p-4 flex items-start gap-3">
      <span className="text-2xl leading-none mt-0.5">🍽️</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-alu-cream text-sm">Get the CaféCampus app</p>
        <p className="text-xs text-alu-muted mt-0.5">Add it to your phone for one-tap ordering and order-ready alerts.</p>
        <button onClick={install} className="btn btn-primary btn-sm mt-3"><Download size={14} />Install app</button>
        {state === 'ios' && showSteps && (
          <p className="text-xs text-alu-muted mt-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1">Tap <Share size={12} className="inline -mt-0.5" /> <strong>Share</strong></span>
            <ArrowRight size={11} className="inline text-alu-muted/70" />
            <span className="inline-flex items-center gap-1"><MoreHorizontal size={12} className="inline -mt-0.5" /> <strong>View More</strong></span>
            <ArrowRight size={11} className="inline text-alu-muted/70" />
            <strong>Add to Home Screen</strong>
          </p>
        )}
      </div>
      {variant === 'banner' && (
        <button onClick={dismiss} aria-label="Dismiss" className="btn btn-ghost btn-icon -mt-1 -mr-1"><X size={16} /></button>
      )}
    </div>
  )
}
