import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { getSocket } from './useSocket'
import { useCustomerStore } from '../store'
import { syncPushIfAllowed } from '../services/push'

// While the site is open in a hidden tab (desktop), show a system notification. When the site
// is *closed*, the push notification from the service worker (see services/push.js) covers it;
// both use the same tag so a device that gets both shows just one.
const showSystemNotification = ({ title, body, orderId }) => {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
    const n = new Notification(title, { body, tag: `order-${orderId}` })
    n.onclick = () => { window.focus(); window.location.assign(`/order/track/${orderId}`); n.close() }
  } catch {}
}

// Mounted once at the app root: while a customer is signed in, listens on their personal
// socket room for "your order is ready" and surfaces it wherever they are in the app, and
// keeps this device's push subscription attached to their account.
export const useOrderNotifications = () => {
  const token = useCustomerStore(s => s.token)

  useEffect(() => {
    if (!token) return
    syncPushIfAllowed()
    const socket = getSocket()
    // Rooms don't survive a reconnect, so re-join every time the socket (re)connects.
    const join = () => socket.emit('join:customer', { token })
    const onNotification = (n) => {
      toast.success(`${n.title} — ${n.body}`, { id: `${n.type}-${n.orderId}`, duration: 10000, icon: '🔔' })
      showSystemNotification(n)
    }
    socket.on('connect', join)
    socket.on('notification', onNotification)
    if (socket.connected) join()
    return () => { socket.off('connect', join); socket.off('notification', onNotification) }
  }, [token])
}
