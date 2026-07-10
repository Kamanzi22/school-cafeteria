import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let _socket = null
export const getSocket = () => {
  if (!_socket) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL
    _socket = backendUrl
      ? io(backendUrl, { path: '/socket.io', transports: ['websocket', 'polling'] })
      : io({ path: '/socket.io', transports: ['websocket', 'polling'] })
  }
  return _socket
}
export const useSocket = (events = {}) => {
  const s = getSocket()
  const ref = useRef(events); ref.current = events
  useEffect(() => {
    const handlers = {}
    Object.entries(ref.current).forEach(([e, h]) => { handlers[e] = h; s.on(e, h) })
    return () => Object.entries(handlers).forEach(([e, h]) => s.off(e, h))
  }, [])
  return s
}
