import { useEffect, useRef } from 'react'
import { getSocket } from './useSocket'

// Everything the server broadcasts when restaurant or platform data changes. Payloads carry the
// restaurant's id as restaurantId (restaurant:updated sends the whole restaurant, so its id), or
// no id for a platform-wide change such as the super admin's delivery switch.
export const CATALOG_EVENTS = ['catalog:changed', 'restaurant:updated', 'restaurant:deleted', 'restaurant:status', 'menu:updated']

// Reloads a screen's data when the restaurant or super admin apps change it, so customers see
// it without restarting the app: on a matching live event, when the phone brings the app back
// to the foreground (the socket is dropped while it's in the background, so events are missed
// then), and when the socket reconnects. A live event reaches every open app at once, so each
// one waits a random moment (up to 1.5 s) before refetching to spread the load on the server.
//
// matches(restaurantId) decides whether a restaurant-specific event concerns this screen;
// platform-wide events always do. spread is the longest random wait, in ms.
export function useLiveRefresh(refetch, { events = CATALOG_EVENTS, matches = () => true, onForeground = true, spread = 1500 } = {}) {
  const refetchRef = useRef(refetch); refetchRef.current = refetch
  const matchesRef = useRef(matches); matchesRef.current = matches

  useEffect(() => {
    const s = getSocket()
    let timer = null
    const scheduled = () => {
      if (timer) return
      timer = setTimeout(() => { timer = null; refetchRef.current() }, Math.random() * spread)
    }
    const onEvent = (payload = {}) => {
      const restaurantId = payload?.restaurantId ?? payload?.id ?? null
      if (restaurantId === null || matchesRef.current(restaurantId)) scheduled()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refetchRef.current() }
    const onReconnect = () => refetchRef.current()

    events.forEach(e => s.on(e, onEvent))
    s.io.on('reconnect', onReconnect)
    if (onForeground) document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      events.forEach(e => s.off(e, onEvent))
      s.io.off('reconnect', onReconnect)
      if (onForeground) document.removeEventListener('visibilitychange', onVisible)
    }
  }, [events.join(','), onForeground, spread])
}
