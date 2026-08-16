// Generates or retrieves a persistent anonymous device id — used to attribute visits from
// people who never sign in or start a guest session, so they still show up in visitor tracking.
export const getAnonymousId = () => {
  let id = localStorage.getItem('cc-anon-id')
  if (!id) {
    id = 'anon-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
    localStorage.setItem('cc-anon-id', id)
  }
  return id
}
