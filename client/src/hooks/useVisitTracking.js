import { useEffect, useRef } from 'react'
import { visitAPI } from '../services/api'
import { getAnonymousId } from './useAnonymousId'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''
const HEARTBEAT_MS = 20000

// Logs a visit to a restaurant page for superadmin visitor tracking. Identity (account/guest)
// comes from the Authorization header server-side via optionalCustomer; anonymousId is only
// used as a fallback when there's no logged-in/guest session at all.
export function useVisitTracking(restaurantId) {
  const visitIdRef = useRef(null)

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    let heartbeatTimer = null

    const endVisit = () => {
      if (!visitIdRef.current) return
      const url = `${BACKEND}/api/visits/${visitIdRef.current}/end`
      if (navigator.sendBeacon) navigator.sendBeacon(url)
      else fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
      visitIdRef.current = null
    }

    visitAPI.start({ restaurantId, anonymousId: getAnonymousId() }).then(res => {
      if (cancelled) { return }
      visitIdRef.current = res.data.data.id
      heartbeatTimer = setInterval(() => {
        if (visitIdRef.current) visitAPI.heartbeat(visitIdRef.current).catch(() => {})
      }, HEARTBEAT_MS)
    }).catch(() => {})

    window.addEventListener('pagehide', endVisit)

    return () => {
      cancelled = true
      clearInterval(heartbeatTimer)
      window.removeEventListener('pagehide', endVisit)
      endVisit()
    }
  }, [restaurantId])
}
