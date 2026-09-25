// Service worker for order notifications. It exists so the phone can show order updates
// ("cooking", "ready", "cancelled"…) while the browser/app is closed — it deliberately does no caching or offline work.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}
  // Always show something: browsers (iOS especially) revoke a subscription whose pushes are silent.
  event.waitUntil(self.registration.showNotification(data.title || 'CaféCampus', {
    body: data.body || '',
    tag: data.tag,
    // Each status update for an order reuses its tag so they replace each other instead of
    // stacking — renotify makes the replacement buzz/sound again. Only valid alongside a tag.
    renotify: !!data.tag,
    icon: '/icon-192.png',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let target = new URL('/', self.location.origin)
  try {
    const u = new URL(event.notification.data?.url || '/', self.location.origin)
    if (u.origin === self.location.origin) target = u
  } catch {}
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of windows) {
      await w.focus()
      try { await w.navigate(target.href) } catch {}
      return
    }
    await self.clients.openWindow(target.href)
  })())
})
