import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAdminStore } from '../store'
import { storeSessionAPI } from '../services/api'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''
const HEARTBEAT_MS = 20000
// Back within this long after putting the app in the background = the same session
const RESUME_MS = 2 * 60 * 1000

const sendEnd = (id) => {
  const url = `${BACKEND}/api/store-sessions/${id}/end`
  if (navigator.sendBeacon) navigator.sendBeacon(url)
  else fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
}

// Mounted once at the app root: records when the store's owner or staff are in the restaurant
// app, for the super admin's "Store activity" (like customer visits). A session runs while the
// app is open on screen and ends when it's closed, put in the background, or they sign out;
// coming back within 2 minutes carries on the same session. Moving between the app's pages
// doesn't start a new one. The super admin's own "view store" sessions aren't recorded.
export function useStoreSessionTracking() {
  const token = useAdminStore(s => s.token)
  const role = useAdminStore(s => s.role)
  const restaurantId = useAdminStore(s => s.restaurant?.id)
  const { pathname } = useLocation()
  const inRestaurantApp = pathname === '/admin' || pathname.startsWith('/admin/')
  const active = !!token && !!restaurantId && role !== 'viewer' && inRestaurantApp

  useEffect(() => {
    if (!active) return
    let sessionId = null
    let leftAt = 0
    let away = false // the current session was ended by going into the background
    let timer = null
    let starting = false
    let stopped = false
    const visible = () => document.visibilityState === 'visible'

    const leave = () => {
      clearInterval(timer)
      if (!sessionId || away) return
      sendEnd(sessionId)
      leftAt = Date.now()
      away = true
    }
    const beat = () => {
      if (!sessionId || !visible()) return
      storeSessionAPI.heartbeat(sessionId).then(r => {
        // The server already closed it (the phone slept too long) — start afresh
        if (r.data.data?.ended) { clearInterval(timer); sessionId = null; begin() }
      }).catch(() => {})
    }
    const keepBeating = () => { clearInterval(timer); timer = setInterval(beat, HEARTBEAT_MS) }
    const begin = () => {
      if (starting || stopped) return
      starting = true
      storeSessionAPI.start().then(r => {
        const id = r.data.data?.id
        if (!id) return
        if (stopped) { sendEnd(id); return }
        sessionId = id
        away = false
        if (visible()) keepBeating(); else leave()
      }).catch(() => {}).finally(() => { starting = false })
    }
    const onVisibility = () => {
      if (!visible()) { leave(); return }
      // Already counted as on screen (or still starting) — nothing to pick up again
      if ((sessionId && !away) || starting) return
      if (sessionId && Date.now() - leftAt < RESUME_MS) {
        const id = sessionId
        storeSessionAPI.resume(id).then(r => {
          if (stopped || sessionId !== id) return
          if (r.data.data?.resumed) { away = false; if (visible()) keepBeating(); else leave() }
          else { sessionId = null; begin() }
        }).catch(() => {})
      } else {
        sessionId = null
        begin()
      }
    }

    if (visible()) begin()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', leave)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [active, token])
}
