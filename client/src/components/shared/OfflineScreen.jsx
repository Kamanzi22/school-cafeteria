import { WifiOff, RotateCw } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

// Full-screen takeover shown the moment this device has no network — covers whatever's
// underneath (rather than replacing it) so nothing is lost, and disappears the instant
// connectivity returns. Fixes the "opens to a black screen" experience: without this, a page
// whose data fetch fails offline just renders its dark background with nothing on it.
export default function OfflineScreen() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="fixed inset-0 z-[100] bg-alu-bg flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 rounded-full bg-alu-card flex items-center justify-center mx-auto mb-4">
          <WifiOff size={28} className="text-alu-muted" />
        </div>
        <h1 className="font-black text-lg text-alu-cream">You're offline</h1>
        <p className="text-sm text-alu-muted mt-1.5">Check your internet connection. This page will come back as soon as you're reconnected.</p>
        <button onClick={() => window.location.reload()} className="btn btn-secondary btn-sm mt-5 mx-auto">
          <RotateCw size={14} />Try Again
        </button>
      </div>
    </div>
  )
}
