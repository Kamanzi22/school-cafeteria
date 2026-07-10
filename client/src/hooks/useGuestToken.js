// Generates or retrieves a persistent guest token from localStorage
export const getGuestToken = () => {
  let token = localStorage.getItem('cc-guest-token')
  if (!token) {
    token = 'guest-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
    localStorage.setItem('cc-guest-token', token)
  }
  return token
}
