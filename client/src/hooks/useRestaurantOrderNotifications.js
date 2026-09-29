import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAdminStore } from '../store'
import { restaurantPush } from '../services/push'
import { getSocket } from './useSocket'
import { currentPath } from '../portal'

// Mounted once at the app root: while an owner/staff device is signed in and has already
// allowed notifications, keeps this device's push subscription attached to their restaurant —
// same idea as useOrderNotifications on the customer side, just for "a new order came in"
// instead of "your order is ready". Also keeps the device in the restaurant's socket room on
// every page, so a reply from the CaféCampus team (help chat in Settings) pops up wherever they are.
export const useRestaurantOrderNotifications = () => {
  const token = useAdminStore(s => s.token)
  const restaurantId = useAdminStore(s => s.restaurant?.id)

  useEffect(() => {
    if (!token) return
    restaurantPush.syncPushIfAllowed()
  }, [token])

  useEffect(() => {
    if (!token || !restaurantId) return
    const socket = getSocket()
    // Rooms don't survive a reconnect, so re-join every time the socket (re)connects.
    const join = () => socket.emit('join:restaurant', { id: restaurantId, token })
    const onMessage = (msg) => {
      // The Settings page shows the conversation itself
      if (!msg.fromAdmin || msg.restaurantId !== restaurantId || currentPath().startsWith('/admin/settings')) return
      toast(`New message from the CaféCampus team: ${msg.body.length > 80 ? `${msg.body.slice(0, 77)}…` : msg.body}`, { id: `support-${msg.id}`, icon: '💬', duration: 8000 })
    }
    socket.on('connect', join)
    socket.on('support:message', onMessage)
    if (socket.connected) join()
    return () => { socket.off('connect', join); socket.off('support:message', onMessage) }
  }, [token, restaurantId])
}
