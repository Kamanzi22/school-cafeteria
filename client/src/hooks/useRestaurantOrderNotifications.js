import { useEffect } from 'react'
import { useAdminStore } from '../store'
import { restaurantPush } from '../services/push'

// Mounted once at the app root: while an owner/staff device is signed in and has already
// allowed notifications, keeps this device's push subscription attached to their restaurant —
// same idea as useOrderNotifications on the customer side, just for "a new order came in"
// instead of "your order is ready".
export const useRestaurantOrderNotifications = () => {
  const token = useAdminStore(s => s.token)

  useEffect(() => {
    if (!token) return
    restaurantPush.syncPushIfAllowed()
  }, [token])
}
