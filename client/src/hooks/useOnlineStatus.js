import { useState, useEffect } from 'react'

// Tracks browser connectivity via the online/offline events, which fire reliably for "no network
// interface at all" (airplane mode, wifi off). They don't catch every case (e.g. wifi connected
// but no internet behind it) — good enough to turn a silent blank screen into a clear one.
export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
